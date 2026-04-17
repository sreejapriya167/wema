import { Router } from "express";
import { appeal, alerts, complaint, dashboard, payouts, plans, premiumQuote, providerSync, selectPlan, subscribe, updateLocation, updateProfile, syncPinGps } from "../controllers/riderController.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { requireRole } from "../middleware/requireRole.js";
import { ROLES } from "../constants/roles.js";

const router = Router();

router.use(verifyToken, requireRole(ROLES.RIDER));
router.get("/dashboard", dashboard);
router.get("/plans", plans);
router.post("/premium", premiumQuote);
router.post("/subscribe", subscribe);
router.post("/plan", selectPlan);
router.post("/provider-sync", providerSync);
router.post("/location", updateLocation);
router.patch("/profile", updateProfile);
router.post("/pin-location", syncPinGps);
router.get("/alerts", alerts);
router.get("/payouts", payouts);
router.post("/appeals", appeal);
router.post("/complaints", complaint);

export default router;
