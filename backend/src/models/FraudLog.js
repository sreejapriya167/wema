import mongoose from "mongoose";
import { RISK_TIERS } from "../constants/eventTypes.js";

const fraudLogSchema = new mongoose.Schema(
  {
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: "RiderProfile", required: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    claimId: { type: mongoose.Schema.Types.ObjectId, ref: "Claim" },
    signals: { type: mongoose.Schema.Types.Mixed, default: {} },
    clusterContext: {
      sharedIpCount: { type: Number, default: 0 },
      sharedDeviceCount: { type: Number, default: 0 },
      suspiciousZoneBurst: { type: Boolean, default: false }
    },
    score: { type: Number, default: 0 },
    scoringEngine: { type: String, default: "unknown" },
    scoringModel: { type: String, default: "unknown" },
    scoringMode: {
      type: String,
      enum: ["ML_SERVICE", "RULE_FALLBACK", "unknown"],
      default: "unknown"
    },
    riskTier: {
      type: String,
      enum: Object.values(RISK_TIERS),
      default: RISK_TIERS.LOW
    },
    explanation: { type: [String], default: [] }
  },
  { timestamps: true }
);

export const FraudLog = mongoose.model("FraudLog", fraudLogSchema);

