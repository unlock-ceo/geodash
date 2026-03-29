// ---------------------------------------------------------------------------
// Synthetic NYC Hex Grid Data
// ---------------------------------------------------------------------------
// Generates a hexagonal grid of particles over New York City for the Act 2
// visualisation.  Activity values are synthetic — higher near Midtown
// Manhattan — and mapped to a cool-blue-to-hot-amber colour ramp.
// ---------------------------------------------------------------------------

import { lngLatToMercator } from '../../engine/projection';

// ---------------------------------------------------------------------------
// NYC geography
// ---------------------------------------------------------------------------

const NYC_BOUNDS = {
  minLng: -74.06,
  maxLng: -73.82,
  minLat: 40.63,
  maxLat: 40.84,
};

/** Midtown Manhattan — epicentre of activity. */
const MANHATTAN_CENTER = { lng: -73.985, lat: 40.758 };

/** Secondary hotspots to add interest. */
const HOTSPOTS: { lng: number; lat: number; weight: number }[] = [
  { lng: -73.985, lat: 40.758, weight: 1.0 },   // Times Square / Midtown
  { lng: -74.006, lat: 40.713, weight: 0.7 },   // Financial District
  { lng: -73.955, lat: 40.768, weight: 0.5 },   // Central Park East
  { lng: -73.944, lat: 40.728, weight: 0.45 },  // East Village
  { lng: -73.988, lat: 40.692, weight: 0.35 },  // Downtown Brooklyn
  { lng: -73.913, lat: 40.774, weight: 0.3 },   // Astoria
  { lng: -73.949, lat: 40.805, weight: 0.4 },   // Harlem
];

// ---------------------------------------------------------------------------
// Colour ramp: dark navy -> teal -> amber -> hot pink
// ---------------------------------------------------------------------------

interface RampStop {
  t: number;
  r: number;
  g: number;
  b: number;
}

const COLOR_RAMP: RampStop[] = [
  { t: 0.0, r: 0.04, g: 0.05, b: 0.15 },  // deep navy
  { t: 0.2, r: 0.05, g: 0.15, b: 0.35 },  // dark blue
  { t: 0.4, r: 0.08, g: 0.40, b: 0.50 },  // teal
  { t: 0.6, r: 0.30, g: 0.60, b: 0.30 },  // green-teal
  { t: 0.75, r: 0.80, g: 0.60, b: 0.10 }, // amber
  { t: 0.9, r: 0.95, g: 0.35, b: 0.20 },  // hot orange
  { t: 1.0, r: 1.00, g: 0.25, b: 0.55 },  // hot pink
];

function sampleRamp(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));

  // Find bounding stops
  let lo = COLOR_RAMP[0]!;
  let hi = COLOR_RAMP[COLOR_RAMP.length - 1]!;
  for (let i = 0; i < COLOR_RAMP.length - 1; i++) {
    const a = COLOR_RAMP[i]!;
    const b = COLOR_RAMP[i + 1]!;
    if (clamped >= a.t && clamped <= b.t) {
      lo = a;
      hi = b;
      break;
    }
  }

  const segLen = hi.t - lo.t;
  const local = segLen > 0 ? (clamped - lo.t) / segLen : 0;

  return [
    lo.r + (hi.r - lo.r) * local,
    lo.g + (hi.g - lo.g) * local,
    lo.b + (hi.b - lo.b) * local,
  ];
}

// ---------------------------------------------------------------------------
// Activity function
// ---------------------------------------------------------------------------

/**
 * Compute a synthetic "activity" value at a given lng/lat.
 * Returns a value in [0, 1].
 *
 * Uses a sum of Gaussians centred on known hotspots, plus a light
 * pseudo-random jitter so the grid has organic variation.
 */
function activityAt(lng: number, lat: number): number {
  let total = 0;

  for (const hs of HOTSPOTS) {
    const dlng = (lng - hs.lng) * Math.cos(lat * Math.PI / 180); // crude aspect correction
    const dlat = lat - hs.lat;
    const dist2 = dlng * dlng + dlat * dlat;
    const sigma = 0.015; // Gaussian width in degrees
    total += hs.weight * Math.exp(-dist2 / (2 * sigma * sigma));
  }

  // Light hash-based jitter
  const hash = Math.sin(lng * 12345.6789 + lat * 98765.4321) * 43758.5453;
  const jitter = (hash - Math.floor(hash)) * 0.15;

  return Math.max(0, Math.min(1, total + jitter));
}

// ---------------------------------------------------------------------------
// Hex grid generation
// ---------------------------------------------------------------------------

/**
 * Generate a flat-top hex grid of particles covering the NYC bounding box.
 *
 * @param resolution  Approximate spacing in degrees between hex centres.
 *                    Default 0.003 (~330 m) produces ~2000-3000 hexes.
 *
 * @returns  GPU-ready SoA buffers (positions in Mercator) plus count.
 */
export function generateNYCHexGrid(resolution: number = 0.003): {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  count: number;
} {
  const dx = resolution;              // horizontal spacing
  const dy = resolution * Math.sqrt(3) / 2; // vertical spacing (flat-top hex)

  // Collect points
  const points: { lng: number; lat: number; activity: number }[] = [];

  let row = 0;
  for (let lat = NYC_BOUNDS.minLat; lat <= NYC_BOUNDS.maxLat; lat += dy) {
    const offset = (row % 2 === 0) ? 0 : dx / 2;
    for (let lng = NYC_BOUNDS.minLng + offset; lng <= NYC_BOUNDS.maxLng; lng += dx) {
      const a = activityAt(lng, lat);
      // Skip very low-activity hexes in water/peripheral areas
      if (a < 0.02) continue;
      points.push({ lng, lat, activity: a });
    }
    row++;
  }

  const count = points.length;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 4);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const pt = points[i]!;

    // Position in Mercator
    const [mx, my, mz] = lngLatToMercator(pt.lng, pt.lat, 0);
    const i3 = i * 3;
    positions[i3] = mx;
    positions[i3 + 1] = my;
    positions[i3 + 2] = mz;

    // Colour from ramp
    const [r, g, b] = sampleRamp(pt.activity);
    const i4 = i * 4;
    colors[i4] = r;
    colors[i4 + 1] = g;
    colors[i4 + 2] = b;
    colors[i4 + 3] = 0.5 + pt.activity * 0.5; // alpha ramps with activity

    // Size: base + activity scaling
    sizes[i] = 2.0 + pt.activity * 8.0;
  }

  return { positions, colors, sizes, count };
}

// ---------------------------------------------------------------------------
// Temporal pulse
// ---------------------------------------------------------------------------

/**
 * Create a radial pulse wave function that emanates from a centre point.
 *
 * The returned function computes a multiplicative scale factor [0..1] for a
 * particle at (lng, lat) at the given `time` (seconds).  The wave peaks
 * repeat with a period defined by `speed` and the ring radius.
 *
 * @param center  Centre of the pulse in lng/lat.
 * @param speed   Wave speed in degrees per second (~0.008 is a nice pace).
 */
export function createTemporalPulse(
  center: { lng: number; lat: number } = MANHATTAN_CENTER,
  speed: number = 0.008,
): (lng: number, lat: number, time: number) => number {
  return (lng: number, lat: number, time: number): number => {
    const dlng = (lng - center.lng) * Math.cos(center.lat * Math.PI / 180);
    const dlat = lat - center.lat;
    const dist = Math.sqrt(dlng * dlng + dlat * dlat);

    // Expanding ring with Gaussian profile
    const radius = (time * speed) % 0.12; // wrap at ~0.12 deg for repeating pulse
    const diff = Math.abs(dist - radius);
    const ringWidth = 0.012;
    const ring = Math.exp(-(diff * diff) / (2 * ringWidth * ringWidth));

    return ring;
  };
}

/**
 * Apply a temporal pulse to existing particle data in-place.
 *
 * Modulates both sizes (grow) and colours (warm shift) based on the pulse
 * function.  Call this each frame in the Act 2 update loop.
 *
 * @param positions    Mercator positions (x,y,z interleaved)
 * @param baseColors   Original unmodulated colours (RGBA interleaved)
 * @param baseSizes    Original unmodulated sizes
 * @param outColors    Output colour buffer to write (same layout as baseColors)
 * @param outSizes     Output size buffer to write
 * @param count        Number of particles
 * @param lngLats      Original lng/lat pairs (interleaved [lng, lat, lng, lat, ...])
 * @param pulse        The pulse function from createTemporalPulse
 * @param time         Current time in seconds
 */
export function applyTemporalPulse(
  _positions: Float32Array,
  baseColors: Float32Array,
  baseSizes: Float32Array,
  outColors: Float32Array,
  outSizes: Float32Array,
  count: number,
  lngLats: Float32Array,
  pulse: (lng: number, lat: number, time: number) => number,
  time: number,
): void {
  for (let i = 0; i < count; i++) {
    const lng = lngLats[i * 2]!;
    const lat = lngLats[i * 2 + 1]!;
    const intensity = pulse(lng, lat, time);

    // Size: swell by up to 2.5x at peak
    outSizes[i] = (baseSizes[i] ?? 2) * (1.0 + intensity * 2.5);

    // Colour: warm shift — blend toward amber [0.95, 0.6, 0.15]
    const i4 = i * 4;
    const blend = intensity * 0.85;
    outColors[i4] = (baseColors[i4] ?? 0) * (1 - blend) + 0.95 * blend;
    outColors[i4 + 1] = (baseColors[i4 + 1] ?? 0) * (1 - blend) + 0.60 * blend;
    outColors[i4 + 2] = (baseColors[i4 + 2] ?? 0) * (1 - blend) + 0.15 * blend;
    outColors[i4 + 3] = Math.min(1.0, (baseColors[i4 + 3] ?? 0.5) + intensity * 0.4);
  }
}
