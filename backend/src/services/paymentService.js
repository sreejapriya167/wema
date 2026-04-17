import { Policy } from "../models/Policy.js";
import { PremiumPayment } from "../models/PremiumPayment.js";
import { Payout } from "../models/Payout.js";
import { RiderProfile } from "../models/RiderProfile.js";
import { ApiError } from "../utils/ApiError.js";
import { calculatePremium, computeZoneRiskScore } from "./premiumService.js";

async function resolveRiderProfile(riderOrUserId) {
  let rider = await RiderProfile.findById(riderOrUserId);
  if (rider) {
    return rider;
  }

  rider = await RiderProfile.findOne({ userId: riderOrUserId });
  return rider;
}

/**
 * PREMIUM COLLECTION - Weekly payment from rider
 * Using MOCK PAYMENT mode only (fake but works like real)
 */

// Mock Razorpay order creation (returns fake but functional payment order)
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
    // These fields help mimic real Razorpay response
    status: "created",
    created_at: Math.floor(Date.now() / 1000)
  };
}

/**
 * Mock payment verification (always succeeds in mock mode)
 * In real scenario, this would verify HMAC signature against Razorpay
 */
function verifyMockPaymentSignature({ orderId, paymentId, signature }) {
  // In mock mode, all signatures verify successfully
  // This simulates successful payment completion
  console.log(`[Mock Verify] Payment verified - Order: ${orderId}, PaymentId: ${paymentId}`);
  return true;
}

// Record successful premium payment with dynamic premium calculation
export async function recordPremiumPayment({ userId, policyId, amount, orderId, paymentId, signature, method = "MOCK" }) {
  const rider = await RiderProfile.findOne({ userId });
  if (!rider) {
    throw new ApiError(404, "Rider profile not found");
  }

  const policy = await Policy.findById(policyId);
  if (!policy) {
    throw new ApiError(404, "Policy not found");
  }

  if (policy.riderId.toString() !== rider._id.toString()) {
    throw new ApiError(403, "Policy does not belong to the authenticated rider");
  }

  // Verify mock payment signature (always succeeds in mock mode)
  if (!verifyMockPaymentSignature({ orderId, paymentId, signature })) {
    throw new ApiError(400, "Payment verification failed");
  }

  // Update policy: Mark as PAID for entire lock-in period (ONE-TIME payment)
  policy.isPaid = true;
  policy.totalPremiumForLockIn = amount;
  policy.paidAt = new Date();
  policy.lastPaymentAt = new Date();
  // Set next renewal to lock-in expiry date (payment covers entire lock-in period)
  policy.nextRenewalAt = new Date(policy.lockInExpiryAt);
  await policy.save();

  // Create premium payment record
  const premiumPayment = await PremiumPayment.create({
    riderId: rider._id,
    policyId: policy._id,
    amount,
    currency: "INR",
    method: "MOCK", // Always mock in this implementation
    status: "PAID",
    paidAt: new Date(),
    reference: `mock_payment_${paymentId || Date.now()}`
  });

  return premiumPayment;
}

// Get payment orders for rider (to show in dashboard)
export async function getPaymentOrders(riderId) {
  const rider = await resolveRiderProfile(riderId);
  if (!rider) {
    throw new ApiError(404, "Rider not found");
  }

  const premiumPayments = await PremiumPayment.find({ riderId: rider._id })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate("policyId")
    .lean();

  return premiumPayments;
}

/**
 * AUTOMATIC PAYOUTS - AI pays rider on claim approval
 * Using MOCK PAYMENT mode only
 */

// Mock Razorpay fund transfer (payout) - Returns fake but functional payout result
function executeMockPayout({ amount, upiId, claimId, description }) {
  const mockPayoutId = `mock_payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return {
    success: true,
    payoutId: mockPayoutId,
    amount: amount,
    upiId: upiId,
    status: "PAID", // Mock mode simulates instant payment
    reference: mockPayoutId,
    description: description,
    environment: "MOCK",
    processedAt: new Date().toISOString()
  };
}



// Release payout for approved claim (called when claim is approved)
export async function releasePayoutForClaim(claimId) {
  const { Claim } = await import("../models/Claim.js");
  const claim = await Claim.findById(claimId).populate("riderId");

  if (!claim) {
    throw new ApiError(404, "Claim not found");
  }

  if (claim.decision !== "APPROVED") {
    throw new ApiError(400, `Cannot pay claim with status: ${claim.decision}`);
  }

  const rider = claim.riderId;
  if (!rider || !rider.upiId) {
    throw new ApiError(400, "Rider UPI ID not found");
  }

  // Execute mock payout
  const payoutResult = executeMockPayout({
    amount: claim.cappedPayout,
    upiId: rider.upiId,
    claimId: claim._id,
    description: `Income protection payout for ${claim.eventId?.eventType || "disruption"}`
  });

  // Record payout in database
  const payout = await Payout.create({
    claimId: claim._id,
    riderId: rider._id,
    amount: claim.cappedPayout,
    payoutType: "CLAIM",
    description: `Claim payout - ${payoutResult.reference}`,
    currency: "INR",
    method: "UPI",
    provider: "RAZORPAY",
    status: "PAID",
    providerReference: payoutResult.reference,
    paidAt: new Date()
  });

  // Update claim status
  claim.decision = "PAID";
  await claim.save();

  console.log(`[Mock Payout] Released ₹${payoutResult.amount} to ${payoutResult.upiId} for claim ${claimId}`);
  return payout;
}

// Create adjustment payout (for complaints/manual adjustments)
export async function createAdjustmentPayout({ riderId, amount, reason, claimId = null }) {
  const rider = await RiderProfile.findById(riderId);
  if (!rider || !rider.upiId) {
    throw new ApiError(404, "Rider or UPI ID not found");
  }

  if (amount <= 0) {
    throw new ApiError(400, "Amount must be greater than 0");
  }

  // Execute mock payout
  const payoutResult = executeMockPayout({
    amount: amount,
    upiId: rider.upiId,
    claimId: claimId || `adjustment_${Date.now()}`,
    description: `Adjustment payout: ${reason}`
  });

  // Record in database
  const payout = await Payout.create({
    claimId: claimId || null,
    riderId: rider._id,
    amount: amount,
    payoutType: "ADJUSTMENT",
    description: `Adjustment - ${reason}`,
    currency: "INR",
    method: "UPI",
    provider: "RAZORPAY",
    status: "PAID",
    providerReference: payoutResult.reference,
    paidAt: new Date()
  });

  console.log(`[Mock Payout] Released adjustment payout ₹${amount} to ${rider.upiId} - ${reason}`);
  return payout;
}

/**
 * WEEKLY SCHEDULER - Automatic premium collection
 */

export async function collectWeeklyPremiums() {
  console.log("[Premium Collection] Starting weekly premium collection...");

  try {
    // Find all active policies with autoRenew enabled
    const policiesNeedingRenewal = await Policy.find({
      status: "ACTIVE",
      autoRenew: true,
      $expr: { $lte: ["$nextRenewalAt", new Date()] }
    }).populate("riderId");

    console.log(`[Premium Collection] Found ${policiesNeedingRenewal.length} policies to renew`);

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const policy of policiesNeedingRenewal) {
      try {
        const rider = policy.riderId;

        if (!rider || !rider.upiId) {
          results.failed++;
          results.errors.push({
            policyId: policy._id,
            error: "Rider UPI not found"
          });
          continue;
        }

        // Create mock payment order for collection
        const order = createMockPaymentOrder({
          amount: policy.weeklyPremium,
          riderId: rider._id,
          policyId: policy._id,
          description: `Weekly premium for ${policy.planKey} plan`
        });

        // In real scenario, this would send payment link to rider via SMS/notification
        // For now, we create a pending payment record
        const payment = await PremiumPayment.create({
          riderId: rider._id,
          policyId: policy._id,
          amount: policy.weeklyPremium,
          currency: "INR",
          method: "AUTO_DEBIT",
          status: "PENDING",
          reference: order.orderId
        });

        console.log(`[Premium Collection] Created mock payment order for rider ${rider._id}: ${order.orderId}`);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          policyId: policy._id,
          error: error.message
        });
        console.error(`[Premium Collection] Error for policy ${policy._id}:`, error.message);
      }
    }

    console.log(`[Premium Collection] Completed. Success: ${results.success}, Failed: ${results.failed}`);
    return results;
  } catch (error) {
    console.error("[Premium Collection] Error:", error.message);
    throw error;
  }
}

/**
 * MONTHLY AUTO-PAYOUT - Auto pay all approved claims
 */

export async function autoBatchPayoutApprovedClaims() {
  console.log("[Auto Payout] Starting batch payout of approved claims...");

  try {
    const { Claim } = await import("../models/Claim.js");

    // Find all approved claims that haven't been paid yet
    const approvedClaims = await Claim.find({
      decision: "APPROVED",
      createdAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } // At least 5 mins old to avoid race conditions
    })
      .populate("riderId")
      .limit(100); // Process max 100 per run

    console.log(`[Auto Payout] Found ${approvedClaims.length} claims to pay`);

    const results = {
      paid: 0,
      failed: 0,
      errors: []
    };

    for (const claim of approvedClaims) {
      try {
        await releasePayoutForClaim(claim._id);
        results.paid++;
        console.log(`[Auto Payout] Paid claim ${claim._id}`);
      } catch (error) {
        results.failed++;
        results.errors.push({
          claimId: claim._id,
          error: error.message
        });
        console.error(`[Auto Payout] Error for claim ${claim._id}:`, error.message);
      }
    }

    console.log(`[Auto Payout] Completed. Paid: ${results.paid}, Failed: ${results.failed}`);
    return results;
  } catch (error) {
    console.error("[Auto Payout] Error:", error.message);
    throw error;
  }
}

/**
 * PAYMENT DASHBOARD - Show payment history
 */

export async function getPaymentDashboard(riderId) {
  const rider = await resolveRiderProfile(riderId);
  if (!rider) {
    throw new ApiError(404, "Rider not found");
  }

  // Get recent payments
  const premiumPayments = await PremiumPayment.find({ riderId })
    .sort({ createdAt: -1 })
    .limit(6)
    .populate("policyId")
    .lean();

  // Get recent payouts
  const { Payout } = await import("../models/Payout.js");
  const payouts = await Payout.find({ riderId })
    .sort({ createdAt: -1 })
    .limit(6)
    .populate("claimId")
    .lean();

  // Get pending payment orders
  const pendingPayments = await PremiumPayment.find({ riderId, status: "PENDING" }).lean();

  // Get active policy
  const activePolicy = await Policy.findOne({ riderId, status: "ACTIVE" }).lean();

  return {
    rider,
    activePolicy,
    premiumPayments,
    payouts,
    pendingPayments: pendingPayments.length,
    totalPaid: premiumPayments
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + p.amount, 0),
    totalReceived: payouts
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + p.amount, 0)
  };
}
