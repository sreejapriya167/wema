import mongoose from "mongoose";

const complaintSchema = new mongoose.Schema(
  {
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: "RiderProfile", required: true },
    relatedClaimId: { type: mongoose.Schema.Types.ObjectId, ref: "Claim" },
    category: {
      type: String,
      enum: ["PAYMENT_DELAY", "WRONG_CALCULATION", "TECHNICAL_ISSUE", "OTHER"],
      required: true
    },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED"],
      default: "OPEN"
    },
    resolutionNote: { type: String, trim: true },
    adjustmentAmount: { type: Number, default: 0 },
    adjustmentPayoutId: { type: mongoose.Schema.Types.ObjectId, ref: "Payout" }
  },
  { timestamps: true }
);

export const Complaint = mongoose.model("Complaint", complaintSchema);
