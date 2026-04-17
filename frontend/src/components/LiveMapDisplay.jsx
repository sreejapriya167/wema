import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function LiveMapDisplay({ mapTriggers = [], riderLocations = [], selectedState = "India" }) {
  const mapContainer = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef({});

  // Default center for India
  const defaultCenters = {
    "Andhra Pradesh": { lat: 15.9129, lng: 78.6675 },
    "Karnataka": { lat: 15.3173, lng: 75.7139 },
    "Maharashtra": { lat: 19.7515, lng: 75.7139 },
    "Gujarat": { lat: 22.2587, lng: 71.1924 },
    "Rajasthan": { lat: 27.0238, lng: 74.2179 },
    "Uttar Pradesh": { lat: 26.8467, lng: 80.9462 },
    "India": { lat: 20.5937, lng: 78.9629 }
  };

  const center = defaultCenters[selectedState] || defaultCenters["India"];

  // Event type colors
  const eventColors = {
    HEAVY_RAIN: "#2563EB",
    CYCLONE: "#7F1D1D",
    FLOOD: "#1D4ED8",
    EXTREME_HEAT: "#F97316",
    SEVERE_POLLUTION: "#6B7280",
    EARTHQUAKE: "#7C3AED",
    BANDH: "#DC2626",
    CURFEW: "#DC2626",
    STRIKE: "#DC2626",
    ZONE_CLOSURE: "#DC2626"
  };

  const eventLabels = {
    HEAVY_RAIN: "🌧️",
    CYCLONE: "🌀",
    FLOOD: "💧",
    EXTREME_HEAT: "🔥",
    SEVERE_POLLUTION: "💨",
    EARTHQUAKE: "📍",
    BANDH: "⚠️",
    CURFEW: "🚨",
    STRIKE: "✊",
    ZONE_CLOSURE: "🚫"
  };

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize map
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapContainer.current).setView(
        [center.lat, center.lng],
        7
      );

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(mapInstance.current);
    } else {
      // Update center when state changes
      mapInstance.current.setView([center.lat, center.lng], 7);
    }

    // Clear old markers
    Object.values(markersRef.current).forEach((marker) => {
      mapInstance.current.removeLayer(marker);
    });
    markersRef.current = {};

    // Add weather/event markers
    mapTriggers.forEach((trigger) => {
      if (!trigger.lat || !trigger.lng) return;

      const color = eventColors[trigger.eventType] || "#3B82F6";
      const label = eventLabels[trigger.eventType] || "📍";

      // Create custom marker icon for events
      const markerHtml = `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: ${color};
          border: 3px solid white;
          border-radius: 50%;
          font-size: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          cursor: pointer;
        ">
          ${label}
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: "",
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
      });

      const marker = L.marker([trigger.lat, trigger.lng], {
        icon: customIcon
      })
        .bindPopup(`
          <div style="font-family: system-ui; font-size: 12px; min-width: 200px;">
            <div style="font-weight: bold; color: ${color}; margin-bottom: 8px;">
              ⚠️ ${trigger.label.toUpperCase()}
            </div>
            <div style="margin-bottom: 4px;">
              <strong>Location:</strong> ${trigger.city} / ${trigger.zoneCode}
            </div>
            <div style="margin-bottom: 4px;">
              <strong>Eligible Riders:</strong> ${trigger.eligibleRiders}
            </div>
            <div style="margin-top: 8px; font-size: 11px; color: #666;">
              Event ID: ${trigger._id.slice(-6).toUpperCase()}
            </div>
          </div>
        `, {
          maxWidth: 250
        })
        .addTo(mapInstance.current);

      markersRef.current[`event-${trigger._id}`] = marker;
    });

    // Add rider location markers for ALL riders
    riderLocations.forEach((rider) => {
      // Use currentGps from profile if available, otherwise use city center coordinates
      let lat, lng;

      // Check for GPS in profile.currentGps or direct currentGps
      const gps = rider.profile?.currentGps || rider.currentGps;

      if (gps?.lat && gps?.lng) {
        lat = gps.lat;
        lng = gps.lng;
      } else if (rider.city) {
        // If no GPS, use city center as fallback
        const cityCenters = {
          "Hyderabad": { lat: 17.3850, lng: 78.4867 },
          "Bangalore": { lat: 12.9716, lng: 77.5946 },
          "Mumbai": { lat: 19.0760, lng: 72.8777 },
          "Delhi": { lat: 28.7041, lng: 77.1025 },
          "Pune": { lat: 18.5204, lng: 73.8567 },
          "Chennai": { lat: 13.0827, lng: 80.2707 },
          "Kolkata": { lat: 22.5726, lng: 88.3639 },
          "Ahmedabad": { lat: 23.0225, lng: 72.5714 },
          "Jaipur": { lat: 26.9124, lng: 75.7873 },
          "Lucknow": { lat: 26.8467, lng: 80.9462 },
          "Indore": { lat: 22.7196, lng: 75.8577 },
          "Nagpur": { lat: 21.1458, lng: 79.0882 }
        };
        const cityCoords = cityCenters[rider.city];
        if (!cityCoords) return;
        lat = cityCoords.lat;
        lng = cityCoords.lng;
      } else {
        return; // Skip if no location data at all
      }

      // Different styling for active vs offline riders
      const isActive = rider.shiftPattern === "ACTIVE_SHIFT";
      const backgroundColor = isActive ? "#10B981" : "#6B7280";

      // Create custom marker icon for riders with SVG (motorcycle for active, location pin for offline)
      const riderMarkerHtml = isActive ? `
        <svg width="36" height="36" viewBox="0 0 36 36" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
          <circle cx="18" cy="18" r="16" fill="${backgroundColor}" stroke="white" stroke-width="3"/>
          <path d="M 10 18 Q 15 15 18 16 Q 21 15 26 18 M 12 20 L 14 22 M 24 20 L 22 22 M 18 22 L 18 26"
                stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      ` : `
        <svg width="36" height="36" viewBox="0 0 36 36" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
          <circle cx="18" cy="18" r="16" fill="${backgroundColor}" stroke="white" stroke-width="2"/>
          <path d="M 18 10 C 22.4 10 26 13.6 26 18 C 26 23 18 28 18 28 C 18 28 10 23 10 18 C 10 13.6 13.6 10 18 10"
                fill="none" stroke="white" stroke-width="2" stroke-linejoin="round"/>
          <circle cx="18" cy="18" r="3" fill="white"/>
        </svg>
      `;

      const riderIcon = L.divIcon({
        html: riderMarkerHtml,
        className: "",
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18]
      });

      const marker = L.marker([lat, lng], {
        icon: riderIcon
      })
        .bindPopup(`
          <div style="font-family: system-ui; font-size: 12px; min-width: 200px;">
            <div style="font-weight: bold; color: ${backgroundColor}; margin-bottom: 8px; font-size: 13px;">
              ${isActive ? "🏍️" : "📍"} ${rider.name}
            </div>
            <div style="margin-bottom: 4px;">
              <strong>Zone:</strong> ${rider.zone}
            </div>
            <div style="margin-bottom: 4px;">
              <strong>City:</strong> ${rider.city}
            </div>
            <div style="margin-bottom: 4px;">
              <strong>Plan:</strong> ${rider.plan}
            </div>
            <div style="margin-bottom: 4px;">
              <strong>KYC Status:</strong> ${rider.kycStatus}
            </div>
            <div style="margin-bottom: 4px;">
              <strong>Status:</strong> ${isActive ? "🟢 Active - Shift ON" : "🔴 Offline - Shift OFF"}
            </div>
            <div style="margin-bottom: 4px; font-size: 10px; color: #999;">
              Location: ${gps?.lat ? "Live GPS" : "City Center (Approximate)"}
            </div>
            <div style="margin-bottom: 4px; font-size: 10px;">
              <strong>Fraud Score:</strong> ${rider.fraudScore || "0"}
            </div>
            <div style="margin-top: 8px; font-size: 11px; color: #666;">
              Rider ID: ${rider._id.toString().slice(-6).toUpperCase()}
            </div>
          </div>
        `, {
          maxWidth: 250
        })
        .addTo(mapInstance.current);

      markersRef.current[`rider-${rider._id}`] = marker;
    });
  }, [mapTriggers, riderLocations, selectedState, center]);

  return (
    <div
      ref={mapContainer}
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "12px",
        overflow: "hidden",
        background: "#1a1a2e"
      }}
    />
  );
}

