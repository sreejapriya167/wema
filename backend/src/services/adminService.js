import { User } from "../models/User.js";
import { Event } from "../models/Event.js";
import { Claim } from "../models/Claim.js";
import { Payout } from "../models/Payout.js";
import { FraudLog } from "../models/FraudLog.js";
import { Appeal } from "../models/Appeal.js";
import { Complaint } from "../models/Complaint.js";
import { RiderProfile } from "../models/RiderProfile.js";
import { Policy } from "../models/Policy.js";
import { PremiumPayment } from "../models/PremiumPayment.js";
import { AdminSetting } from "../models/AdminSetting.js";
import { PLAN_CONFIG } from "../constants/plans.js";
import { fetchExternalSignalsSummary, ingestSocialEvent, ingestWeatherEvents, processApprovedEvent, runAutomaticWeatherSync } from "./eventDetectionService.js";
import { createAdjustmentPayout, releasePayoutForClaim } from "./payoutService.js";
import { ApiError } from "../utils/ApiError.js";
import { ALL_STATES, deriveStateFromCity, listStatesFromCities } from "../utils/geography.js";
import { PIN_GEO_MAP } from "../utils/pincode.js";

function startOfCurrentWeek() {
  const current = new Date();
  const day = current.getDay() || 7;
  current.setDate(current.getDate() - day + 1);
  current.setHours(0, 0, 0, 0);
  return current;
}

function formatCurrencyValue(value = 0) {
  return Number(value || 0);
}

function getTriggerColor(eventType = "") {
  const palette = {
    HEAVY_RAIN: "#2563EB",
    EXTREME_HEAT: "#F97316",
    FLOOD: "#1D4ED8",
    SEVERE_POLLUTION: "#6B7280",
    BANDH: "#DC2626",
    CURFEW: "#DC2626",
    STRIKE: "#DC2626",
    ZONE_CLOSURE: "#DC2626",
    EARTHQUAKE: "#7C3AED",
    CYCLONE: "#7F1D1D"
  };

  return palette[eventType] || "#2563EB";
}

function getTriggerLabel(eventType = "") {
  return eventType
    .toString()
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function getEligibilityLabel(claim) {
  if (!claim?.eligibilityChecks) {
    return "UNKNOWN";
  }

  if (claim.decision === "ADMIN_REVIEW" || claim.eventId?.sourceType === "SOCIAL") {
    return "MANUAL_CHECK";
  }

  return Object.values(claim.eligibilityChecks).every(Boolean) ? "VERIFIED" : "INELIGIBLE";
}

function buildSeverity(eventType, snapshot) {
  if (eventType === "CYCLONE") return { label: "SEVERE", factor: 1.5 };
  if (eventType === "FLOOD") return { label: "HIGH", factor: 1.3 };
  if (eventType === "EARTHQUAKE") return { label: "HIGH", factor: snapshot.magnitude >= 6 ? 1.5 : 1.25 };
  if (eventType === "EXTREME_HEAT") return { label: "MODERATE", factor: 1.15 };
  if (eventType === "SEVERE_POLLUTION") return { label: "MODERATE", factor: 1.1 };
  return { label: "MODERATE", factor: 1.0 };
}

function generateWeeklySeries({ payments = [], payouts = [] }) {
  const points = [];
  const currentWeekStart = startOfCurrentWeek();

  for (let index = 11; index >= 0; index -= 1) {
    const periodStart = new Date(currentWeekStart);
    periodStart.setDate(periodStart.getDate() - index * 7);
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 7);

    const collected = payments
      .filter((payment) => payment.createdAt >= periodStart && payment.createdAt < periodEnd)
      .reduce((total, payment) => total + payment.amount, 0);

    const paid = payouts
      .filter((payout) => payout.createdAt >= periodStart && payout.createdAt < periodEnd)
      .reduce((total, payout) => total + payout.amount, 0);

    points.push({
      label: `${periodStart.toLocaleString("en-IN", { month: "short" })} ${periodStart.getDate()}`,
      collected,
      paid
    });
  }

  return points;
}

async function ensureAdminSettings(state) {
  let settings = await AdminSetting.findOne({ state });
  if (!settings) {
    settings = await AdminSetting.create({ state });
  }
  return settings;
}

function filterByState(collection, cityAccessor) {
  return collection.filter((item) => deriveStateFromCity(cityAccessor(item)) !== "Unassigned");
}

function withinLast24Hours(timestamp) {
  return new Date(timestamp).getTime() >= Date.now() - 24 * 60 * 60 * 1000;
}

function overlapsEventWindow(shiftStart, events = []) {
  if (!shiftStart) {
    return false;
  }

  return events.some((event) => {
    const start = new Date(event.lossWindowStart).getTime();
    const end = new Date(event.lossWindowEnd).getTime();
    const shift = new Date(shiftStart).getTime();
    return shift >= start && shift <= end;
  });
}

function normalizeNotificationChannels(value) {
  if (!value || typeof value !== "object") {
    return { email: true, sms: false };
  }

  return {
    email: typeof value.email === "boolean" ? value.email : true,
    sms: typeof value.sms === "boolean" ? value.sms : false
  };
}

function minutesSince(value) {
  if (!value) return null;
  return Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
}

function deriveLatencyMs(lastUpdatedAt, baseline = 180) {
  const ageMinutes = minutesSince(lastUpdatedAt);
  if (ageMinutes === null) return null;
  return Math.min(2400, baseline + ageMinutes * 9);
}

function toSourceStatus({ connected, lastUpdatedAt, healthyWindowMinutes = 180, onlineLabel = "ONLINE", degradedLabel = "DEGRADED", offlineLabel = "OFFLINE" }) {
  if (!connected) {
    return offlineLabel;
  }

  const ageMinutes = minutesSince(lastUpdatedAt);
  if (ageMinutes === null) {
    return degradedLabel;
  }

  return ageMinutes <= healthyWindowMinutes ? onlineLabel : degradedLabel;
}

function average(numbers = []) {
  if (!numbers.length) return 0;
  return numbers.reduce((total, value) => total + value, 0) / numbers.length;
}

export async function getAdminDashboard(adminUserId, requestedState) {
  const adminUser = await User.findById(adminUserId);
  if (!adminUser) {
    throw new ApiError(404, "Admin user not found");
  }

  const normalizedNotificationChannels = normalizeNotificationChannels(
    adminUser.preferences?.notificationChannels
  );

  if (
    !adminUser.preferences ||
    adminUser.preferences.notificationChannels !== normalizedNotificationChannels
  ) {
    const safePreferences =
      adminUser.preferences && typeof adminUser.preferences === "object"
        ? adminUser.preferences
        : {};

    adminUser.preferences = {
      ...safePreferences,
      notificationChannels: normalizedNotificationChannels
    };

    await User.updateOne(
      { _id: adminUser._id },
      { $set: { "preferences.notificationChannels": normalizedNotificationChannels } }
    );
  }

  const [
    ridersRaw,
    eventsRaw,
    claimsRaw,
    payoutsRaw,
    fraudLogsRaw,
    appealsRaw,
    complaintsRaw,
    policiesRaw,
    premiumPaymentsRaw,
    signalSummary
  ] = await Promise.all([
    RiderProfile.find().populate("userId").lean(),
    Event.find().sort({ detectedAt: -1 }).lean(),
    Claim.find().sort({ createdAt: -1 }).populate("eventId riderId").lean(),
    Payout.find().sort({ createdAt: -1 }).populate("claimId riderId").lean(),
    FraudLog.find().sort({ createdAt: -1 }).populate("riderId eventId claimId").lean(),
    Appeal.find().sort({ createdAt: -1 }).populate({ path: "claimId", populate: { path: "eventId" } }).lean(),
    Complaint.find()
      .sort({ createdAt: -1 })
      .populate({ path: "riderId", populate: { path: "userId" } })
      .populate({ path: "relatedClaimId", populate: { path: "eventId" } })
      .populate("adjustmentPayoutId")
      .lean(),
    Policy.find().sort({ createdAt: -1 }).lean(),
    PremiumPayment.find().sort({ createdAt: -1 }).lean(),
    fetchExternalSignalsSummary()
  ]);

  const availableStates = listStatesFromCities([
    ...ridersRaw.map((rider) => rider.city),
    ...eventsRaw.map((event) => event.city)
  ]);

  const normalizedStates = ALL_STATES;
  const requestedScope = requestedState || adminUser.preferences?.selectedState || normalizedStates[0] || "All States";
  const selectedState = normalizedStates.includes(requestedScope) ? requestedScope : "All States";
  const settings = await ensureAdminSettings(selectedState);

  if (adminUser.preferences?.selectedState !== selectedState) {
    adminUser.preferences = {
      ...(adminUser.preferences && typeof adminUser.preferences === "object" ? adminUser.preferences : {}),
      selectedState,
      notificationChannels: normalizedNotificationChannels
    };
    await adminUser.save();
  }

  const riders = selectedState === "All States"
    ? ridersRaw
    : ridersRaw.filter((rider) => deriveStateFromCity(rider.city) === selectedState);
  const riderIds = riders.map((rider) => rider._id.toString());
  const events = selectedState === "All States"
    ? eventsRaw
    : eventsRaw.filter((event) => deriveStateFromCity(event.city) === selectedState);
  const eventIds = new Set(events.map((event) => event._id.toString()));
  const claims = claimsRaw.filter(
    (claim) =>
      riderIds.includes(claim.riderId?._id?.toString?.() || claim.riderId?.toString?.()) ||
      eventIds.has(claim.eventId?._id?.toString?.() || claim.eventId?.toString?.())
  );
  const claimIds = new Set(claims.map((claim) => claim._id.toString()));
  const payouts = payoutsRaw.filter(
    (payout) =>
      riderIds.includes(payout.riderId?._id?.toString?.() || payout.riderId?.toString?.()) ||
      claimIds.has(payout.claimId?._id?.toString?.() || payout.claimId?.toString?.())
  );
  const fraudLogs = fraudLogsRaw.filter(
    (entry) =>
      riderIds.includes(entry.riderId?._id?.toString?.() || entry.riderId?.toString?.()) ||
      eventIds.has(entry.eventId?._id?.toString?.() || entry.eventId?.toString?.())
  );
  const appeals = appealsRaw.filter((appeal) => claimIds.has(appeal.claimId?._id?.toString?.() || appeal.claimId?.toString?.()));
  const complaints = complaintsRaw.filter((complaint) =>
    riderIds.includes(complaint.riderId?._id?.toString?.() || complaint.riderId?.toString?.())
  );
  const policies = policiesRaw.filter((policy) => riderIds.includes(policy.riderId?.toString?.()));
  const premiumPayments = premiumPaymentsRaw.filter((payment) => riderIds.includes(payment.riderId?.toString?.()));

  const activeEvents = events.filter((event) => ["APPROVED", "PROCESSING", "PENDING_ADMIN_APPROVAL"].includes(event.status));
  const recentTriggerFeed = events.filter((event) => withinLast24Hours(event.detectedAt)).slice(0, 20);
  const weekStart = startOfCurrentWeek();

  const totalPayoutsThisWeek = payouts
    .filter((payout) => payout.createdAt >= weekStart)
    .reduce((total, payout) => total + payout.amount, 0);

  const totalPremiumCollected = premiumPayments.reduce((total, payment) => total + payment.amount, 0);
  const totalPaidOut = payouts.reduce((total, payout) => total + payout.amount, 0);
  const premiumPoolBalance = totalPremiumCollected - totalPaidOut;
  const projectedLiability = claims
    .filter((claim) => ["APPROVED", "ADMIN_REVIEW", "HOLD_RIDER_VERIFICATION"].includes(claim.decision))
    .reduce((total, claim) => total + claim.cappedPayout, 0);

  const claimsByEventId = claims.reduce((map, claim) => {
    const key = claim.eventId?._id?.toString?.() || claim.eventId?.toString?.();
    map.set(key, (map.get(key) || []).concat(claim));
    return map;
  }, new Map());

  const latestFraudByRider = fraudLogs.reduce((map, entry) => {
    const key = entry.riderId?._id?.toString?.() || entry.riderId?.toString?.();
    if (!map.has(key)) {
      map.set(key, entry);
    }
    return map;
  }, new Map());

  const triggerDefinitions = [
    { eventType: "HEAVY_RAIN", sourceApi: "OpenWeather", sourceType: "WEATHER" },
    { eventType: "FLOOD", sourceApi: "OpenWeather", sourceType: "WEATHER" },
    { eventType: "CYCLONE", sourceApi: "OpenWeather", sourceType: "WEATHER" },
    { eventType: "EARTHQUAKE", sourceApi: "USGS", sourceType: "WEATHER" },
    { eventType: "EXTREME_HEAT", sourceApi: "OpenWeather", sourceType: "WEATHER" },
    { eventType: "SEVERE_POLLUTION", sourceApi: "OpenWeather AQI", sourceType: "WEATHER" },
    { eventType: "BANDH", sourceApi: "Manual Ops", sourceType: "SOCIAL" },
    { eventType: "CURFEW", sourceApi: "Manual Ops", sourceType: "SOCIAL" },
    { eventType: "STRIKE", sourceApi: "Manual Ops", sourceType: "SOCIAL" },
    { eventType: "ZONE_CLOSURE", sourceApi: "Manual Ops", sourceType: "SOCIAL" }
  ];

  const triggerManagement = triggerDefinitions.map((definition) => {
    const matchingEvents = events.filter((event) => event.eventType === definition.eventType);
    const latestEvent = matchingEvents[0];
    const relatedClaims = latestEvent ? claimsByEventId.get(latestEvent._id.toString()) || [] : [];

    return {
      ...definition,
      label: getTriggerLabel(definition.eventType),
      currentStatus: latestEvent?.status || "INACTIVE",
      lastFiredTime: latestEvent?.detectedAt || null,
      affectedZone: latestEvent?.zoneCode || "None",
      eligibleRiders: relatedClaims.filter((claim) => getEligibilityLabel(claim) !== "INELIGIBLE").length,
      autoConfirmed: definition.sourceType === "WEATHER"
    };
  });

  const payoutQueue = claims
    .filter((claim) => ["ADMIN_REVIEW", "HOLD_RIDER_VERIFICATION", "APPROVED", "PAID", "REJECTED"].includes(claim.decision))
    .slice(0, 50)
    .map((claim) => {
      const rider = claim.riderId;
      const payout = payouts.find((item) => (item.claimId?._id?.toString?.() || item.claimId?.toString?.()) === claim._id.toString());
      return {
        _id: claim._id,
        riderName: rider?.userId?.name || "Unknown rider",
        city: rider?.city || "Unknown city",
        zone: rider?.zoneCode || "Unknown zone",
        calamityType: claim.eventId?.eventType || "Unknown",
        eligibility: getEligibilityLabel(claim),
        payoutAmount: claim.cappedPayout,
        transferStatus: payout?.status || "PENDING",
        decision: claim.decision,
        isSocialTrigger: claim.eventId?.sourceType === "SOCIAL",
        date: claim.createdAt,
        fraudRiskTier: claim.fraudRiskTier
      };
    });

  const riderManagement = riders.map((rider) => {
    const riderClaims = claims.filter((claim) => (claim.riderId?._id?.toString?.() || claim.riderId?.toString?.()) === rider._id.toString());
    const riderFraudLogs = fraudLogs.filter((entry) => (entry.riderId?._id?.toString?.() || entry.riderId?.toString?.()) === rider._id.toString());
    const latestFraud = riderFraudLogs[0];

    return {
      _id: rider._id,
      name: rider.userId?.name || "Unnamed rider",
      riderIdLabel: rider._id.toString().slice(-6).toUpperCase(),
      zone: rider.zoneCode,
      city: rider.city,
      plan: rider.plan,
      kycStatus: rider.userId?.aadhaarVerified ? "VERIFIED" : "PENDING",
      claimsCount: riderClaims.length,
      joinDate: rider.createdAt,
      manualFlag: rider.manualFlag?.flagged || false,
      fraudScore: latestFraud?.score || 0,
      shiftPattern: rider.declaredShift?.active ? "ACTIVE_SHIFT" : "OFF_SHIFT",
      deviceInfo: {
        deviceFingerprint: rider.deviceFingerprint,
        ipAddress: rider.ipAddress,
        networkType: rider.networkType
      },
      profile: {
        deliveryHistory: rider.routeHistory?.slice(-5) || [],
        claimHistory: riderClaims.slice(0, 5),
        fraudTrend: riderFraudLogs.slice(0, 6).map((entry) => ({
          score: entry.score,
          riskTier: entry.riskTier,
          at: entry.createdAt
        })),
        shiftInfo: rider.declaredShift,
        currentGps: rider.currentGps
      }
    };
  });

  const fraudFlags = fraudLogs
    .filter((entry) => ["MEDIUM", "HIGH", "REPEAT_HIGH"].includes(entry.riskTier))
    .slice(0, 50)
    .map((entry) => ({
      _id: entry._id,
      rider: entry.riderId?.userId?.name || "Unknown rider",
      riderId: entry.riderId?._id,
      zone: entry.riderId?.zoneCode || entry.eventId?.zoneCode || "Unknown zone",
      anomalyScore: entry.score,
      riskTier: entry.riskTier,
      reason: entry.explanation?.join(", ") || "Anomaly detected",
      claimId: entry.claimId?._id || entry.claimId,
      date: entry.createdAt
    }));

  const clusterAlerts = fraudLogs
    .filter((entry) => entry.clusterContext?.suspiciousZoneBurst || entry.clusterContext?.sharedDeviceCount > 1 || entry.clusterContext?.sharedIpCount > 1)
    .slice(0, 10)
    .map((entry) => ({
      _id: entry._id,
      zone: entry.riderId?.zoneCode || entry.eventId?.zoneCode || "Unknown zone",
      sharedIpCount: entry.clusterContext?.sharedIpCount || 0,
      sharedDeviceCount: entry.clusterContext?.sharedDeviceCount || 0,
      rider: entry.riderId?.userId?.name || "Unknown rider"
    }));

  const shiftActivity = riders.map((rider) => ({
    riderId: rider._id,
    rider: rider.userId?.name || "Unknown rider",
    city: rider.city,
    zone: rider.zoneCode,
    shiftActive: Boolean(rider.declaredShift?.active),
    shiftStart: rider.declaredShift?.startedAt || rider.activeDelivery?.acceptedAt || null,
    shiftEnd: rider.declaredShift?.endedAt || rider.activeDelivery?.estimatedDropAt || null,
    anomalyFlag: overlapsEventWindow(rider.declaredShift?.startedAt || rider.activeDelivery?.acceptedAt, activeEvents) && rider.historicalFraudFlags > 0
  }));

  const alertLog = events.slice(0, 100).map((event) => ({
    _id: event._id,
    timestamp: event.detectedAt,
    source: event.triggerSource,
    dataType: getTriggerLabel(event.eventType),
    region: `${event.city} / ${event.zoneCode}`,
    status: event.status,
    actionTaken: event.adminDecision?.note || (event.status === "APPROVED" ? "Auto-confirmed" : "Awaiting action")
  }));

  const latestWeatherEvent = events.find((event) => event.sourceType === "WEATHER");
  const latestSocialEvent = events.find((event) => event.sourceType === "SOCIAL");
  const latestPlatformTouch = riders
    .map((rider) => rider.updatedAt || rider.declaredShift?.startedAt || rider.createdAt)
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
  const activeShiftCount = shiftActivity.filter((shift) => shift.shiftActive).length;
  const pendingPayoutReviews = payoutQueue.filter((item) => ["ADMIN_REVIEW", "HOLD_RIDER_VERIFICATION"].includes(item.decision)).length;
  const pendingSocialAlerts = events.filter((event) => event.sourceType === "SOCIAL" && ["DETECTED", "PENDING_ADMIN_APPROVAL"].includes(event.status));
  const recentClaimProcessingTimes = claims
    .filter((claim) => claim.eventId?.detectedAt && claim.createdAt)
    .slice(0, 20)
    .map((claim) => Math.max(0, new Date(claim.createdAt).getTime() - new Date(claim.eventId.detectedAt).getTime()));
  const verifiedClaimRatio = claims.length
    ? claims.filter((claim) => getEligibilityLabel(claim) === "VERIFIED").length / claims.length
    : 0;
  const confidenceScore = Number(
    Math.min(
      99.4,
      70 + verifiedClaimRatio * 18 + (recentTriggerFeed.length ? activeEvents.length / recentTriggerFeed.length : 0) * 8 + (pendingSocialAlerts.length ? 2 : 5)
    ).toFixed(1)
  );
  const riderGrowthCurrent = riders.filter((rider) => new Date(rider.createdAt).getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000).length;
  const riderGrowthPrevious = riders.filter((rider) => {
    const createdAt = new Date(rider.createdAt).getTime();
    const now = Date.now();
    return createdAt < now - 30 * 24 * 60 * 60 * 1000 && createdAt >= now - 60 * 24 * 60 * 60 * 1000;
  }).length;
  const riderGrowthPct = riderGrowthPrevious
    ? Number((((riderGrowthCurrent - riderGrowthPrevious) / riderGrowthPrevious) * 100).toFixed(1))
    : riderGrowthCurrent > 0
      ? 100
      : 0;

  const dataSourceHealth = [
    {
      key: "WEATHER_API",
      label: "Weather API",
      status: toSourceStatus({
        connected: Boolean(signalSummary?.configured),
        lastUpdatedAt: latestWeatherEvent?.detectedAt,
        healthyWindowMinutes: 240
      }),
      latencyMs: deriveLatencyMs(latestWeatherEvent?.detectedAt, 220),
      lastUpdatedAt: latestWeatherEvent?.detectedAt || null,
      note: signalSummary?.weatherReachable
        ? (latestWeatherEvent ? `${getTriggerLabel(latestWeatherEvent.eventType)} processed for ${latestWeatherEvent.zoneCode}` : "Waiting for the next verified weather trigger.")
        : "OpenWeather is configured but was not reachable during the latest backend check."
    },
    {
      key: "PLATFORM_API",
      label: "Platform API",
      status: toSourceStatus({
        connected: riders.length > 0,
        lastUpdatedAt: latestPlatformTouch,
        healthyWindowMinutes: 180,
        onlineLabel: activeShiftCount > 0 ? "SYNCED" : "ONLINE",
        degradedLabel: "DELAYED",
        offlineLabel: "OFFLINE"
      }),
      latencyMs: deriveLatencyMs(latestPlatformTouch, 180),
      lastUpdatedAt: latestPlatformTouch || null,
      note: `${activeShiftCount} active shifts currently feeding delivery telemetry.`
    },
    {
      key: "NEWS_API",
      label: "News API",
      status: toSourceStatus({
        connected: Boolean(latestSocialEvent),
        lastUpdatedAt: latestSocialEvent?.detectedAt,
        healthyWindowMinutes: 720,
        onlineLabel: "MONITORING",
        degradedLabel: "QUIET",
        offlineLabel: "OFFLINE"
      }),
      latencyMs: deriveLatencyMs(latestSocialEvent?.detectedAt, 260),
      lastUpdatedAt: latestSocialEvent?.detectedAt || null,
      note: latestSocialEvent ? `${getTriggerLabel(latestSocialEvent.eventType)} spotted in ${latestSocialEvent.city}` : "No recent social disruption ingestions yet."
    },
    {
      key: "FRAUD_MODEL",
      label: "Fraud Model",
      status: signalSummary?.fraudModel?.reachable ? "ONLINE" : "FALLBACK",
      latencyMs: null,
      lastUpdatedAt: new Date(),
      note: signalSummary?.fraudModel?.reachable
        ? `${signalSummary.fraudModel.modelName} (${signalSummary.fraudModel.modelVersion}) is scoring live fraud requests.`
        : signalSummary?.fraudModel?.note || "Fallback rule scoring is active."
    }
  ];

  const logicEngine = {
    updatedAt: latestWeatherEvent?.detectedAt || latestSocialEvent?.detectedAt || new Date(),
    confidenceScore,
    processingTimeMs: Math.round(average(recentClaimProcessingTimes)),
    activeRules: [
      { keyword: "IF", text: `weather severity crosses ${settings.triggerThresholds.heavyRainLevel} or AQI exceeds ${settings.triggerThresholds.severePollutionAqi}` },
      { keyword: "AND", text: `${activeShiftCount} rider shifts and ${pendingSocialAlerts.length} pending social alerts are cross-checked against zone overlap and ${signalSummary?.fraudModel?.scoringMode === "ML_SERVICE" ? "live ML fraud scoring" : "backend fallback fraud rules"}` },
      { keyword: "THEN", text: `create protected trigger for ${activeEvents.length} active zones and route ${pendingPayoutReviews} cases into review` }
    ]
  };

  const socialTriggerPanel = pendingSocialAlerts.slice(0, 12).map((event) => {
    const affectedRiders = riders
      .filter((rider) => rider.zoneCode === event.zoneCode)
      .slice(0, 6)
      .map((rider) => ({
        _id: rider._id,
        name: rider.userId?.name || "Unknown rider",
        plan: rider.plan,
        shiftActive: Boolean(rider.declaredShift?.active),
        city: rider.city
      }));

    return {
      _id: event._id,
      title: `${getTriggerLabel(event.eventType)} in ${event.city}`,
      source: event.triggerSource,
      sourceType: event.sourceType,
      status: event.status,
      locationLabel: `${event.city} / ${event.zoneCode}`,
      city: event.city,
      zoneCode: event.zoneCode,
      impactProjection: {
        affectedRiders: riders.filter((rider) => rider.zoneCode === event.zoneCode).length,
        confidence: Number(Math.min(99, 62 + event.severity.factor * 12).toFixed(1)),
        projectedDropPercent: Math.round(event.severity.factor * 12)
      },
      summary: event.adminDecision?.note || `${event.triggerSource} pushed this event for manual confirmation.`,
      detectedAt: event.detectedAt,
      center: event.center,
      severity: event.severity,
      affectedRiders
    };
  });

  const activityFeed = [
    ...payouts.slice(0, 6).map((payout) => ({
      _id: `payout-${payout._id}`,
      type: "PAYOUT",
      title: `Payout ${payout.status.toLowerCase()} for ${formatCurrencyValue(payout.amount)}`,
      detail: payout.riderId?.userId?.name || payout.riderId?.city || "Rider payment update",
      timestamp: payout.createdAt,
      tone: payout.status === "PAID" ? "SUCCESS" : payout.status
    })),
    ...fraudLogs.slice(0, 6).map((entry) => ({
      _id: `fraud-${entry._id}`,
      type: "FRAUD",
      title: `${entry.riskTier} fraud signal detected`,
      detail: entry.explanation?.join(", ") || "Risk engine raised a manual review flag",
      timestamp: entry.createdAt,
      tone: entry.riskTier
    })),
    ...recentTriggerFeed.slice(0, 6).map((event) => ({
      _id: `trigger-${event._id}`,
      type: "TRIGGER",
      title: `${getTriggerLabel(event.eventType)} trigger received`,
      detail: `${event.city} / ${event.zoneCode}`,
      timestamp: event.detectedAt,
      tone: event.status
    })),
    ...riders.slice(0, 4).map((rider) => ({
      _id: `rider-${rider._id}`,
      type: "RIDER",
      title: "New rider onboarded",
      detail: rider.userId?.name || rider.city || "Rider profile added",
      timestamp: rider.createdAt,
      tone: rider.userId?.aadhaarVerified ? "VERIFIED" : "PENDING"
    }))
  ]
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 12);

  const riderStats = {
    growthPct: riderGrowthPct,
    totalVerified: riders.filter((rider) => rider.userId?.aadhaarVerified).length,
    pendingKyc: riders.filter((rider) => !rider.userId?.aadhaarVerified).length,
    activeClaims: claims.filter((claim) => ["ADMIN_REVIEW", "HOLD_RIDER_VERIFICATION", "APPROVED"].includes(claim.decision)).length
  };

  const alertConfirmation = socialTriggerPanel[0]
    ? {
        ...socialTriggerPanel[0],
        mapSummary: `Impact map centered at ${socialTriggerPanel[0].city} / ${socialTriggerPanel[0].zoneCode}`,
        automatedResponse: `Protection filters will evaluate ${socialTriggerPanel[0].impactProjection.affectedRiders} riders in this zone immediately after confirmation.`
      }
    : null;

  const settingsPayload = {
    triggerThresholds: settings.triggerThresholds,
    payoutCaps: settings.payoutCaps,
    notificationPreferences: settings.notificationPreferences,
    reserveBufferTarget: settings.reserveBufferTarget,
    safePoolThreshold: settings.safePoolThreshold,
    autoApproveLowRisk: settings.autoApproveLowRisk,
    apiStatus: dataSourceHealth.reduce((result, source) => ({
      ...result,
      [source.key]: source.status
    }), {}),
    adminUsers: [
      {
        _id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: "SUPER_ADMIN",
        state: selectedState
      }
    ]
  };

  return {
    adminScope: {
      availableStates: normalizedStates,
      selectedState,
      theme: adminUser.preferences?.adminTheme || "dark",
      adminName: adminUser.name
    },
    metrics: {
      totalRegisteredRiders: riders.length,
      ridersInActiveCalamityZone: new Set(
        claims
          .filter((claim) => ["APPROVED", "ADMIN_REVIEW", "HOLD_RIDER_VERIFICATION", "PAID"].includes(claim.decision))
          .map((claim) => claim.riderId?._id?.toString?.() || claim.riderId?.toString?.())
      ).size,
      totalPayoutsThisWeek: formatCurrencyValue(totalPayoutsThisWeek),
      premiumPoolBalance: formatCurrencyValue(premiumPoolBalance)
    },
    generatedAt: new Date(),
    systemStatus: {
      label: dataSourceHealth.every((source) => ["ONLINE", "SYNCED", "MONITORING"].includes(source.status)) ? "Monitoring Active" : "Needs Attention",
      note: `${pendingSocialAlerts.length} social alerts pending confirmation and ${pendingPayoutReviews} payout reviews waiting.`,
      lastUpdatedAt: new Date(),
      healthyFeeds: dataSourceHealth.filter((source) => !["OFFLINE", "DOWN"].includes(source.status)).length,
      totalFeeds: dataSourceHealth.length
    },
    recentTriggerFeed: recentTriggerFeed.map((event) => ({
      _id: event._id,
      eventType: event.eventType,
      label: getTriggerLabel(event.eventType),
      color: getTriggerColor(event.eventType),
      city: event.city,
      zoneCode: event.zoneCode,
      status: event.status,
      detectedAt: event.detectedAt,
      sourceType: event.sourceType,
      triggerSource: event.triggerSource,
      eligibleRiders: (claimsByEventId.get(event._id.toString()) || []).filter((claim) => getEligibilityLabel(claim) !== "INELIGIBLE").length
    })),
    mapTriggers: activeEvents.map((event) => ({
      _id: event._id,
      label: getTriggerLabel(event.eventType),
      eventType: event.eventType,
      color: getTriggerColor(event.eventType),
      lat: event.center?.lat,
      lng: event.center?.lng,
      city: event.city,
      zoneCode: event.zoneCode,
      eligibleRiders: (claimsByEventId.get(event._id.toString()) || []).filter((claim) => getEligibilityLabel(claim) !== "INELIGIBLE").length
    })),
    activeEvents,
    triggerManagement,
    socialTriggerPanel,
    logicEngine,
    dataSourceHealth,
    activityFeed,
    alertConfirmation,
    triggerHistory: events.slice(0, 100).map((event) => ({
      _id: event._id,
      eventType: event.eventType,
      label: getTriggerLabel(event.eventType),
      sourceApi: event.triggerSource,
      currentStatus: event.status,
      lastFiredTime: event.detectedAt,
      affectedZone: event.zoneCode,
      sourceType: event.sourceType
    })),
    payoutQueue,
    riderManagement,
    riderStats,
    fraudManagement: {
      flags: fraudFlags,
      clusterAlerts,
      trend: riderManagement.slice(0, 12).map((rider) => ({
        rider: rider.name,
        latestScore: rider.fraudScore,
        zone: rider.zone
      }))
    },
    fraudAlerts: fraudFlags,
    premiumPoolHealth: {
      weeklyCollected: premiumPayments
        .filter((payment) => payment.createdAt >= weekStart)
        .reduce((total, payment) => total + payment.amount, 0),
      weeklyPaidOut: totalPayoutsThisWeek,
      reserveBuffer: premiumPoolBalance * settings.reserveBufferTarget,
      projectedLiability,
      safeThresholdBreached: premiumPoolBalance < settings.safePoolThreshold,
      chart: generateWeeklySeries({ payments: premiumPayments, payouts })
    },
    shiftActivity,
    alertLog,
    openAppeals: appeals.filter((appeal) => ["OPEN", "UNDER_REVIEW"].includes(appeal.status)),
    openComplaints: complaints.filter((complaint) => ["OPEN", "UNDER_REVIEW"].includes(complaint.status)),
    appeals,
    complaints,
    settings: settingsPayload,
    rawCollections: {
      events: events.length,
      claims: claims.length,
      payouts: payouts.length,
      fraudLogs: fraudLogs.length,
      policies: policies.length
    }
  };
}

export async function decideSocialTrigger(eventId, adminId, approved, note) {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new ApiError(404, "Event not found");
  }

  event.status = approved ? "APPROVED" : "REJECTED";
  event.adminDecision = { decidedBy: adminId, note, decidedAt: new Date() };
  await event.save();

  if (approved) {
    return processApprovedEvent(eventId);
  }

  return { event };
}

export async function reviewClaim(claimId, approved, note) {
  const claim = await Claim.findById(claimId);
  if (!claim) {
    throw new ApiError(404, "Claim not found");
  }

  claim.adminReviewNote = note;
  claim.decision = approved ? "APPROVED" : "REJECTED";
  await claim.save();

  let payout = null;
  if (approved) {
    payout = await releasePayoutForClaim(claim._id);
  }

  return { claim, payout };
}

export async function createManualEvent(payload) {
  if (payload.sourceType === "SOCIAL") {
    return ingestSocialEvent(payload);
  }

  const created = await ingestWeatherEvents(payload);
  return Array.isArray(created) ? created[0] : created;
}

export async function processEventByAdmin(eventId) {
  return processApprovedEvent(eventId);
}

export async function reviewAppeal(appealId, approved, resolutionNote) {
  const appeal = await Appeal.findById(appealId).populate("claimId");
  if (!appeal) {
    throw new ApiError(404, "Appeal not found");
  }

  appeal.status = approved ? "RESOLVED" : "REJECTED";
  appeal.resolutionNote = resolutionNote;
  await appeal.save();

  let payout = null;
  if (approved && appeal.claimId) {
    appeal.claimId.decision = "APPROVED";
    appeal.claimId.adminReviewNote = resolutionNote;
    await appeal.claimId.save();
    payout = await releasePayoutForClaim(appeal.claimId._id);
  }

  return { appeal, payout };
}

export async function reviewComplaint(complaintId, approved, resolutionNote, adjustmentAmount = 0) {
  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    throw new ApiError(404, "Complaint not found");
  }

  complaint.status = approved ? "RESOLVED" : "REJECTED";
  complaint.resolutionNote = resolutionNote;
  complaint.adjustmentAmount = 0;

  let payout = null;
  const normalizedAdjustment = Number(adjustmentAmount || 0);
  if (approved && complaint.category === "WRONG_CALCULATION" && normalizedAdjustment > 0) {
    payout = await createAdjustmentPayout({
      riderId: complaint.riderId,
      amount: normalizedAdjustment,
      claimId: complaint.relatedClaimId || null,
      complaintId: complaint._id,
      description: "Adjustment credited after complaint review"
    });
    complaint.adjustmentAmount = normalizedAdjustment;
    complaint.adjustmentPayoutId = payout?._id || null;
  }

  await complaint.save();

  return { complaint, payout };
}

export async function triggerAutomaticWeatherSync() {
  return runAutomaticWeatherSync();
}

export async function updateAdminPreferences(adminUserId, payload) {
  const adminUser = await User.findById(adminUserId);
  if (!adminUser) {
    throw new ApiError(404, "Admin user not found");
  }

  const incomingChannels = normalizeNotificationChannels(payload?.notificationChannels);
  const currentPreferences =
    adminUser.preferences && typeof adminUser.preferences === "object"
      ? adminUser.preferences
      : {};

  adminUser.preferences = {
    ...currentPreferences,
    ...(payload.theme ? { adminTheme: payload.theme } : {}),
    ...(payload.selectedState ? { selectedState: payload.selectedState } : {}),
    notificationChannels: {
      email: incomingChannels.email,
      sms: incomingChannels.sms
    }
  };

  await adminUser.save();
  return adminUser.preferences;
}

export async function updateAdminSettings(selectedState, payload) {
  const settings = await ensureAdminSettings(selectedState);

  if (payload.triggerThresholds) {
    settings.triggerThresholds = {
      ...settings.triggerThresholds.toObject?.(),
      ...payload.triggerThresholds
    };
  }

  if (payload.payoutCaps) {
    settings.payoutCaps = {
      ...settings.payoutCaps.toObject?.(),
      ...payload.payoutCaps
    };
  }

  if (payload.notificationPreferences) {
    settings.notificationPreferences = {
      ...settings.notificationPreferences.toObject?.(),
      ...payload.notificationPreferences
    };
  }

  if (typeof payload.reserveBufferTarget === "number") {
    settings.reserveBufferTarget = payload.reserveBufferTarget;
  }

  if (typeof payload.safePoolThreshold === "number") {
    settings.safePoolThreshold = payload.safePoolThreshold;
  }

  if (typeof payload.autoApproveLowRisk === "boolean") {
    settings.autoApproveLowRisk = payload.autoApproveLowRisk;
  }

  await settings.save();
  return settings;
}

export async function updateRiderFlag(riderId, flagged, reason) {
  const rider = await RiderProfile.findById(riderId).populate("userId");
  if (!rider) {
    throw new ApiError(404, "Rider not found");
  }

  rider.manualFlag = {
    flagged,
    reason: flagged ? reason || "Flagged by admin review" : "",
    flaggedAt: flagged ? new Date() : null
  };

  if (rider.userId) {
    rider.userId.status = flagged ? "SUSPENDED" : rider.userId.aadhaarVerified ? "ACTIVE" : "PENDING_VERIFICATION";
    await rider.userId.save();
  }

  await rider.save();
  return rider;
}

export async function seedDemoData(selectedState = "All States") {
  const demoPins = Object.entries(PIN_GEO_MAP);
  const filteredPins = demoPins.filter(([, meta]) =>
    selectedState === "All States" ? true : deriveStateFromCity(meta.city) === selectedState
  );

  const eventTypes = [
    "HEAVY_RAIN",
    "FLOOD",
    "EXTREME_HEAT",
    "SEVERE_POLLUTION",
    "CYCLONE",
    "EARTHQUAKE"
  ];

  const now = new Date();
  const createdEvents = [];
  const createdClaims = [];

  for (let index = 0; index < filteredPins.length; index += 1) {
    const [pin, meta] = filteredPins[index];
    const eventType = eventTypes[index % eventTypes.length];
    const recent = await Event.findOne({
      zoneCode: pin,
      eventType,
      createdAt: { $gte: new Date(Date.now() - 6 * 60 * 60 * 1000) }
    }).lean();
    if (recent) continue;

    const lossWindowEnd = new Date(now);
    lossWindowEnd.setHours(lossWindowEnd.getHours() + 2);

    const event = await Event.create({
      sourceType: "WEATHER",
      eventType,
      city: meta.city,
      zoneCode: pin,
      center: { lat: meta.lat, lng: meta.lng },
      radiusKm: 6,
      affectedPolygon: [
        { lat: meta.lat + 0.02, lng: meta.lng },
        { lat: meta.lat, lng: meta.lng + 0.02 },
        { lat: meta.lat - 0.02, lng: meta.lng },
        { lat: meta.lat, lng: meta.lng - 0.02 }
      ],
      severity: buildSeverity(eventType, {}),
      thresholdSnapshot: { demoSeed: true },
      status: "APPROVED",
      triggerSource: "DEMO_SEED",
      detectedAt: now,
      lossWindowStart: now,
      lossWindowEnd
    });

    createdEvents.push(event);
    const processed = await processApprovedEvent(event._id);
    createdClaims.push(...processed.results);
  }

  const anyClaim = await Claim.findOne({}).sort({ createdAt: -1 }).lean();
  if (anyClaim && anyClaim.riderId && anyClaim.eventId) {
    await FraudLog.create({
      riderId: anyClaim.riderId,
      eventId: anyClaim.eventId,
      claimId: anyClaim._id,
      score: 86,
      riskTier: "HIGH",
      explanation: ["GPS mismatch", "Earnings outlier"],
      clusterContext: { sharedIpCount: 3, sharedDeviceCount: 2, suspiciousZoneBurst: true }
    });
  }

  return { events: createdEvents.length, claims: createdClaims.length };
}
