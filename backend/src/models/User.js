import mongoose from "mongoose";
import { ROLES } from "../constants/roles.js";

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, unique: true, sparse: true },
    name: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
      default: ROLES.RIDER
    },
    aadhaarVerified: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED", "PENDING_VERIFICATION"],
      default: "PENDING_VERIFICATION"
    },
    preferences: {
      adminTheme: {
        type: String,
        enum: ["dark", "light"],
        default: "dark"
      },
      selectedState: {
        type: String,
        default: ""
      },
      notificationChannels: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false }
      }
    }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
