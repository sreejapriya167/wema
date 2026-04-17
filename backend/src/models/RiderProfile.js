import mongoose from "mongoose";
import { PLAN_CONFIG } from "../constants/plans.js";

const earningsSlotSchema = new mongoose.Schema(
  {
    slotStart: { type: Date, required: true },
    slotEnd: { type: Date, required: true },
    orders: { type: Number, default: 0 },
    earnings: { type: Number, default: 0 }
  },
  { _id: false }
);

const locationPointSchema = new mongoose.Schema(
  {
    lat: Number,
    lng: Number
  },
  { _id: false }
);

const riderProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    provider: { type: String, enum: ["ZOMATO", "SWIGGY"], required: true },
    partnerId: { type: String, unique: true, sparse: true, trim: true, uppercase: true },
    aadhaarLast4: {
      type: String,
      match: [/^\d{4}$/, "Aadhaar last 4 must be exactly 4 digits"]
    },
    city: { type: String, required: true },
    zoneCode: {
      type: String,
      required: true,
      match: [/^\d{6}$/, "Zone code must be a 6-digit PIN"]
    },
    registeredZonePolygon: { type: [locationPointSchema], default: [] },
    currentGps: { type: locationPointSchema, required: true },
    deviceFingerprint: { type: String, required: true },
    ipAddress: { type: String },
    networkType: { type: String },
    activeDelivery: {
      orderId: String,
      acceptedAt: Date,
      pickupAt: Date,
      estimatedDropAt: Date,
      status: {
        type: String,
        enum: ["IDLE", "ACTIVE", "PICKED_UP", "DELIVERED", "CANCELLED"],
        default: "IDLE"
      },
      routePolyline: { type: [locationPointSchema], default: [] },
      pickupLocation: locationPointSchema,
      dropLocation: locationPointSchema
    },
    motionTelemetry: {
      accelerometerScore: { type: Number, default: 0 },
      gyroscopeScore: { type: Number, default: 0 },
      averageSpeedKph: { type: Number, default: 0 }
    },
    routeHistory: { type: [locationPointSchema], default: [] },
    weeklyEarningsAverage: { type: Number, default: 0 },
    earningsHistory: { type: [earningsSlotSchema], default: [] },
    historicalClaimRate: { type: Number, default: 0 },
    historicalFraudFlags: { type: Number, default: 0 },
    declaredShift: {
      active: { type: Boolean, default: false },
      startedAt: Date,
      endedAt: Date,
      source: { type: String, default: "RIDER_DECLARED" }
    },
    manualFlag: {
      flagged: { type: Boolean, default: false },
      reason: String,
      flaggedAt: Date
    },
    plan: {
      type: String,
      enum: Object.keys(PLAN_CONFIG),
      default: "BASIC"
    },
    upiId: { type: String, required: true }
  },
  { timestamps: true }
);

export const RiderProfile = mongoose.model("RiderProfile", riderProfileSchema);
