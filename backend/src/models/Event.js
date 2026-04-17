import mongoose from "mongoose";
import { EVENT_SOURCES, EVENT_STATUS } from "../constants/eventTypes.js";

const locationPointSchema = new mongoose.Schema(
  {
    lat: Number,
    lng: Number
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    sourceType: {
      type: String,
      enum: Object.values(EVENT_SOURCES),
      required: true
    },
    eventType: { type: String, required: true },
    city: { type: String, required: true },
    zoneCode: { type: String, required: true },
    center: { type: locationPointSchema, required: true },
    radiusKm: { type: Number, required: true },
    affectedPolygon: { type: [locationPointSchema], default: [] },
    severity: {
      label: { type: String, required: true },
      factor: { type: Number, required: true }
    },
    thresholdSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: Object.values(EVENT_STATUS),
      default: EVENT_STATUS.DETECTED
    },
    triggerSource: { type: String, required: true },
    detectedAt: { type: Date, required: true },
    lossWindowStart: { type: Date, required: true },
    lossWindowEnd: { type: Date, required: true },
    adminDecision: {
      decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      note: String,
      decidedAt: Date
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

export const Event = mongoose.model("Event", eventSchema);

