import { Router } from "express";
import { firebaseLogin, me } from "../controllers/authController.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = Router();

router.post("/firebase-login", firebaseLogin);
router.get("/me", verifyToken, me);

export default router;

