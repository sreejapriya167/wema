import { Claim } from "../models/Claim.js";
import { FraudLog } from "../models/FraudLog.js";
import { PLAN_CONFIG } from "../constants/plans.js";
import { CLAIM_STATUS, RISK_TIERS } from "../constants/eventTypes.js";
import { isPointWithinRadius, polygonsOverlap } from "../utils/geo.js";
import { hoursBetween, sameWeeklySlot } from "../utils/time.js";
import { scoreFraud, logFraudAssessment } from "./fraudService.js";

function calculateBaseline(rider, event) {
  const matchingSlots = (rider.earningsHistory || []).filter((slot) =>
    sameWeeklySlot(slot.slotStart, event.detectedAt)
  );

  const comparedSlots = matchingSlots.slice(-4);
  const totalEarnings = comparedSlots.reduce((sum, slot) => sum + slot.earnings, 0);
  const totalOrders = comparedSlots.reduce((sum, slot) => sum + slot.orders, 0);
  const totalHours = comparedSlots.reduce((sum, slot) => sum + hoursBetween(slot.slotStart, slot.slotEnd), 0);

  return {
    averageHourlyEarnings: Number(
      ((comparedSlots.length ? totalEarnings : rider.weeklyEarningsAverage / 35) / Math.max(totalHours || comparedSlots.length, 1)).toFixed(2)
    ),
    comparedSlots: comparedSlots.length,
    comparedOrdersAverage: Number((totalOrders / Math.max(comparedSlots.length, 1)).toFixed(2))
  };
}

function calculateLossWindowHours(event) {
  return Number(hoursBetween(event.lossWindowStart, event.lossWindowEnd).toFixed(2));
}

function calculatePayout({ baseline, lossWindowHours, severityFactor, weeklyCap }) {
  const calculated = Number((baseline.averageHourlyEarnings * lossWindowHours * severityFactor).toFixed(2));
  return {
    calculatedPayout: calculated,
    cappedPayout: Number(Math.min(calculated, weeklyCap).toFixed(2))
  };
}

async function buildClusterContext(rider, event) {
  const [sharedIpCount, sharedDeviceCount, suspiciousZoneBurst] = await Promise.all([
    FraudLog.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 1000 * 60 * 60) },
      "signals.ipAddress": rider.ipAddress
    }),
    FraudLog.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 1000 * 60 * 60) },
      "signals.deviceFingerprint": rider.deviceFingerprint
    }),
    FraudLog.countDocuments({
      eventId: event._id,
      createdAt: { $gte: new Date(Date.now() - 1000 * 60 * 15) }
    }).then((count) => count > 25)
  ]);

  return { sharedIpCount, sharedDeviceCount, suspiciousZoneBurst };
}

export async function evaluateRiderForEvent(rider, event) {
  const plan = PLAN_CONFIG[rider.plan];
  const claim = await Claim.create({
    riderId: rider._id,
    eventId: event._id,
    severityFactor: event.severity.factor
  });

  if (!plan?.calamityTypes.includes(event.eventType)) {
    claim.rejectionReason = "Plan does not cover this calamity type";
    await claim.save();
    return claim;
  }

  claim.eligibilityChecks.gpsInsideRadius = isPointWithinRadius(rider.currentGps, event.center, event.radiusKm);
  if (!claim.eligibilityChecks.gpsInsideRadius) {
    claim.rejectionReason = "GPS outside calamity radius";
    await claim.save();
    return claim;
  }

  claim.eligibilityChecks.zoneOverlap = polygonsOverlap(rider.registeredZonePolygon, event.affectedPolygon);
  if (!claim.eligibilityChecks.zoneOverlap) {
    claim.rejectionReason = "Registered delivery zone does not overlap affected area";
    await claim.save();
    return claim;
  }

  claim.eligibilityChecks.activeDelivery = ["ACTIVE", "PICKED_UP"].includes(rider.activeDelivery?.status);
  if (!claim.eligibilityChecks.activeDelivery) {
    claim.rejectionReason = "No active delivery in progress";
    await claim.save();
    return claim;
  }

  const clusterContext = await buildClusterContext(rider, event);
  const fraud = await scoreFraud({
    rider,
    event,
    historicalRisk: { weatherCrossVerification: true },
    clusterContext
  });

  claim.fraudScore = fraud.score;
  claim.fraudRiskTier = fraud.riskTier;
  claim.eligibilityChecks.fraudCleared = fraud.riskTier === RISK_TIERS.LOW;
  claim.baseline = calculateBaseline(rider, event);
  claim.lossWindowHours = calculateLossWindowHours(event);

  const payout = calculatePayout({
    baseline: claim.baseline,
    lossWindowHours: claim.lossWindowHours,
    severityFactor: claim.severityFactor,
    weeklyCap: plan.weeklyPayoutCap
  });

  claim.calculatedPayout = payout.calculatedPayout;
  claim.cappedPayout = payout.cappedPayout;

  if (event.sourceType === "SOCIAL") {
    claim.decision = CLAIM_STATUS.ADMIN_REVIEW;
    claim.adminReviewNote = "Social disruption payouts always require admin review";
  } else if (fraud.riskTier === RISK_TIERS.LOW) {
    claim.decision = CLAIM_STATUS.APPROVED;
  } else if (fraud.riskTier === RISK_TIERS.MEDIUM) {
    claim.decision = CLAIM_STATUS.ADMIN_REVIEW;
    claim.adminReviewNote = "Fraud model requested admin review";
  } else {
    claim.decision = CLAIM_STATUS.HOLD_RIDER_VERIFICATION;
    claim.riderVerificationRequested = ["delivery_app_screenshot", "timestamped_photo"];
    claim.adminReviewNote = "High-risk fraud score requires hold";
  }

  await claim.save();

  // Auto-trigger payout for approved weather claims with LOW fraud
  if (claim.decision === CLAIM_STATUS.APPROVED && event.sourceType === "WEATHER") {
    try {
      const { releasePayoutForClaim } = await import("./paymentService.js");
      // Schedule payout in 5 seconds to avoid race conditions
      setTimeout(() => {
        releasePayoutForClaim(claim._id)
          .then(() => console.log(`[Auto-Payout] Released payout for claim ${claim._id}`))
          .catch((error) => console.error(`[Auto-Payout] Failed for claim ${claim._id}:`, error.message));
      }, 5000);
    } catch (error) {
      console.error("[Auto-Payout] Error setting up automatic payout:", error.message);
    }
  }

  await logFraudAssessment({
    riderId: rider._id,
    eventId: event._id,
    claimId: claim._id,
    signals: {
      ipAddress: rider.ipAddress,
      deviceFingerprint: rider.deviceFingerprint,
      accelerometerScore: rider.motionTelemetry?.accelerometerScore,
      gyroscopeScore: rider.motionTelemetry?.gyroscopeScore
    },
    clusterContext,
    score: fraud.score,
    scoringEngine: fraud.scoringEngine,
    scoringModel: fraud.scoringModel,
    scoringMode: fraud.scoringMode,
    riskTier: fraud.riskTier,
    explanation: fraud.explanations
  });

  return claim;
}

