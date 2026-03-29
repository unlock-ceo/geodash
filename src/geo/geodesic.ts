// ---------------------------------------------------------------------------
// Geodesic Math — great-circle distance, bearing, scale
// ---------------------------------------------------------------------------
// Pure math module. No external dependencies. Uses WGS84 reference ellipsoid
// parameters where appropriate, haversine for distance.
// ---------------------------------------------------------------------------

const EARTH_RADIUS_M = 6_371_000; // Mean radius in meters
const DEG_TO_RAD = Math.PI / 180;

// ---------------------------------------------------------------------------
// Core calculations
// ---------------------------------------------------------------------------

/**
 * Haversine distance between two points in meters.
 */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLon = (lon2 - lon1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

/**
 * Initial bearing (forward azimuth) from point 1 to point 2, in degrees [0, 360).
 */
export function initialBearing(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const φ1 = lat1 * DEG_TO_RAD;
  const φ2 = lat2 * DEG_TO_RAD;
  const Δλ = (lon2 - lon1) * DEG_TO_RAD;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return ((θ / DEG_TO_RAD) + 360) % 360;
}

// ---------------------------------------------------------------------------
// Scale calculations
// ---------------------------------------------------------------------------

/**
 * Ground resolution in meters per pixel at a given latitude and zoom level.
 * Based on Web Mercator tile math.
 */
export function metersPerPixelAtLatZoom(lat: number, zoom: number): number {
  const circumference = 2 * Math.PI * EARTH_RADIUS_M;
  return (circumference * Math.cos(lat * DEG_TO_RAD)) / (256 * Math.pow(2, zoom));
}

/**
 * Pick a human-friendly round distance for a scale bar.
 * Returns [distance in meters, label string].
 */
export function roundScaleDistance(metersPerPx: number, maxBarWidthPx: number): [number, string] {
  const maxMeters = metersPerPx * maxBarWidthPx;

  // Round numbers to choose from
  const candidates = [
    1, 2, 5, 10, 20, 50, 100, 200, 500,
    1_000, 2_000, 5_000, 10_000, 20_000, 50_000,
    100_000, 200_000, 500_000, 1_000_000, 2_000_000, 5_000_000,
  ];

  // Find largest round number that fits in the bar
  let best = candidates[0]!;
  for (const c of candidates) {
    if (c <= maxMeters) best = c;
    else break;
  }

  // Format label
  const label = best >= 1000 ? `${best / 1000} km` : `${best} m`;
  return [best, label];
}

/**
 * Format a coordinate as a human-readable string with hemisphere letters.
 * e.g., "40.6892°N 74.0445°W"
 */
export function formatCoordinate(lat: number, lng: number, decimals: number = 4): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(decimals)}°${latDir} ${Math.abs(lng).toFixed(decimals)}°${lngDir}`;
}
