import { asyncHandler } from "../utils/asyncHandler.js";
import {
  fetchExternalSignalsSummary,
  ingestWeatherEvents,
  ingestSocialEvent,
  processApprovedEvent,
} from "../services/eventDetectionService.js";
import { ApiError } from "../utils/ApiError.js";

export const weatherSync = asyncHandler(async (_req, res) => {
  if (!_req.body || (Array.isArray(_req.body) && !_req.body.length)) {
    throw new ApiError(400, "Weather sync requires one or more event payloads");
  }

  const events = await ingestWeatherEvents(_req.body);
  res.status(201).json({ success: true, data: events });
});

export const socialDetection = asyncHandler(async (req, res) => {
  const event = await ingestSocialEvent(req.body);
  res.status(201).json({ success: true, data: event });
});

export const processEvent = asyncHandler(async (req, res) => {
  const result = await processApprovedEvent(req.params.eventId);
  res.json({ success: true, data: result });
});

export const signalHealth = asyncHandler(async (_req, res) => {
  const result = await fetchExternalSignalsSummary();
  res.json({ success: true, data: result });
});
