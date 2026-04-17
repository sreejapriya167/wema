import axios from "axios";
import { env } from "../config/env.js";

const aiClient = axios.create({
  timeout: 10000
});

function buildPrompt({ rider, premium, zoneRiskScore, consistencyScore }) {
  return [
    "You are an insurance pricing assistant for gig-worker premium summaries.",
    "Explain the rider premium in clear, simple language.",
    "Do not mention hidden models or unsupported claims.",
    "Respond in strict JSON with keys: summary, recommendation, factors.",
    `Plan: ${rider.plan}`,
    `City: ${rider.city}`,
    `Zone code: ${rider.zoneCode}`,
    `Weekly earnings average: ${rider.weeklyEarningsAverage || 0}`,
    `Base premium: ${premium.basePremium}`,
    `Recommended premium: ${premium.recommendedPremium}`,
    `Zone risk score: ${zoneRiskScore}`,
    `Risk multiplier: ${premium.riskMultiplier}`,
    `Season: ${premium.season}`,
    `Season multiplier: ${premium.seasonMultiplier}`,
    `Consistency score: ${consistencyScore}`,
    `Income cap: ${premium.premiumCap}`,
    "Keep summary under 40 words.",
    "Keep recommendation under 25 words.",
    "Return factors as an array of 3 short strings."
  ].join("\n");
}

function extractJson(content = "") {
  const trimmed = String(content || "").trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch (_secondError) {
      return null;
    }
  }
}

export async function generatePremiumInsight({ rider, premium, zoneRiskScore, consistencyScore }) {
  if (!env.aiApiKey) {
    return null;
  }

  try {
    const response = await aiClient.post(
      `${env.aiApiBaseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        model: env.aiModel,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You explain insurance premium calculations clearly and conservatively."
          },
          {
            role: "user",
            content: buildPrompt({ rider, premium, zoneRiskScore, consistencyScore })
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${env.aiApiKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    const content = response?.data?.choices?.[0]?.message?.content || "";
    const parsed = extractJson(content);

    if (!parsed) {
      return {
        enabled: true,
        provider: "backend-ai",
        model: env.aiModel,
        summary: "Your premium reflects plan price, zone risk, season, and income cap.",
        recommendation: "Keep your earnings and zone details updated for accurate pricing.",
        factors: [
          `Plan ${rider.plan}`,
          `Zone risk ${Number(zoneRiskScore).toFixed(2)}`,
          `Season ${premium.season}`
        ]
      };
    }

    return {
      enabled: true,
      provider: "backend-ai",
      model: env.aiModel,
      summary: parsed.summary || "Your premium reflects plan price, zone risk, season, and income cap.",
      recommendation: parsed.recommendation || "Keep your earnings and zone details updated for accurate pricing.",
      factors: Array.isArray(parsed.factors)
        ? parsed.factors.slice(0, 3)
        : [
            `Plan ${rider.plan}`,
            `Zone risk ${Number(zoneRiskScore).toFixed(2)}`,
            `Season ${premium.season}`
          ]
    };
  } catch (_error) {
    return null;
  }
}
