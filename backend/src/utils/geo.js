export function haversineDistanceKm(pointA, pointB) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latDelta = toRad(pointB.lat - pointA.lat);
  const lngDelta = toRad(pointB.lng - pointA.lng);
  const lat1 = toRad(pointA.lat);
  const lat2 = toRad(pointB.lat);

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

export function isPointWithinRadius(point, center, radiusKm) {
  return haversineDistanceKm(point, center) <= radiusKm;
}

export function polygonsOverlap(zoneA = [], zoneB = []) {
  if (!zoneA.length || !zoneB.length) {
    return false;
  }

  return zoneA.some((a) =>
    zoneB.some((b) => Math.abs(a.lat - b.lat) < 0.02 && Math.abs(a.lng - b.lng) < 0.02)
  );
}

export function buildCirclePolygon(center, radiusKm) {
  const latOffset = radiusKm / 111;
  const lngOffset = radiusKm / (111 * Math.cos((center.lat * Math.PI) / 180 || 1));

  return [
    { lat: center.lat + latOffset, lng: center.lng },
    { lat: center.lat, lng: center.lng + lngOffset },
    { lat: center.lat - latOffset, lng: center.lng },
    { lat: center.lat, lng: center.lng - lngOffset }
  ];
}
