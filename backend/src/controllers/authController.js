import { asyncHandler } from "../utils/asyncHandler.js";
import { getProfile, loginRider, loginWithFirebase, registerRider } from "../services/authService.js";

export const firebaseLogin = asyncHandler(async (req, res) => {
  const result = await loginWithFirebase(req.body.idToken, req.body.profile);
  res.json({ success: true, data: result });
});

export const me = asyncHandler(async (req, res) => {
  const result = await getProfile(req.auth.userId);
  res.json({ success: true, data: result });
});

export const riderRegister = asyncHandler(async (req, res) => {
  const result = await registerRider(req.body);
  res.status(201).json({ success: true, data: result });
});

export const riderLogin = asyncHandler(async (req, res) => {
  const result = await loginRider(req.body);
  res.json({ success: true, data: result });
});

