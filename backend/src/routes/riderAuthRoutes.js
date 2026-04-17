import { Router } from "express";
import { riderLogin, riderRegister } from "../controllers/authController.js";

const router = Router();

router.post("/register", riderRegister);
router.post("/login", riderLogin);

export default router;
