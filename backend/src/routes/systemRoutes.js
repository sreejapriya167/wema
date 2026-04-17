import { Router } from "express";
import {
  processEvent,
  signalHealth,
  socialDetection,
  weatherSync
} from "../controllers/systemController.js";
import { verifySystemSecret } from "../middleware/systemAuth.js";

const router = Router();

router.use(verifySystemSecret);
router.get("/health/signals", signalHealth);
router.post("/events/weather-sync", weatherSync);
router.post("/events/social-detection", socialDetection);
router.post("/events/:eventId/process", processEvent);

export default router;

