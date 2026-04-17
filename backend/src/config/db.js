import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDatabase() {
  if (!env.mongoUri) {
    throw new Error("MONGODB_URI is not configured");
  }

  await mongoose.connect(env.mongoUri, {
    autoIndex: true,
  });

  console.log("MongoDB connected ✅");
}