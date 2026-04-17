import { PLAN_CONFIG } from "../constants/plans.js";
import { getCurrentSeason } from "../utils/time.js";
import { ApiError } from "../utils/ApiError.js";
import { Event } from "../models/Event.js";
import { Shift } from "../models/Shift.js";

const seasonalMultiplier = {
  SUMMER: 1.08,
  MONSOON: 1.2,
  WINTER: 1.0
};

export function calculatePremium({ weeklyIncome, zoneRiskScore, planKey, consistencyScore = 1, date = new Date() }) {
  const plan = PLAN_CONFIG[planKey];
  if (!plan) {
    throw new ApiError(400, "Invalid plan selected");
  }

  const normalizedConsistencyScore = Number.isFinite(Number(consistencyScore))
    ? Number(consistencyScore)
    : 1;

  const season = getCurrentSeason(date);
  const riskMultiplier = 1 + Math.min(Math.max(zoneRiskScore, 0), 1.0);
  const seasonMultiplier = seasonalMultiplier[season] || 1;
  const basePremium = plan.weeklyPremiumBase;
  const rawPremium = basePremium * riskMultiplier * seasonMultiplier * normalizedConsistencyScore;

  // Apply zone discount for Standard, Pro, Premium plans
  let finalPremium = rawPremium;
  if (["STANDARD", "PRO", "PREMIUM"].includes(planKey) && zoneRiskScore < 0.3) {
    finalPremium = rawPremium - 2;
  }

  // Ensure premium never goes below plan's base rate
  finalPremium = Math.max(finalPremium, basePremium);

  const premiumCap = weeklyIncome * 0.02;
  const recommendedPremium = Number(Math.min(finalPremium, premiumCap).toFixed(2));

  return {
    season,
    basePremium,
    zoneRiskScore: Number(zoneRiskScore || 0),
    riskMultiplier: Number(riskMultiplier.toFixed(2)),
    seasonMultiplier: Number(seasonMultiplier.toFixed(2)),
    consistencyScore: Number(normalizedConsistencyScore || 1),
    rawPremium: Number(rawPremium.toFixed(2)),
    recommendedPremium,
    premiumCap: Number(premiumCap.toFixed(2)),
    cappedByIncome: recommendedPremium < Number(finalPremium.toFixed(2))
  };
}

export async function computeZoneRiskScore({ zoneCode, city, planKey }) {
  const plan = PLAN_CONFIG[planKey];
  if (!plan) {
    throw new ApiError(400, "Invalid plan selected");
  }

  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 6);

  const relevantEvents = await Event.countDocuments({
    detectedAt: { $gte: since },
    eventType: { $in: plan.calamityTypes },
    zoneCode
  });

  return Number(Math.min(relevantEvents / 10, 1.0).toFixed(2));
}

export async function computeConsistencyScore({ riderId }) {
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setUTCDate(fourWeeksAgo.getUTCDate() - 28);

  const shifts = await Shift.find({
    riderId,
    createdAt: { $gte: fourWeeksAgo }
  });

  // Get distinct weeks that have at least one shift
  const weeksWithShifts = new Set();
  shifts.forEach(shift => {
    const shiftDate = new Date(shift.createdAt);
    const weekNumber = Math.floor((shiftDate.getTime() - fourWeeksAgo.getTime()) / (7 * 24 * 60 * 60 * 1000));
    weeksWithShifts.add(weekNumber);
  });

  const weekCount = weeksWithShifts.size;
  return weekCount >= 3 ? 0.85 : 1.0;
}
