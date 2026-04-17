import mongoose from "mongoose";

const premiumPaymentSchema = new mongoose.Schema(
  {
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: "RiderProfile", required: true },
    policyId: { type: mongoose.Schema.Types.ObjectId, ref: "Policy", required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    method: {
      type: String,
      enum: ["MANUAL", "AUTO_DEBIT", "MOCK"],
      default: "MOCK"
    },
    status: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED"],
      default: "PAID"
    },
    paidAt: { type: Date, default: Date.now },
    reference: { type: String }
  },
  { timestamps: true }
);

export const PremiumPayment = mongoose.model("PremiumPayment", premiumPaymentSchema);
