// ---------------------------------------------------------------------------
// Synthetic Ocean Current Data — Gulf Stream particle emitters
// ---------------------------------------------------------------------------
// Generates emitters along the Gulf Stream path from Gulf of Mexico to
// northern Europe. Particles flow along the current creating organic streams.
// ---------------------------------------------------------------------------

import type { EmitterConfig } from '../../engine/types';
import { lngLatToMercator } from '../../engine/projection';

/** Approximate Gulf Stream waypoints (lng, lat). */
const GULF_STREAM_PATH: [number, number][] = [
  [-80.0, 25.5],   // Florida Straits
  [-79.0, 28.0],   // Off Florida coast
  [-76.0, 32.0],   // Cape Hatteras
  [-72.0, 36.0],   // Off Virginia
  [-67.0, 40.0],   // Off New England
  [-55.0, 43.0],   // Grand Banks
  [-42.0, 47.0],   // Mid-Atlantic
  [-30.0, 50.0],   // Approaching Europe
  [-20.0, 52.0],   // North Atlantic Drift
  [-10.0, 54.0],   // Off Ireland
  [-5.0, 56.0],    // Scotland approach
];

/** North Atlantic Drift (continuation toward Norway). */
const NORTH_ATLANTIC_DRIFT: [number, number][] = [
  [-10.0, 54.0],
  [-5.0, 58.0],
  [0.0, 60.0],
  [5.0, 62.0],
  [8.0, 64.0],     // Norwegian coast
];

/**
 * Generate emitters along a path with given particle properties.
 */
function emittersAlongPath(
  path: [number, number][],
  options: {
    particleColor: [number, number, number, number];
    particleSize: number;
    rate: number;
    lifetime: number;
    velocityScale: number;
  },
): EmitterConfig[] {
  const emitters: EmitterConfig[] = [];

  for (let i = 0; i < path.length - 1; i++) {
    const [lng0, lat0] = path[i]!;
    const [lng1, lat1] = path[i + 1]!;
    const [mx, my, mz] = lngLatToMercator(lng0, lat0, 0);

    // Direction toward next waypoint (in Mercator)
    const [mx1, my1] = lngLatToMercator(lng1, lat1, 0);
    const dx = mx1 - mx;
    const dy = my1 - my;
    const len = Math.sqrt(dx * dx + dy * dy);
    const vx = len > 0 ? (dx / len) * options.velocityScale : 0;
    const vy = len > 0 ? (dy / len) * options.velocityScale : 0;

    emitters.push({
      position: [mx, my, mz],
      rate: options.rate,
      lifetime: options.lifetime,
      color: options.particleColor,
      size: options.particleSize,
      velocity: [vx, vy, 0],
      spread: 0.3,
    });

    // Add mid-point emitter for density
    const midLng = (lng0 + lng1) / 2;
    const midLat = (lat0 + lat1) / 2;
    const [mmx, mmy, mmz] = lngLatToMercator(midLng, midLat, 0);

    emitters.push({
      position: [mmx, mmy, mmz],
      rate: options.rate * 0.6,
      lifetime: options.lifetime * 0.8,
      color: options.particleColor,
      size: options.particleSize * 0.8,
      velocity: [vx, vy, 0],
      spread: 0.2,
    });
  }

  return emitters;
}

/**
 * Generate all ocean current emitters for the Gulf Stream and North Atlantic Drift.
 */
export function generateOceanCurrentEmitters(): EmitterConfig[] {
  const gulfStream = emittersAlongPath(GULF_STREAM_PATH, {
    particleColor: [0.15, 0.45, 0.85, 0.7],  // Deep ocean blue
    particleSize: 3.5,
    rate: 8,
    lifetime: 12,
    velocityScale: 0.000004,
  });

  const drift = emittersAlongPath(NORTH_ATLANTIC_DRIFT, {
    particleColor: [0.2, 0.55, 0.75, 0.6],  // Lighter blue-grey
    particleSize: 3.0,
    rate: 6,
    lifetime: 10,
    velocityScale: 0.000003,
  });

  return [...gulfStream, ...drift];
}
