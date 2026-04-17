import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

export function verifySystemSecret(req, _res, next) {
  const secret = req.headers["x-system-secret"];
  if (secret !== env.systemSharedSecret) {
    return next(new ApiError(401, "Invalid system secret"));
  }
  next();
}

