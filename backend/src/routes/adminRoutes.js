import { Router } from "express";
import {
  createEvent,
  dashboard,
  decideTrigger,
  processEvent,
  reviewAppealDecision,
  reviewClaimDecision,
  reviewComplaintDecision,
  seedDemo,
  savePreferences,
  saveSettings,
  toggleRiderFlag,
  weatherSyncNow
} from "../controllers/adminController.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { requireRole } from "../middleware/requireRole.js";
import { ROLES } from "../constants/roles.js";

const router = Router();

router.use(verifyToken, requireRole(ROLES.ADMIN));
router.get("/dashboard", dashboard);
router.post("/weather-sync", weatherSyncNow);
router.post("/demo/seed", seedDemo);
router.patch("/preferences", savePreferences);
router.patch("/settings", saveSettings);
router.post("/events", createEvent);
router.post("/events/:eventId/process", processEvent);
router.patch("/social-triggers/:eventId/decision", decideTrigger);
router.patch("/claims/:claimId/review", reviewClaimDecision);
router.patch("/appeals/:appealId/review", reviewAppealDecision);
router.patch("/complaints/:complaintId/review", reviewComplaintDecision);
router.patch("/riders/:riderId/flag", toggleRiderFlag);

export default router;
