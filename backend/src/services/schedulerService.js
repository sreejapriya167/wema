import { collectWeeklyPremiums, autoBatchPayoutApprovedClaims } from "./paymentService.js";

/**
 * Job Scheduler for WEMA
 * 
 * Tasks:
 * 1. Weekly Premium Collection - Every Monday at 00:00 UTC
 * 2. Automatic Claim Payouts - Every day at 06:00 UTC (runs before business hours)
 */

let jobs = [];

function getNextRunTime(hour, minute = 0, dayOfWeek = null) {
  const now = new Date();
  const nextRun = new Date(now);

  // If dayOfWeek provided, schedule for specific day (0=Sunday, 1=Monday, etc.)
  if (dayOfWeek !== null) {
    const daysUntil = (dayOfWeek + 7 - now.getDay()) % 7 || 7;
    nextRun.setDate(nextRun.getDate() + daysUntil);
  }

  nextRun.setHours(hour, minute, 0, 0);

  // If time already passed today, schedule for next occurrence
  if (nextRun <= now && dayOfWeek === null) {
    nextRun.setDate(nextRun.getDate() + 1);
  } else if (nextRun <= now && dayOfWeek !== null) {
    nextRun.setDate(nextRun.getDate() + 7);
  }

  return nextRun;
}

function scheduleJob(name, fn, nextRunTime) {
  const msUntilRun = nextRunTime.getTime() - Date.now();

  if (msUntilRun < 0) {
    console.error(`[Scheduler] Job "${name}" scheduled for past time`);
    return null;
  }

  console.log(`[Scheduler] Job "${name}" scheduled for ${nextRunTime.toISOString()} (${msUntilRun / 1000 / 60} minutes)`);

  const timeoutId = setTimeout(async () => {
    console.log(`[Scheduler] Executing job: "${name}"`);
    try {
      await fn();
    } catch (error) {
      console.error(`[Scheduler] Job "${name}" failed:`, error.message);
    }

    // Reschedule for next occurrence
    const nextTime = getNextRunTime(...nextRunTime.getScheduleArgs?.() || [0, 0]);
    scheduleJob(name, fn, nextTime);
  }, msUntilRun);

  return {
    id: timeoutId,
    name,
    nextRun: nextRunTime
  };
}

export function initializeScheduler() {
  console.log("[Scheduler] Initializing WEMA job scheduler...");

  // Job 1: Weekly Premium Collection (Every Monday at 00:00)
  const premiumCollectionTime = getNextRunTime(0, 0, 1); // Monday, 00:00
  const premiumJob = scheduleJob(
    "Weekly Premium Collection",
    collectWeeklyPremiums,
    premiumCollectionTime
  );
  if (premiumJob) {
    jobs.push(premiumJob);
  }

  // Job 2: Automatic Claim Payouts (Every day at 06:00)
  const payoutTime = getNextRunTime(6, 0); // 06:00 daily
  const payoutJob = scheduleJob(
    "Auto Batch Claim Payouts",
    autoBatchPayoutApprovedClaims,
    payoutTime
  );
  if (payoutJob) {
    jobs.push(payoutJob);
  }

  console.log(`[Scheduler] Initialized ${jobs.length} jobs`);
  return jobs;
}

export function stopScheduler() {
  console.log("[Scheduler] Stopping all scheduled jobs...");
  jobs.forEach((job) => {
    clearTimeout(job.id);
    console.log(`[Scheduler] Stopped job: "${job.name}"`);
  });
  jobs = [];
}

export function getScheduledJobs() {
  return jobs.map((job) => ({
    name: job.name,
    nextRun: job.nextRun.toISOString()
  }));
}

// Manual trigger functions (exposed via admin API)
export async function triggerPremiumCollection() {
  console.log("[Scheduler] Manual trigger: Premium Collection");
  return await collectWeeklyPremiums();
}

export async function triggerClaimPayouts() {
  console.log("[Scheduler] Manual trigger: Claim Payouts");
  return await autoBatchPayoutApprovedClaims();
}
