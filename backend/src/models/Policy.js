import mongoose from "mongoose";
import { PLAN_CONFIG } from "../constants/plans.js";

const policySchema = new mongoose.Schema(
  {
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: "RiderProfile", required: true },
    planKey: {
      type: String,
      enum: Object.keys(PLAN_CONFIG),
      required: true
    },
    status: {
      type: String,
      enum: ["ACTIVE", "EXPIRED", "CANCELLED"],
      default: "ACTIVE"
    },
    weeklyPremium: { type: Number, required: true },
    weeklyPayoutCap: { type: Number, required: true },
    autoRenew: { type: Boolean, default: false },
    coverageStart: { type: Date, required: true },
    coverageEnd: { type: Date, required: true },
    lastPaymentAt: { type: Date },
    nextRenewalAt: { type: Date },
    planSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Lock-in period fields
    activatedAt: { type: Date, required: true, default: Date.now },  // Auto-saved when policy is activated
    lockInMonths: { type: Number, required: true },  // Duration of lock-in (2, 6, 9, or 12)
    lockInExpiryAt: { type: Date, required: true },  // Calculated: activatedAt + lockInMonths
    canChangeAfter: { type: Date },  // Same as lockInExpiryAt for clarity
    
    // One-time payment tracking
    isPaid: { type: Boolean, default: false },  // True after one-time premium is paid
    totalPremiumForLockIn: { type: Number, default: 0 },  // Total premium for entire lock-in period
    paidAt: { type: Date }  // When the one-time premium was paid
  },
  { timestamps: true }
);

export const Policy = mongoose.model("Policy", policySchema);

