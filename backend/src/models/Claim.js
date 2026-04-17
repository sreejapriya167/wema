import mongoose from "mongoose";
import { CLAIM_STATUS, RISK_TIERS } from "../constants/eventTypes.js";

const claimSchema = new mongoose.Schema(
  {
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: "RiderProfile", required: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    eligibilityChecks: {
      gpsInsideRadius: { type: Boolean, default: false },
      zoneOverlap: { type: Boolean, default: false },
      activeDelivery: { type: Boolean, default: false },
      fraudCleared: { type: Boolean, default: false }
    },
    baseline: {
      averageHourlyEarnings: { type: Number, default: 0 },
      comparedSlots: { type: Number, default: 0 },
      comparedOrdersAverage: { type: Number, default: 0 }
    },
    lossWindowHours: { type: Number, default: 0 },
    severityFactor: { type: Number, default: 1 },
    calculatedPayout: { type: Number, default: 0 },
    cappedPayout: { type: Number, default: 0 },
    decision: {
      type: String,
      enum: Object.values(CLAIM_STATUS),
      default: CLAIM_STATUS.REJECTED
    },
    fraudRiskTier: {
      type: String,
      enum: Object.values(RISK_TIERS),
      default: RISK_TIERS.LOW
    },
    fraudScore: { type: Number, default: 0 },
    rejectionReason: { type: String },
    riderVerificationRequested: { type: [String], default: [] },
    appealed: { type: Boolean, default: false },
    adminReviewNote: { type: String }
  },
  { timestamps: true }
);

export const Claim = mongoose.model("Claim", claimSchema);

