import axios from "axios";
import { Event } from "../models/Event.js";
import { RiderProfile } from "../models/RiderProfile.js";
import { EVENT_SOURCES, EVENT_STATUS } from "../constants/eventTypes.js";
import { evaluateRiderForEvent } from "./eligibilityService.js";
import { releasePayoutForClaim } from "./payoutService.js";
import { env } from "../config/env.js";
import { haversineDistanceKm } from "../utils/geo.js";
import { normalizeCity } from "../utils/geography.js";
import { fetchFraudServiceSummary } from "./fraudService.js";

const openWeatherClient = axios.create({
  timeout: 10000
});

function buildSeverity(eventType, snapshot) {
  if (eventType === "CYCLONE") return { label: "SEVERE", factor: 1.5 };
  if (eventType === "FLOOD") return { label: "HIGH", factor: 1.3 };
  if (eventType === "EARTHQUAKE") return { label: "HIGH", factor: snapshot.magnitude >= 6 ? 1.5 : 1.25 };
  if (eventType === "EXTREME_HEAT") return { label: "MODERATE", factor: 1.15 };
  if (eventType === "SEVERE_POLLUTION") return { label: "MODERATE", factor: 1.1 };
  return { label: "MODERATE", factor: 1.0 };
}

function buildPolygon(center, radiusKm) {
  const latOffset = radiusKm / 111;
  const lngOffset = radiusKm / (111 * Math.cos((center.lat * Math.PI) / 180 || 1));

  return [
    { lat: center.lat + latOffset, lng: center.lng },
    { lat: center.lat, lng: center.lng + lngOffset },
    { lat: center.lat - latOffset, lng: center.lng },
    { lat: center.lat, lng: center.lng - lngOffset }
  ];
}

async function recentMatchingEventExists({ zoneCode, city, eventType }) {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  const existing = await Event.findOne({
    zoneCode,
    city,
    eventType,
    sourceType: EVENT_SOURCES.WEATHER,
    createdAt: { $gte: fifteenMinutesAgo },
    status: { $in: [EVENT_STATUS.APPROVED, EVENT_STATUS.PROCESSING, EVENT_STATUS.COMPLETED] }
  }).lean();

  return Boolean(existing);
}

async function fetchZoneWeatherSnapshot(zone) {
  const weatherResponse = await openWeatherClient.get("https://api.openweathermap.org/data/2.5/weather", {
    params: {
      lat: zone.center.lat,
      lon: zone.center.lng,
      units: "metric",
      appid: env.openWeatherApiKey
    }
  });

  let airResponse = { data: {} };
  try {
    airResponse = await openWeatherClient.get("https://api.openweathermap.org/data/2.5/air_pollution", {
      params: {
        lat: zone.center.lat,
        lon: zone.center.lng,
        appid: env.openWeatherApiKey
      }
    });
  } catch (_error) {
    airResponse = { data: {} };
  }

  let oneCallResponse = { data: {} };
  try {
    oneCallResponse = await openWeatherClient.get("https://api.openweathermap.org/data/3.0/onecall", {
      params: {
        lat: zone.center.lat,
        lon: zone.center.lng,
        exclude: "minutely,daily,hourly",
        units: "metric",
        appid: env.openWeatherApiKey
      }
    });
  } catch (_error) {
    oneCallResponse = { data: {} };
  }

  return {
    weather: weatherResponse.data,
    air: airResponse.data,
    oneCall: oneCallResponse.data
  };
}

function deriveAutomaticWeatherEvents(zone, snapshot) {
  const detectedEvents = [];
  const current = snapshot.oneCall.current || snapshot.weather.main || {};
  const weatherTags = [
    ...(snapshot.weather.weather || []).map((item) => item.main),
    ...((snapshot.oneCall.current?.weather || []).map((item) => item.main))
  ];
  const rainVolume = snapshot.weather.rain?.["1h"] || snapshot.weather.rain?.["3h"] || 0;
  const windSpeed = snapshot.weather.wind?.speed || snapshot.oneCall.current?.wind_speed || 0;
  const aqi = snapshot.air?.list?.[0]?.main?.aqi;
  const pollutionComponents = snapshot.air?.list?.[0]?.components || {};
  const approxHazardousAqi = aqi === 5 || pollutionComponents.pm2_5 >= 150 || pollutionComponents.pm10 >= 250;
  const tempC = current.temp ?? snapshot.weather.main?.temp ?? 0;
  const feelsLike = current.feels_like ?? snapshot.weather.main?.feels_like ?? tempC;
  const alerts = snapshot.oneCall.alerts || [];

  if (alerts.some((alert) => /cyclone|storm|hurricane/i.test(alert.event || "")) || windSpeed >= 24.5) {
    detectedEvents.push({
      eventType: "CYCLONE",
      severityFactor: 1.5,
      radiusKm: zone.radiusKm,
      thresholdSnapshot: { windSpeed, alerts: alerts.map((alert) => alert.event) }
    });
  }

  if (rainVolume >= 7 || weatherTags.some((tag) => ["Rain", "Thunderstorm"].includes(tag))) {
    detectedEvents.push({
      eventType: rainVolume >= 20 ? "FLOOD" : "HEAVY_RAIN",
      severityFactor: rainVolume >= 20 ? 1.3 : 1.0,
      radiusKm: zone.radiusKm,
      thresholdSnapshot: { rainVolume, weatherTags }
    });
  }

  if (Math.max(tempC, feelsLike) >= 45) {
    detectedEvents.push({
      eventType: "EXTREME_HEAT",
      severityFactor: 1.15,
      radiusKm: zone.radiusKm,
      thresholdSnapshot: { tempC, feelsLike }
    });
  }

  if (approxHazardousAqi) {
    detectedEvents.push({
      eventType: "SEVERE_POLLUTION",
      severityFactor: 1.1,
      radiusKm: zone.radiusKm,
      thresholdSnapshot: { aqi, pollutionComponents }
    });
  }

  return detectedEvents;
}

async function collectActiveZones() {
  const riders = await RiderProfile.find({}).lean();
  const zoneMap = new Map();

  for (const rider of riders) {
    if (!rider.zoneCode || !rider.city || !rider.currentGps) continue;

    if (!zoneMap.has(rider.zoneCode)) {
      zoneMap.set(rider.zoneCode, {
        city: rider.city,
        zoneCode: rider.zoneCode,
        center: rider.currentGps,
        radiusKm: 5,
        affectedPolygon: rider.registeredZonePolygon?.length ? rider.registeredZonePolygon : buildPolygon(rider.currentGps, 5)
      });
    }
  }

  return [...zoneMap.values()];
}

async function fetchEarthquakeFeed() {
  const response = await openWeatherClient.get(
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
  );

  return response.data?.features || [];
}

export async function ingestWeatherEvent(payload) {
  return Event.create({
    sourceType: EVENT_SOURCES.WEATHER,
    eventType: payload.eventType,
    city: normalizeCity(payload.city),
    zoneCode: payload.zoneCode,
    center: payload.center,
    radiusKm: payload.radiusKm,
    affectedPolygon: payload.affectedPolygon || [],
    severity: buildSeverity(payload.eventType, payload.thresholdSnapshot || {}),
    thresholdSnapshot: payload.thresholdSnapshot || {},
    status: EVENT_STATUS.APPROVED,
    triggerSource: payload.triggerSource || "OpenWeather",
    detectedAt: payload.detectedAt || new Date(),
    lossWindowStart: payload.lossWindowStart,
    lossWindowEnd: payload.lossWindowEnd,
    metadata: payload.metadata || {}
  });
}

export async function ingestSocialEvent(payload) {
  return Event.create({
    sourceType: EVENT_SOURCES.SOCIAL,
    eventType: payload.eventType,
    city: normalizeCity(payload.city),
    zoneCode: payload.zoneCode,
    center: payload.center,
    radiusKm: payload.radiusKm,
    affectedPolygon: payload.affectedPolygon || [],
    severity: payload.severity || { label: "SOCIAL", factor: 1.0 },
    thresholdSnapshot: payload.thresholdSnapshot || {},
    status: EVENT_STATUS.PENDING_ADMIN_APPROVAL,
    triggerSource: payload.triggerSource || "NewsAPI + Order Analytics",
    detectedAt: payload.detectedAt || new Date(),
    lossWindowStart: payload.lossWindowStart,
    lossWindowEnd: payload.lossWindowEnd,
    metadata: payload.metadata || {}
  });
}

export async function processApprovedEvent(eventId) {
  const event = await Event.findByIdAndUpdate(eventId, { status: EVENT_STATUS.PROCESSING }, { new: true });
  const riders = await RiderProfile.find({ city: event.city, zoneCode: event.zoneCode });
  const results = [];

  for (const rider of riders) {
    const claim = await evaluateRiderForEvent(rider, event);
    let payout = null;

    if (claim.decision === "APPROVED") {
      payout = await releasePayoutForClaim(claim._id);
    }

    results.push({
      riderId: rider._id,
      claimId: claim._id,
      decision: claim.decision,
      payoutId: payout?._id || null
    });
  }

  event.status = EVENT_STATUS.COMPLETED;
  await event.save();

  return { event, results };
}

export async function ingestWeatherEvents(payload) {
  const events = Array.isArray(payload) ? payload : [payload];
  const created = [];

  for (const item of events) {
    created.push(await ingestWeatherEvent(item));
  }

  return created;
}

export async function runAutomaticWeatherSync() {
  if (!env.openWeatherApiKey) {
    return [];
  }

  const zones = await collectActiveZones();
  const createdEvents = [];

  for (const zone of zones) {
    const snapshot = await fetchZoneWeatherSnapshot(zone);
    const autoEvents = deriveAutomaticWeatherEvents(zone, snapshot);

    for (const autoEvent of autoEvents) {
      const exists = await recentMatchingEventExists({
        zoneCode: zone.zoneCode,
        city: zone.city,
        eventType: autoEvent.eventType
      });

      if (exists) {
        continue;
      }

      const now = new Date();
      const lossWindowEnd = new Date(now);
      lossWindowEnd.setHours(lossWindowEnd.getHours() + 2);

      const event = await ingestWeatherEvent({
        eventType: autoEvent.eventType,
        city: zone.city,
        zoneCode: zone.zoneCode,
        center: zone.center,
        radiusKm: autoEvent.radiusKm,
        affectedPolygon: zone.affectedPolygon,
        thresholdSnapshot: autoEvent.thresholdSnapshot,
        detectedAt: now,
        lossWindowStart: now,
        lossWindowEnd,
        metadata: {
          automation: "OPENWEATHER_AUTO_SYNC"
        }
      });

      createdEvents.push(event);
      await processApprovedEvent(event._id);
    }
  }

  return createdEvents;
}

export async function runAutomaticEarthquakeSync() {
  const zones = await collectActiveZones();
  if (!zones.length) {
    return [];
  }

  const features = await fetchEarthquakeFeed();
  const createdEvents = [];

  for (const zone of zones) {
    const matchingQuakes = features.filter((feature) => {
      const magnitude = feature.properties?.mag || 0;
      const coordinates = feature.geometry?.coordinates || [];
      const quakeCenter = {
        lng: coordinates[0],
        lat: coordinates[1]
      };

      return (
        magnitude >= 4.5 &&
        haversineDistanceKm(zone.center, quakeCenter) <= 250
      );
    });

    for (const quake of matchingQuakes) {
      const magnitude = quake.properties?.mag || 0;
      const exists = await recentMatchingEventExists({
        zoneCode: zone.zoneCode,
        city: zone.city,
        eventType: "EARTHQUAKE"
      });

      if (exists) {
        continue;
      }

      const now = new Date(quake.properties?.time || Date.now());
      const lossWindowEnd = new Date(now);
      lossWindowEnd.setHours(lossWindowEnd.getHours() + 24);

      const event = await ingestWeatherEvent({
        eventType: "EARTHQUAKE",
        city: zone.city,
        zoneCode: zone.zoneCode,
        center: zone.center,
        radiusKm: Math.max(zone.radiusKm, 20),
        affectedPolygon: zone.affectedPolygon,
        thresholdSnapshot: {
          magnitude,
          place: quake.properties?.place
        },
        detectedAt: now,
        lossWindowStart: now,
        lossWindowEnd,
        metadata: {
          automation: "USGS_EARTHQUAKE_AUTO_SYNC"
        }
      });

      createdEvents.push(event);
      await processApprovedEvent(event._id);
    }
  }

  return createdEvents;
}

export function startAutomaticWeatherMonitor() {
  if (!env.openWeatherApiKey) {
    console.log("Automatic weather monitor skipped: OPENWEATHER_API_KEY is not configured");
    return null;
  }

  const intervalMs = Math.max(env.weatherSyncIntervalMinutes, 1) * 60 * 1000;

  runAutomaticWeatherSync().catch((error) => {
    console.error("Initial weather sync failed", error.message);
  });
  runAutomaticEarthquakeSync().catch((error) => {
    console.error("Initial earthquake sync failed", error.message);
  });

  return setInterval(() => {
    runAutomaticWeatherSync().catch((error) => {
      console.error("Scheduled weather sync failed", error.message);
    });
    runAutomaticEarthquakeSync().catch((error) => {
      console.error("Scheduled earthquake sync failed", error.message);
    });
  }, intervalMs);
}

export async function fetchExternalSignalsSummary() {
  const fraudSummary = await fetchFraudServiceSummary();
  const summary = {
    weatherProvider: "OpenWeather",
    socialEventMode: "MANUAL_ADMIN_REVIEW",
    configured: Boolean(env.openWeatherApiKey),
    automaticWeatherSync: Boolean(env.openWeatherApiKey),
    fraudModel: fraudSummary
  };

  if (!summary.configured) {
    return summary;
  }

  try {
    await axios.get("https://api.openweathermap.org/data/2.5/weather", {
      params: { q: "Hyderabad,IN", appid: env.openWeatherApiKey },
      timeout: 8000
    });
    summary.weatherReachable = true;
  } catch (_error) {
    summary.weatherReachable = false;
  }

  try {
    await axios.get("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson", {
      timeout: 8000
    });
    summary.earthquakeFeedReachable = true;
  } catch (_error) {
    summary.earthquakeFeedReachable = false;
  }

  return summary;
}
