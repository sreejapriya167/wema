import axios from "axios";
import { env } from "../config/env.js";
import { FraudLog } from "../models/FraudLog.js";

const fraudClient = axios.create({
  baseURL: env.fraudServiceUrl,
  timeout: 5000
});

function buildFallbackFraudResult({ rider, clusterContext }) {
  const fallbackScore = Math.min(
    0.99,
    0.1 +
      (rider.historicalFraudFlags || 0) * 0.12 +
      (clusterContext.sharedDeviceCount > 1 ? 0.2 : 0) +
      (clusterContext.sharedIpCount > 2 ? 0.2 : 0)
  );

  return {
    score: fallbackScore,
    risk_tier: fallbackScore > 0.8 ? "HIGH" : fallbackScore > 0.55 ? "MEDIUM" : "LOW",
    explanations: ["Fallback risk model used because fraud service was unavailable"],
    model_name: "RuleFallback",
    model_version: "rules-v1",
    scoring_mode: "RULE_FALLBACK"
  };
}

export async function scoreFraud({ rider, event, historicalRisk, clusterContext }) {
  const payload = {
    rider_id: rider._id.toString(),
    event_id: event._id.toString(),
    event_type: event.eventType,
    source_type: event.sourceType,
    device_fingerprint: rider.deviceFingerprint,
    current_gps: rider.currentGps,
    delivery_route: rider.activeDelivery?.routePolyline || [],
    route_history: rider.routeHistory || [],
    accelerometer_score: rider.motionTelemetry?.accelerometerScore || 0,
    gyroscope_score: rider.motionTelemetry?.gyroscopeScore || 0,
    average_speed_kph: rider.motionTelemetry?.averageSpeedKph || 0,
    ip_address: rider.ipAddress,
    network_type: rider.networkType,
    accepted_at: rider.activeDelivery?.acceptedAt,
    pickup_at: rider.activeDelivery?.pickupAt,
    event_detected_at: event.detectedAt,
    historical_claim_rate: rider.historicalClaimRate || 0,
    historical_fraud_flags: rider.historicalFraudFlags || 0,
    cluster_context: clusterContext,
    weather_cross_verification: historicalRisk.weatherCrossVerification
  };

  let result;

  try {
    const [{ data: scoreData }, { data: modelData }] = await Promise.all([
      fraudClient.post("/score", payload),
      fraudClient.get("/model-info")
    ]);

    result = {
      ...scoreData,
      model_name: modelData?.model?.model_name || "IsolationForest",
      model_version: modelData?.model?.model_version || "unknown",
      scoring_mode: "ML_SERVICE"
    };
  } catch (_error) {
    result = buildFallbackFraudResult({ rider, clusterContext });
  }

  return {
    score: result.score,
    riskTier: result.risk_tier,
    explanations: result.explanations || [],
    requiresAdditionalVerification: Boolean(result.requires_additional_verification),
    scoringEngine: result.scoring_mode === "ML_SERVICE" ? "python-fraud-service" : "backend-fallback",
    scoringModel: result.model_name || "unknown",
    scoringMode: result.scoring_mode || "unknown",
    modelVersion: result.model_version || "unknown"
  };
}

export async function fetchFraudServiceSummary() {
  if (!env.fraudServiceUrl) {
    return {
      configured: false,
      reachable: false,
      scoringMode: "RULE_FALLBACK",
      modelName: "RuleFallback",
      modelVersion: "rules-v1",
      note: "FRAUD_SERVICE_URL is not configured."
    };
  }

  try {
    const { data } = await fraudClient.get("/health");
    return {
      configured: true,
      reachable: Boolean(data?.success),
      scoringMode: "ML_SERVICE",
      modelName: data?.model?.model_name || "IsolationForest",
      modelVersion: data?.model?.model_version || "unknown",
      featureCount: data?.model?.feature_count || 0,
      note: "Python fraud scoring service is reachable."
    };
  } catch (_error) {
    return {
      configured: true,
      reachable: false,
      scoringMode: "RULE_FALLBACK",
      modelName: "RuleFallback",
      modelVersion: "rules-v1",
      note: "Python fraud scoring service is unavailable, so backend fallback rules will be used."
    };
  }
}

export async function logFraudAssessment({
  riderId,
  eventId,
  claimId,
  signals,
  clusterContext,
  score,
  riskTier,
  explanation,
  scoringEngine,
  scoringModel,
  scoringMode
}) {
  return FraudLog.create({
    riderId,
    eventId,
    claimId,
    signals,
    clusterContext,
    score,
    scoringEngine,
    scoringModel,
    scoringMode,
    riskTier,
    explanation
  });
}
