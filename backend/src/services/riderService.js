import { RiderProfile } from "../models/RiderProfile.js";
import { User } from "../models/User.js";
import { Event } from "../models/Event.js";
import { Claim } from "../models/Claim.js";
import { Payout } from "../models/Payout.js";
import { Appeal } from "../models/Appeal.js";
import { Complaint } from "../models/Complaint.js";
import { Policy } from "../models/Policy.js";
import { PremiumPayment } from "../models/PremiumPayment.js";
import { PLAN_CONFIG } from "../constants/plans.js";
import { calculatePremium, computeZoneRiskScore, computeConsistencyScore } from "./premiumService.js";
import { generatePremiumInsight } from "./aiPremiumService.js";
import { ApiError } from "../utils/ApiError.js";
import { cityFromPin, isValidPin, normalizePin, PIN_GEO_MAP } from "../utils/pincode.js";
import { buildCirclePolygon } from "../utils/geo.js";
import { normalizeCity } from "../utils/geography.js";

function buildAlertQuery(rider) {
  return {
    zoneCode: rider.zoneCode,
    status: { $in: ["APPROVED", "PROCESSING", "COMPLETED"] }
  };
}

async function findEffectiveActivePolicy(riderId) {
  const now = new Date();

  const activePolicy = await Policy.findOne({ riderId, status: "ACTIVE" })
    .sort({ createdAt: -1 })
    .lean();

  if (activePolicy) {
    return activePolicy;
  }

  const inWindowPolicy = await Policy.findOne({
    riderId,
    status: { $ne: "CANCELLED" },
    coverageStart: { $lte: now },
    coverageEnd: { $gte: now }
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!inWindowPolicy) {
    return null;
  }

  if (inWindowPolicy.status !== "ACTIVE") {
    await Policy.updateOne(
      { _id: inWindowPolicy._id },
      { $set: { status: "ACTIVE" } }
    );
  }

  return {
    ...inWindowPolicy,
    status: "ACTIVE"
  };
}

async function ensurePolicy({ rider, premium, autoRenew = false }) {
  const now = new Date();
  const coverageEnd = new Date(now);
  coverageEnd.setDate(coverageEnd.getDate() + 7);

  // Calculate lock-in expiry date
  const lockInMonths = PLAN_CONFIG[rider.plan]?.lockInMonths || 2;
  const lockInExpiryAt = new Date(now);
  lockInExpiryAt.setMonth(lockInExpiryAt.getMonth() + lockInMonths);

  await Policy.updateMany(
    { riderId: rider._id, status: "ACTIVE" },
    { status: "EXPIRED" }
  );

  const policy = await Policy.create({
    riderId: rider._id,
    planKey: rider.plan,
    status: "ACTIVE",
    weeklyPremium: premium.recommendedPremium,
    weeklyPayoutCap: PLAN_CONFIG[rider.plan].weeklyPayoutCap,
    autoRenew,
    coverageStart: now,
    coverageEnd,
    lastPaymentAt: now,
    nextRenewalAt: coverageEnd,
    planSnapshot: PLAN_CONFIG[rider.plan],
    // Lock-in period fields
    activatedAt: now,
    lockInMonths: lockInMonths,
    lockInExpiryAt: lockInExpiryAt,
    canChangeAfter: lockInExpiryAt
  });

  const premiumPayment = await PremiumPayment.create({
    riderId: rider._id,
    policyId: policy._id,
    amount: premium.recommendedPremium,
    method: autoRenew ? "AUTO_DEBIT" : "MOCK",
    status: "PAID",
    paidAt: now,
    reference: `premium_${Date.now()}`
  });

  return { policy, premiumPayment };
}

async function buildPremiumQuote(rider, overrides = {}) {
  const premiumContext = {
    plan: overrides.plan || rider.plan,
    zoneCode: overrides.zoneCode || rider.zoneCode,
    city: overrides.city || rider.city,
    weeklyEarningsAverage:
      overrides.weeklyEarningsAverage !== undefined
        ? Number(overrides.weeklyEarningsAverage)
        : rider.weeklyEarningsAverage || 3500
  };

  const zoneRiskScore = await computeZoneRiskScore({
    zoneCode: premiumContext.zoneCode,
    city: premiumContext.city,
    planKey: premiumContext.plan
  });

  const consistencyScore = await computeConsistencyScore({ riderId: rider._id });

  const premium = calculatePremium({
    weeklyIncome: premiumContext.weeklyEarningsAverage,
    zoneRiskScore,
    planKey: premiumContext.plan,
    consistencyScore
  });

  const premiumRider = {
    ...rider.toObject(),
    ...premiumContext
  };

  const aiPremiumInsight = await generatePremiumInsight({
    rider: premiumRider,
    premium,
    zoneRiskScore,
    consistencyScore
  });

  return {
    premium,
    aiPremiumInsight,
    quoteInputs: premiumContext
  };
}

export async function getRiderDashboard(userId) {
  const rider = await RiderProfile.findOne({ userId }).populate("userId");
  if (!rider) {
    throw new ApiError(404, "Rider profile not found");
  }

  const [activeAlerts, recentClaims, recentPayouts, appeals, complaints, activePolicy, premiumPayments] = await Promise.all([
    Event.find({ ...buildAlertQuery(rider), status: { $in: ["APPROVED", "PROCESSING"] } }).sort({ detectedAt: -1 }).limit(5).lean(),
    Claim.find({ riderId: rider._id }).sort({ createdAt: -1 }).limit(5).populate("eventId").lean(),
    Payout.find({ riderId: rider._id }).sort({ createdAt: -1 }).limit(5).populate({ path: "claimId", populate: { path: "eventId" } }).lean(),
    Appeal.find({ riderId: rider._id }).sort({ createdAt: -1 }).limit(5).populate("claimId").lean(),
    Complaint.find({ riderId: rider._id }).sort({ createdAt: -1 }).limit(5).populate("relatedClaimId adjustmentPayoutId").lean(),
    findEffectiveActivePolicy(rider._id),
    PremiumPayment.find({ riderId: rider._id }).sort({ createdAt: -1 }).limit(5).lean()
  ]);

  const { premium, aiPremiumInsight } = await buildPremiumQuote(rider);

  const eligibilityStatus = {
    coveredToday: activeAlerts.some((alert) => PLAN_CONFIG[rider.plan]?.calamityTypes.includes(alert.eventType)),
    latestClaimDecision: recentClaims[0]?.decision || "NO_EVENT",
    openAppeals: appeals.filter((appeal) => ["OPEN", "UNDER_REVIEW"].includes(appeal.status)).length,
    openComplaints: complaints.filter((complaint) => ["OPEN", "UNDER_REVIEW"].includes(complaint.status)).length
  };

  return {
    rider,
    premium,
    activeAlerts,
    recentClaims,
    recentPayouts,
    appeals,
    complaints,
    eligibilityStatus,
    activePolicy,
    premiumPayments,
    aiPremiumInsight
  };
}

export async function updatePlan(userId, plan) {
  if (!PLAN_CONFIG[plan]) {
    throw new ApiError(400, "Invalid plan selected");
  }

  // Check if there's an active policy with lock-in period
  const rider = await RiderProfile.findOne({ userId });
  if (!rider) {
    throw new ApiError(404, "Rider profile not found");
  }

  const activePolicy = await findEffectiveActivePolicy(rider._id);

  // If there's an active policy, check lock-in period
  if (activePolicy) {
    const now = new Date();
    const lockInExpiryTime = new Date(activePolicy.lockInExpiryAt).getTime();
    const nowTime = now.getTime();

    if (nowTime < lockInExpiryTime) {
      const daysRemaining = Math.ceil((lockInExpiryTime - nowTime) / (1000 * 60 * 60 * 24));
      throw new ApiError(400, `Cannot change plan. Lock-in period expires in ${daysRemaining} days. Current plan: ${activePolicy.planKey}`);
    }
  }

  const updatedRider = await RiderProfile.findOneAndUpdate({ userId }, { plan }, { new: true });

  const { premium, aiPremiumInsight } = await buildPremiumQuote(updatedRider);

  return {
    rider: updatedRider,
    premium,
    aiPremiumInsight
  };
}

export async function subscribePolicy(userId, payload = {}) {
  const rider = await RiderProfile.findOne({ userId });
  if (!rider) {
    throw new ApiError(404, "Rider profile not found");
  }

  if (payload.plan && !PLAN_CONFIG[payload.plan]) {
    throw new ApiError(400, "Invalid plan selected");
  }

  if (payload.plan) {
    rider.plan = payload.plan;
    await rider.save();
  }

  const { premium, aiPremiumInsight } = await buildPremiumQuote(rider);

  const subscription = await ensurePolicy({
    rider,
    premium,
    autoRenew: Boolean(payload.autoRenew)
  });

  return {
    rider,
    premium,
    policy: subscription.policy,
    premiumPayment: subscription.premiumPayment,
    aiPremiumInsight
  };
}

export async function getRiderPremiumQuote(userId, payload = {}) {
  const rider = await RiderProfile.findOne({ userId });
  if (!rider) {
    throw new ApiError(404, "Rider profile not found");
  }

  return buildPremiumQuote(rider, payload);
}

export async function getAlerts(userId) {
  const rider = await RiderProfile.findOne({ userId });
  if (!rider) {
    throw new ApiError(404, "Rider profile not found");
  }

  return Event.find(buildAlertQuery(rider)).sort({ detectedAt: -1 }).limit(20).lean();
}

export async function getPayoutHistory(userId) {
  const rider = await RiderProfile.findOne({ userId });
  if (!rider) {
    throw new ApiError(404, "Rider profile not found");
  }

  return Payout.find({ riderId: rider._id })
    .sort({ createdAt: -1 })
    .populate({ path: "claimId", populate: { path: "eventId" } })
    .populate("complaintId")
    .lean();
}

export async function createAppeal(userId, payload) {
  const rider = await RiderProfile.findOne({ userId });
  if (!rider) {
    throw new ApiError(404, "Rider profile not found");
  }

  const claim = await Claim.findOne({ _id: payload.claimId, riderId: rider._id });
  if (!claim) {
    throw new ApiError(404, "Claim not found");
  }

  const allowedDecisions = ["REJECTED", "HOLD_RIDER_VERIFICATION"];
  if (!allowedDecisions.includes(claim.decision)) {
    throw new ApiError(400, "Only rejected or held claims can be appealed");
  }

  const appealDeadline = new Date(claim.updatedAt || claim.createdAt);
  appealDeadline.setHours(appealDeadline.getHours() + 48);
  if (appealDeadline < new Date()) {
    throw new ApiError(400, "Appeal window has expired");
  }

  const existingAppeal = await Appeal.findOne({
    claimId: claim._id,
    status: { $in: ["OPEN", "UNDER_REVIEW"] }
  });
  if (existingAppeal) {
    throw new ApiError(400, "This claim already has an open appeal");
  }

  claim.appealed = true;
  await claim.save();

  return Appeal.create({
    claimId: claim._id,
    riderId: rider._id,
    reason: payload.reason,
    attachments: payload.attachments || []
  });
}

export async function createComplaint(userId, payload) {
  const rider = await RiderProfile.findOne({ userId });
  if (!rider) {
    throw new ApiError(404, "Rider profile not found");
  }

  const openComplaintCount = await Complaint.countDocuments({
    riderId: rider._id,
    status: { $in: ["OPEN", "UNDER_REVIEW"] }
  });

  if (openComplaintCount >= 5) {
    throw new ApiError(400, "Too many open complaints. Please wait for review.");
  }

  let relatedClaimId;
  if (payload.relatedClaimId) {
    const relatedClaim = await Claim.findOne({ _id: payload.relatedClaimId, riderId: rider._id });
    if (!relatedClaim) {
      throw new ApiError(400, "Selected claim was not found for this rider");
    }
    relatedClaimId = relatedClaim._id;
  }

  return Complaint.create({
    riderId: rider._id,
    relatedClaimId,
    category: payload.category,
    subject: payload.subject,
    message: payload.message
  });
}

export async function getPlans() {
  return Object.values(PLAN_CONFIG).map((plan) => ({
    key: plan.key,
    weeklyPremiumBase: plan.weeklyPremiumBase,
    weeklyPayoutCap: plan.weeklyPayoutCap,
    daysCoveredPerWeek: plan.daysCoveredPerWeek,
    payoutTargetMinutes: plan.payoutTargetMinutes,
    calamityTypes: plan.calamityTypes
  }));
}

export async function syncProviderSnapshot(userId, payload) {
  const rider = await RiderProfile.findOne({ userId });
  if (!rider) {
    throw new ApiError(404, "Rider profile not found");
  }

  const gps = payload.currentGps || rider.currentGps;
  const status = payload.deliveryStatus || "IDLE";
  const now = new Date();
  const acceptedAt = new Date(now.getTime() - 20 * 60 * 1000);
  const pickupAt = new Date(now.getTime() - 10 * 60 * 1000);
  const estimatedDropAt = new Date(now.getTime() + 25 * 60 * 1000);
  const pickupLocation = gps;
  const dropLocation = payload.dropLocation || {
    lat: gps.lat + 0.01,
    lng: gps.lng + 0.01
  };

  rider.currentGps = gps;
  rider.routeHistory = [...(rider.routeHistory || []).slice(-20), gps];
  rider.motionTelemetry = {
    accelerometerScore: status === "IDLE" ? 0.15 : 0.72,
    gyroscopeScore: status === "IDLE" ? 0.1 : 0.69,
    averageSpeedKph: status === "IDLE" ? 0 : 22
  };

  rider.activeDelivery = {
    orderId: status === "IDLE" ? null : `ORD-${Date.now()}`,
    acceptedAt: status === "IDLE" ? null : acceptedAt,
    pickupAt: status === "PICKED_UP" ? pickupAt : status === "ACTIVE" ? null : null,
    estimatedDropAt: status === "IDLE" ? null : estimatedDropAt,
    status,
    routePolyline: status === "IDLE" ? [] : [pickupLocation, gps, dropLocation],
    pickupLocation: status === "IDLE" ? undefined : pickupLocation,
    dropLocation: status === "IDLE" ? undefined : dropLocation
  };

  rider.declaredShift = {
    active: status !== "IDLE",
    startedAt: status === "IDLE" ? rider.declaredShift?.startedAt : rider.declaredShift?.startedAt || acceptedAt,
    endedAt: status === "IDLE" ? now : null,
    source: "RIDER_DECLARED"
  };

  await rider.save();
  return rider;
}

export async function updateRiderLocation(userId, payload) {
  const rider = await RiderProfile.findOne({ userId });
  if (!rider) {
    throw new ApiError(404, "Rider profile not found");
  }

  if (
    typeof payload?.lat !== "number" ||
    typeof payload?.lng !== "number" ||
    Number.isNaN(payload.lat) ||
    Number.isNaN(payload.lng)
  ) {
    throw new ApiError(400, "Valid latitude and longitude are required");
  }

  rider.currentGps = {
    lat: payload.lat,
    lng: payload.lng
  };

  rider.routeHistory = [...(rider.routeHistory || []).slice(-49), rider.currentGps];
  await rider.save();

  return {
    currentGps: rider.currentGps,
    updatedAt: rider.updatedAt
  };
}

export async function updateRiderProfile(userId, payload = {}) {
  const rider = await RiderProfile.findOne({ userId });
  if (!rider) {
    throw new ApiError(404, "Rider profile not found");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User profile not found");
  }

  if (typeof payload.name === "string" && payload.name.trim()) {
    user.name = payload.name.trim();
  }
  if (typeof payload.phone === "string" && payload.phone.trim()) {
    user.phone = payload.phone.trim();
  }

  if (typeof payload.city === "string" && payload.city.trim()) {
    rider.city = normalizeCity(payload.city);
  }
  if (payload.zoneCode !== undefined) {
    const normalizedPin = normalizePin(payload.zoneCode);
    if (!isValidPin(normalizedPin)) {
      throw new ApiError(400, "Zone code must be a 6-digit PIN code");
    }
    rider.zoneCode = normalizedPin;
    if (!payload.city || !payload.city.trim()) {
      const derivedCity = cityFromPin(normalizedPin);
      if (derivedCity) {
        rider.city = normalizeCity(derivedCity);
      }
    }
  }
  if (typeof payload.upiId === "string" && payload.upiId.trim()) {
    rider.upiId = payload.upiId.trim();
  }
  if (typeof payload.provider === "string" && payload.provider.trim()) {
    rider.provider = payload.provider.trim().toUpperCase();
  }
  if (payload.weeklyEarningsAverage !== undefined) {
    const weekly = Number(payload.weeklyEarningsAverage);
    if (Number.isNaN(weekly) || weekly < 0) {
      throw new ApiError(400, "Weekly earnings average must be a valid number");
    }
    rider.weeklyEarningsAverage = weekly;
  }

  await Promise.all([user.save(), rider.save()]);
  const populatedRider = await RiderProfile.findById(rider._id).populate("userId").lean();
  return { rider: populatedRider, user };
}

export async function syncPinLocation(userId) {
  const rider = await RiderProfile.findOne({ userId }).populate("userId");
  if (!rider) {
    throw new ApiError(404, "Rider profile not found");
  }

  const pinMeta = PIN_GEO_MAP[rider.zoneCode];
  if (!pinMeta) {
    throw new ApiError(400, "No location mapping found for this PIN");
  }

  rider.city = normalizeCity(pinMeta.city);
  rider.currentGps = { lat: pinMeta.lat, lng: pinMeta.lng };
  rider.registeredZonePolygon = buildCirclePolygon(rider.currentGps, 5);

  await rider.save();
  return rider;
}
