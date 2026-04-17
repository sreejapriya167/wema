import { createApp } from "./app.js";
import { connectDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { startAutomaticWeatherMonitor } from "./services/eventDetectionService.js";
import { initializeScheduler, stopScheduler } from "./services/schedulerService.js";
import { normalizeUserNotificationChannels } from "./utils/migrations.js";

const app = createApp();
let weatherMonitor;
let scheduler;

async function bootstrap() {
  await connectDatabase();
  await normalizeUserNotificationChannels();
  
  // Initialize scheduler for automatic payments
  scheduler = initializeScheduler();
  
  app.listen(env.port, () => {
    console.log(`WEMA backend listening on port ${env.port}`);
  });
  
  weatherMonitor = startAutomaticWeatherMonitor();
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[Server] Graceful shutdown initiated...");
  if (weatherMonitor) {
    clearInterval(weatherMonitor);
  }
  if (scheduler) {
    stopScheduler();
  }
  process.exit(0);
});

bootstrap().catch((error) => {
  console.error("Failed to start backend", error);
  if (weatherMonitor) {
    clearInterval(weatherMonitor);
  }
  if (scheduler) {
    stopScheduler();
  }
  process.exit(1);
});
