import mongoose from "mongoose";
import { PLAN_CONFIG } from "../constants/plans.js";

const adminSettingSchema = new mongoose.Schema(
  {
    state: { type: String, required: true, unique: true },
    triggerThresholds: {
      heavyRainLevel: { type: String, default: "MODERATE" },
      floodRainMmPerHour: { type: Number, default: 40 },
      cycloneWindKph: { type: Number, default: 75 },
      earthquakeMagnitude: { type: Number, default: 4.5 },
      extremeHeatCelsius: { type: Number, default: 45 },
      severePollutionAqi: { type: Number, default: 300 },
      socialOrderDropPercent: { type: Number, default: 60 }
    },
    payoutCaps: {
      BASIC: { type: Number, default: PLAN_CONFIG.BASIC.weeklyPayoutCap },
      STANDARD: { type: Number, default: PLAN_CONFIG.STANDARD.weeklyPayoutCap },
      PRO: { type: Number, default: PLAN_CONFIG.PRO.weeklyPayoutCap },
      PREMIUM: { type: Number, default: PLAN_CONFIG.PREMIUM.weeklyPayoutCap }
    },
    reserveBufferTarget: { type: Number, default: 1.1 },
    safePoolThreshold: { type: Number, default: 10000 },
    autoApproveLowRisk: { type: Boolean, default: true },
    notificationPreferences: {
      highValuePayouts: { type: Boolean, default: true },
      systemTriggerFailure: { type: Boolean, default: true },
      weeklyPerformancePdf: { type: Boolean, default: false },
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    }
  },
  { timestamps: true }
);

export const AdminSetting = mongoose.model("AdminSetting", adminSettingSchema);
