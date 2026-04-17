import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";

export async function verifyToken(req, _res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return next(new ApiError(401, "Missing bearer token"));
  }

  const token = header.replace("Bearer ", "");

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(decoded.sub);

    if (!user) {
      return next(new ApiError(401, "User not found"));
    }

    req.auth = {
      userId: user._id.toString(),
      role: decoded.role || user.role,
      user
    };

    next();
  } catch (error) {
    next(new ApiError(401, "Invalid token", error.message));
  }
}

