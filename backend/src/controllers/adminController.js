import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createManualEvent,
  decideSocialTrigger,
  getAdminDashboard,
  processEventByAdmin,
  reviewAppeal,
  reviewClaim,
  reviewComplaint,
  seedDemoData,
  triggerAutomaticWeatherSync,
  updateAdminPreferences,
  updateAdminSettings,
  updateRiderFlag
} from "../services/adminService.js";

export const dashboard = asyncHandler(async (req, res) => {
  const result = await getAdminDashboard(req.auth.userId, req.query.state);
  res.json({ success: true, data: result });
});

export const decideTrigger = asyncHandler(async (req, res) => {
  const result = await decideSocialTrigger(
    req.params.eventId,
    req.auth.userId,
    req.body.approved,
    req.body.note
  );
  res.json({ success: true, data: result });
});

export const reviewClaimDecision = asyncHandler(async (req, res) => {
  const result = await reviewClaim(req.params.claimId, req.body.approved, req.body.note);
  res.json({ success: true, data: result });
});

export const createEvent = asyncHandler(async (req, res) => {
  const result = await createManualEvent(req.body);
  res.status(201).json({ success: true, data: result });
});

export const processEvent = asyncHandler(async (req, res) => {
  const result = await processEventByAdmin(req.params.eventId);
  res.json({ success: true, data: result });
});

export const reviewAppealDecision = asyncHandler(async (req, res) => {
  const result = await reviewAppeal(req.params.appealId, req.body.approved, req.body.note);
  res.json({ success: true, data: result });
});

export const reviewComplaintDecision = asyncHandler(async (req, res) => {
  const result = await reviewComplaint(req.params.complaintId, req.body.approved, req.body.note, req.body.adjustmentAmount);
  res.json({ success: true, data: result });
});

export const weatherSyncNow = asyncHandler(async (_req, res) => {
  const result = await triggerAutomaticWeatherSync();
  res.json({ success: true, data: result });
});

export const savePreferences = asyncHandler(async (req, res) => {
  const result = await updateAdminPreferences(req.auth.userId, req.body);
  res.json({ success: true, data: result });
});

export const saveSettings = asyncHandler(async (req, res) => {
  const result = await updateAdminSettings(req.body.state, req.body);
  res.json({ success: true, data: result });
});

export const toggleRiderFlag = asyncHandler(async (req, res) => {
  const result = await updateRiderFlag(req.params.riderId, req.body.flagged, req.body.reason);
  res.json({ success: true, data: result });
});

export const seedDemo = asyncHandler(async (req, res) => {
  const result = await seedDemoData(req.body?.state || "All States");
  res.json({ success: true, data: result });
});
