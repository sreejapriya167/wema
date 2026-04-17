import mongoose from "mongoose";

const appealSchema = new mongoose.Schema(
  {
    claimId: { type: mongoose.Schema.Types.ObjectId, ref: "Claim", required: true },
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: "RiderProfile", required: true },
    reason: { type: String, required: true },
    attachments: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED"],
      default: "OPEN"
    },
    resolutionNote: { type: String }
  },
  { timestamps: true }
);

export const Appeal = mongoose.model("Appeal", appealSchema);
