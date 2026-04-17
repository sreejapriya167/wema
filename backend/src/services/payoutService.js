import { Claim } from "../models/Claim.js";
import { Payout } from "../models/Payout.js";
import { RiderProfile } from "../models/RiderProfile.js";

function mockRazorpayTransfer({ amount, upiId }) {
  return {
    providerReference: `rzp_${Date.now()}`,
    amount,
    upiId,
    status: "PAID"
  };
}

async function createPaidPayout({ claimId, complaintId, riderId, amount, description, payoutType = "CLAIM" }) {
  const rider = await RiderProfile.findById(riderId);
  if (!rider) {
    return null;
  }

  const transfer = mockRazorpayTransfer({
    amount,
    upiId: rider.upiId
  });

  return Payout.create({
    claimId,
    complaintId,
    riderId: rider._id,
    amount,
    payoutType,
    description,
    providerReference: transfer.providerReference,
    status: transfer.status,
    paidAt: new Date()
  });
}

export async function releasePayoutForClaim(claimId) {
  const claim = await Claim.findById(claimId).populate("riderId");
  if (!claim || claim.decision !== "APPROVED") {
    return null;
  }

  const payout = await createPaidPayout({
    claimId: claim._id,
    riderId: claim.riderId._id,
    amount: claim.cappedPayout,
    description: "Claim payout",
    payoutType: "CLAIM"
  });

  claim.decision = "PAID";
  await claim.save();

  return payout;
}

export async function createAdjustmentPayout({ riderId, amount, claimId = null, complaintId = null, description = "Complaint adjustment" }) {
  const normalizedAmount = Number(amount);
  if (Number.isNaN(normalizedAmount) || normalizedAmount <= 0) {
    return null;
  }

  return createPaidPayout({
    claimId,
    complaintId,
    riderId,
    amount: normalizedAmount,
    description,
    payoutType: "ADJUSTMENT"
  });
}

