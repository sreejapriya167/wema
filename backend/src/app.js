import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/authRoutes.js";
import riderAuthRoutes from "./routes/riderAuthRoutes.js";
import riderRoutes from "./routes/riderRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import systemRoutes from "./routes/systemRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("dev"));

  app.get("/health", (_req, res) => {
    res.json({ success: true, service: "wema-backend" });
  });

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/riders", riderAuthRoutes);
  app.use("/api/v1/rider", riderRoutes);
  app.use("/api/v1/admin", adminRoutes);
  app.use("/api/v1/system", systemRoutes);
  app.use("/api/v1/payments", paymentRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

