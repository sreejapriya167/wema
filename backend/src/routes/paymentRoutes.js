import { Router } from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { requireRole } from "../middleware/requireRole.js";
import { ROLES } from "../constants/roles.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  recordPremiumPayment,
  getPaymentOrders,
  getPaymentDashboard,
  collectWeeklyPremiums,
  autoBatchPayoutApprovedClaims
} from "../services/paymentService.js";
import { RiderProfile } from "../models/RiderProfile.js";
import { Policy } from "../models/Policy.js";
import { calculatePremium, computeZoneRiskScore, computeConsistencyScore } from "../services/premiumService.js";
import { ApiError } from "../utils/ApiError.js";

const router = Router();

/**
 * Helper: Create mock payment order
 */
function createMockPaymentOrder({ amount, riderId, policyId, description }) {
  const mockOrderId = `mock_order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const mockPaymentKey = `mock_key_${Date.now()}`;

  return {
    orderId: mockOrderId,
    amount: amount,
    currency: "INR",
    key: mockPaymentKey,
    notes: {
      riderId: riderId.toString(),
      policyId: policyId.toString(),
      type: "premium_collection",
      environment: "MOCK",
      description: description
    },
    status: "created",
    created_at: Math.floor(Date.now() / 1000)
  };
}

/**
 * Rider Payment Routes
 */

// GET /api/v1/payments/dashboard - View payment history
router.get(
  "/dashboard",
  verifyToken,
  requireRole(ROLES.RIDER),
  asyncHandler(async (req, res) => {
    const dashboard = await getPaymentDashboard(req.auth.userId);
    res.json({ success: true, data: dashboard });
  })
);

// GET /api/v1/payments/orders - Get recent payment orders
router.get(
  "/orders",
  verifyToken,
  requireRole(ROLES.RIDER),
  asyncHandler(async (req, res) => {
    const orders = await getPaymentOrders(req.auth.userId);
    res.json({ success: true, data: orders });
  })
);

// POST /api/v1/payments/initiate - Start premium payment (returns mock payment order)
router.post(
  "/initiate",
  verifyToken,
  requireRole(ROLES.RIDER),
  asyncHandler(async (req, res) => {
    const { policyId } = req.body;
    const riderId = req.auth.userId;

    if (!policyId) {
      throw new ApiError(400, "policyId is required");
    }

    // Get rider profile
    const rider = await RiderProfile.findOne({ userId: riderId });
    if (!rider) {
      throw new ApiError(404, "Rider profile not found");
    }

    // Get policy
    const policy = await Policy.findById(policyId);
    if (!policy) {
      throw new ApiError(404, "Policy not found");
    }

    if (policy.riderId.toString() !== rider._id.toString()) {
      throw new ApiError(403, "Policy does not belong to rider");
    }

    // Check if policy already paid
    if (policy.isPaid) {
      throw new ApiError(400, "This policy is already paid. Payment is one-time for the entire lock-in period.");
    }

    // Calculate DYNAMIC premium based on current conditions
    const zoneRiskScore = await computeZoneRiskScore({
      zoneCode: rider.zoneCode,
      city: rider.city,
      planKey: policy.planKey
    });

    const consistencyScore = await computeConsistencyScore({ riderId: rider._id });

    const weeklyPremiumDetails = calculatePremium({
      weeklyIncome: rider.weeklyEarningsAverage || 3500,
      zoneRiskScore: zoneRiskScore,
      planKey: policy.planKey,
      consistencyScore,
      date: new Date()
    });

    const weeklyPremium = weeklyPremiumDetails.recommendedPremium;
    
    // Calculate ONE-TIME premium for entire lock-in period
    const lockInWeeks = (policy.lockInMonths * 30) / 7;  // Approximate weeks in lock-in period
    const totalPremium = Math.round(weeklyPremium * lockInWeeks);

    // Create mock payment order with ONE-TIME total premium
    const order = createMockPaymentOrder({
      amount: totalPremium,
      riderId: rider._id,
      policyId: policy._id,
      description: `One-time premium for ${policy.planKey} plan - ${policy.lockInMonths} month lock-in (₹${totalPremium})`
    });

    res.json({
      success: true,
      data: {
        ...order,
        premiumDetails: {
          ...weeklyPremiumDetails,
          weeklyRate: weeklyPremium,
          lockInMonths: policy.lockInMonths,
          lockInWeeks: lockInWeeks,
          totalPremiumForLockIn: totalPremium,
          description: `One-time payment for ${policy.lockInMonths}-month coverage`
        }  // Include calculation details for transparency
      }
    });
  })
);

// POST /api/v1/payments/verify - Verify mock payment
router.post(
  "/verify",
  verifyToken,
  requireRole(ROLES.RIDER),
  asyncHandler(async (req, res) => {
    const { orderId, paymentId, signature, policyId, amount } = req.body;
    const numericAmount = Number(amount);

    if (!orderId || !paymentId || !policyId || !Number.isFinite(numericAmount)) {
      throw new ApiError(400, "orderId, paymentId, policyId, and numeric amount are required");
    }

    // Record the payment in database
    const payment = await recordPremiumPayment({
      userId: req.auth.userId,
      policyId,
      amount: numericAmount,
      orderId,
      paymentId,
      signature: signature || "mock_signature"
    });

    res.json({
      success: true,
      message: "Mock payment verified and recorded",
      data: payment
    });
  })
);

/**
 * Admin/System Routes for Automatic Payments
 */

// POST /api/v1/payments/admin/collect-weekly - Trigger weekly premium collection
router.post(
  "/admin/collect-weekly",
  verifyToken,
  requireRole(ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const results = await collectWeeklyPremiums();
    res.json({ success: true, data: results });
  })
);

// POST /api/v1/payments/admin/payout-claims - Auto-payout all approved claims
router.post(
  "/admin/payout-claims",
  verifyToken,
  requireRole(ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const results = await autoBatchPayoutApprovedClaims();
    res.json({ success: true, data: results });
  })
);

export default router;
