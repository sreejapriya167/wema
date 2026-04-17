export const PIN_CITY_MAP = {
  "524201": "kavali",
  "524001": "nellore",
  "520001": "vijayawada",
  "530001": "visakhapatnam",
  "522001": "guntur",
  "517501": "tirupati",
  "500001": "hyderabad",
  "600001": "chennai",
  "400001": "mumbai",
  "560001": "bengaluru"
};

export const PIN_GEO_MAP = {
  "524201": { city: "kavali", lat: 14.913, lng: 79.995 },
  "524001": { city: "nellore", lat: 14.4426, lng: 79.9865 },
  "520001": { city: "vijayawada", lat: 16.5062, lng: 80.648 },
  "530001": { city: "visakhapatnam", lat: 17.6868, lng: 83.2185 },
  "522001": { city: "guntur", lat: 16.3067, lng: 80.4365 },
  "517501": { city: "tirupati", lat: 13.6288, lng: 79.4192 },
  "500001": { city: "hyderabad", lat: 17.4948, lng: 78.3996 },
  "600001": { city: "chennai", lat: 13.0827, lng: 80.2707 },
  "400001": { city: "mumbai", lat: 19.076, lng: 72.8777 },
  "560001": { city: "bengaluru", lat: 12.9716, lng: 77.5946 },
  "110001": { city: "delhi", lat: 28.6448, lng: 77.2167 },
  "700001": { city: "kolkata", lat: 22.5726, lng: 88.3639 },
  "302001": { city: "jaipur", lat: 26.9124, lng: 75.7873 },
  "682001": { city: "kochi", lat: 9.9312, lng: 76.2673 },
  "641001": { city: "coimbatore", lat: 11.0168, lng: 76.9558 },
  "411001": { city: "pune", lat: 18.5204, lng: 73.8567 }
};

export function normalizePin(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

export function isValidPin(pin) {
  return /^\d{6}$/.test(pin);
}

export function cityFromPin(pin) {
  return PIN_CITY_MAP[pin];
}
