import { ApiError } from "../utils/ApiError.js";

export function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.auth?.role || !allowedRoles.includes(req.auth.role)) {
      return next(new ApiError(403, "Forbidden"));
    }
    next();
  };
}

