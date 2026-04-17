import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createComplaint,
  createAppeal,
  getAlerts,
  getPlans,
  getPayoutHistory,
  getRiderDashboard,
  getRiderPremiumQuote,
  subscribePolicy,
  syncProviderSnapshot,
  updateRiderLocation,
  updatePlan,
  updateRiderProfile,
  syncPinLocation
} from "../services/riderService.js";

export const dashboard = asyncHandler(async (req, res) => {
  const result = await getRiderDashboard(req.auth.userId);
  res.json({ success: true, data: result });
});

export const selectPlan = asyncHandler(async (req, res) => {
  const result = await updatePlan(req.auth.userId, req.body.plan);
  res.json({ success: true, data: result });
});

export const subscribe = asyncHandler(async (req, res) => {
  const result = await subscribePolicy(req.auth.userId, req.body);
  res.status(201).json({ success: true, data: result });
});

export const alerts = asyncHandler(async (req, res) => {
  const result = await getAlerts(req.auth.userId);
  res.json({ success: true, data: result });
});

export const payouts = asyncHandler(async (req, res) => {
  const result = await getPayoutHistory(req.auth.userId);
  res.json({ success: true, data: result });
});

export const plans = asyncHandler(async (_req, res) => {
  const result = await getPlans();
  res.json({ success: true, data: result });
});

export const premiumQuote = asyncHandler(async (req, res) => {
  const result = await getRiderPremiumQuote(req.auth.userId, req.body);
  res.json({ success: true, data: result });
});

export const appeal = asyncHandler(async (req, res) => {
  const result = await createAppeal(req.auth.userId, req.body);
  res.status(201).json({ success: true, data: result });
});

export const complaint = asyncHandler(async (req, res) => {
  const result = await createComplaint(req.auth.userId, req.body);
  res.status(201).json({ success: true, data: result });
});

export const providerSync = asyncHandler(async (req, res) => {
  const result = await syncProviderSnapshot(req.auth.userId, req.body);
  res.json({ success: true, data: result });
});

export const updateLocation = asyncHandler(async (req, res) => {
  const result = await updateRiderLocation(req.auth.userId, req.body);
  res.json({ success: true, data: result });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const result = await updateRiderProfile(req.auth.userId, req.body);
  res.json({ success: true, data: result });
});

export const syncPinGps = asyncHandler(async (req, res) => {
  const result = await syncPinLocation(req.auth.userId);
  res.json({ success: true, data: result });
});
