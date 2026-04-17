import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, "../../.env");
const fallbackEnvExamplePath = path.resolve(__dirname, "../../.env.example");

dotenv.config({
  path: fs.existsSync(rootEnvPath) ? rootEnvPath : fallbackEnvExamplePath
});

export const env = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET || "change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  aiApiKey: process.env.AI_API_KEY,
  aiApiBaseUrl: process.env.AI_API_BASE_URL || "https://api.openai.com/v1",
  aiModel: process.env.AI_MODEL || "gpt-4o-mini",
  openWeatherApiKey: process.env.OPENWEATHER_API_KEY,
  weatherSyncIntervalMinutes: Number(process.env.WEATHER_SYNC_INTERVAL_MINUTES || 15),
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
  fraudServiceUrl: process.env.FRAUD_SERVICE_URL || "http://localhost:8001",
  systemSharedSecret: process.env.SYSTEM_SHARED_SECRET || "system-secret"
};
