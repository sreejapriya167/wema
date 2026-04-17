import mongoose from "mongoose";

const shiftSchema = new mongoose.Schema(
  {
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RiderProfile",
      required: true
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date,
      required: true
    },
    zone: String,
    city: String,
    ordersCompleted: {
      type: Number,
      default: 0
    },
    earnings: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ["ACTIVE", "COMPLETED", "CANCELLED"],
      default: "COMPLETED"
    },
    active: {
      type: Boolean,
      default: false
    },
    startedAt: Date,
    endedAt: Date
  },
  {
    timestamps: true
  }
);

shiftSchema.index({ riderId: 1, createdAt: -1 });

export const Shift = mongoose.model("Shift", shiftSchema);
