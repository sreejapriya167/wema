export const PLAN_CONFIG = {
  BASIC: {
    key: "BASIC",
    weeklyPremiumBase: 39,
    weeklyPayoutCap: 300,
    daysCoveredPerWeek: 2,
    payoutTargetMinutes: 120,
    lockInMonths: 2,
    calamityTypes: ["BANDH", "CURFEW", "STRIKE", "ZONE_CLOSURE", "SOCIAL_DISRUPTION"]
  },
  STANDARD: {
    key: "STANDARD",
    weeklyPremiumBase: 59,
    weeklyPayoutCap: 600,
    daysCoveredPerWeek: 2,
    payoutTargetMinutes: 120,
    lockInMonths: 6,
    calamityTypes: ["HEAVY_RAIN", "FLOOD", "EXTREME_HEAT", "SEVERE_POLLUTION"]
  },
  PRO: {
    key: "PRO",
    weeklyPremiumBase: 99,
    weeklyPayoutCap: 1200,
    daysCoveredPerWeek: 3,
    payoutTargetMinutes: 60,
    lockInMonths: 9,
    calamityTypes: [
      "HEAVY_RAIN",
      "FLOOD",
      "EXTREME_HEAT",
      "SEVERE_POLLUTION",
      "BANDH",
      "CURFEW",
      "STRIKE",
      "ZONE_CLOSURE",
      "SOCIAL_DISRUPTION"
    ]
  },
  PREMIUM: {
    key: "PREMIUM",
    weeklyPremiumBase: 159,
    weeklyPayoutCap: 2000,
    daysCoveredPerWeek: 5,
    payoutTargetMinutes: 30,
    lockInMonths: 12,
    calamityTypes: [
      "HEAVY_RAIN",
      "FLOOD",
      "EXTREME_HEAT",
      "SEVERE_POLLUTION",
      "BANDH",
      "CURFEW",
      "STRIKE",
      "ZONE_CLOSURE",
      "SOCIAL_DISRUPTION",
      "EARTHQUAKE",
      "CYCLONE"
    ]
  }
};

