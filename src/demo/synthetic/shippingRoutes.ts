// ---------------------------------------------------------------------------
// Synthetic Shipping / Flight Route Data
// ---------------------------------------------------------------------------
// Generates great-circle emitter configurations for Act 1's globe overview.
// Each route produces multiple emitters spaced along the arc, with particle
// velocities oriented in the direction of travel.  The result is a living,
// breathing globe of commerce and transit.
// ---------------------------------------------------------------------------

import type { EmitterConfig } from '../../engine/types';
import { lngLatToMercator } from '../../engine/projection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RoutePoint {
  lng: number;
  lat: number;
}

interface Route {
  from: RoutePoint;
  to: RoutePoint;
  color: [number, number, number, number];
}

// ---------------------------------------------------------------------------
// Route catalogue — major trade / flight corridors
// ---------------------------------------------------------------------------

const ROUTES: Route[] = [
  // Trans-Pacific
  { from: { lng: 121.47, lat: 31.23 }, to: { lng: -122.42, lat: 37.77 }, color: [0.2, 0.6, 1.0, 0.8] },
  // Trans-Atlantic
  { from: { lng: -73.94, lat: 40.67 }, to: { lng: -0.12, lat: 51.51 }, color: [0.3, 0.7, 0.9, 0.8] },
  // Europe to SE Asia
  { from: { lng: 3.38, lat: 51.35 }, to: { lng: 103.82, lat: 1.35 }, color: [0.4, 0.8, 0.8, 0.7] },
  // South America to Africa
  { from: { lng: -43.17, lat: -22.91 }, to: { lng: 18.42, lat: -33.92 }, color: [0.5, 0.5, 0.9, 0.7] },
  // Middle East to East Asia
  { from: { lng: 55.27, lat: 25.20 }, to: { lng: 139.69, lat: 35.69 }, color: [0.6, 0.4, 0.8, 0.7] },
  // West Africa to Europe
  { from: { lng: 3.39, lat: 6.45 }, to: { lng: 2.35, lat: 48.86 }, color: [0.3, 0.6, 0.7, 0.7] },
  // Australia to SE Asia
  { from: { lng: 151.21, lat: -33.87 }, to: { lng: 106.85, lat: -6.21 }, color: [0.4, 0.7, 0.6, 0.7] },
  // Hong Kong to LA
  { from: { lng: 114.17, lat: 22.28 }, to: { lng: -118.24, lat: 33.94 }, color: [0.2, 0.5, 0.9, 0.8] },
  // Bangkok to Istanbul
  { from: { lng: 100.52, lat: 13.75 }, to: { lng: 28.98, lat: 41.01 }, color: [0.5, 0.6, 0.7, 0.7] },
  // NYC to Madrid
  { from: { lng: -73.94, lat: 40.67 }, to: { lng: -3.70, lat: 40.42 }, color: [0.3, 0.7, 0.8, 0.7] },
  // Tokyo to Sydney
  { from: { lng: 139.69, lat: 35.69 }, to: { lng: 151.21, lat: -33.87 }, color: [0.35, 0.55, 0.85, 0.7] },
  // London to Dubai
  { from: { lng: -0.12, lat: 51.51 }, to: { lng: 55.27, lat: 25.20 }, color: [0.45, 0.65, 0.75, 0.7] },
  // San Francisco to Honolulu
  { from: { lng: -122.42, lat: 37.77 }, to: { lng: -157.85, lat: 21.31 }, color: [0.25, 0.70, 0.95, 0.7] },
  // Cape Town to Mumbai
  { from: { lng: 18.42, lat: -33.92 }, to: { lng: 72.88, lat: 19.08 }, color: [0.55, 0.45, 0.75, 0.7] },
  // Panama to Rotterdam
  { from: { lng: -79.52, lat: 8.98 }, to: { lng: 4.47, lat: 51.92 }, color: [0.30, 0.60, 0.90, 0.7] },
  // Singapore to Shanghai
  { from: { lng: 103.82, lat: 1.35 }, to: { lng: 121.47, lat: 31.23 }, color: [0.40, 0.75, 0.70, 0.7] },
  // LA to Tokyo
  { from: { lng: -118.24, lat: 33.94 }, to: { lng: 139.69, lat: 35.69 }, color: [0.22, 0.58, 0.92, 0.8] },
  // Buenos Aires to Lagos
  { from: { lng: -58.38, lat: -34.60 }, to: { lng: 3.39, lat: 6.45 }, color: [0.48, 0.52, 0.82, 0.7] },
];

// ---------------------------------------------------------------------------
// Great-circle interpolation (Slerp on the unit sphere)
// ---------------------------------------------------------------------------

function greatCirclePoint(from: RoutePoint, to: RoutePoint, t: number): RoutePoint {
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;

  const lat1 = from.lat * toRad;
  const lng1 = from.lng * toRad;
  const lat2 = to.lat * toRad;
  const lng2 = to.lng * toRad;

  // Central angle via Vincenty formula (numerically stable)
  const dLng = lng2 - lng1;
  const cosLat2 = Math.cos(lat2);
  const sinLat1 = Math.sin(lat1);
  const sinLat2 = Math.sin(lat2);
  const cosLat1 = Math.cos(lat1);

  const a = cosLat2 * Math.sin(dLng);
  const b = cosLat1 * sinLat2 - sinLat1 * cosLat2 * Math.cos(dLng);
  const d = Math.atan2(Math.sqrt(a * a + b * b), sinLat1 * sinLat2 + cosLat1 * cosLat2 * Math.cos(dLng));

  if (d < 0.0001) return from;

  const sinD = Math.sin(d);
  const A = Math.sin((1 - t) * d) / sinD;
  const B = Math.sin(t * d) / sinD;

  const x = A * cosLat1 * Math.cos(lng1) + B * cosLat2 * Math.cos(lng2);
  const y = A * cosLat1 * Math.sin(lng1) + B * cosLat2 * Math.sin(lng2);
  const z = A * sinLat1 + B * sinLat2;

  return {
    lat: Math.atan2(z, Math.sqrt(x * x + y * y)) * toDeg,
    lng: Math.atan2(y, x) * toDeg,
  };
}

/**
 * Compute unit tangent vector (in lng/lat degrees per unit) at parameter t
 * along the great circle from `from` to `to`.  Used to orient particle velocity.
 */
function greatCircleTangent(from: RoutePoint, to: RoutePoint, t: number): [number, number] {
  const dt = 0.001;
  const p0 = greatCirclePoint(from, to, Math.max(0, t - dt));
  const p1 = greatCirclePoint(from, to, Math.min(1, t + dt));
  const dlng = p1.lng - p0.lng;
  const dlat = p1.lat - p0.lat;
  const len = Math.sqrt(dlng * dlng + dlat * dlat);
  if (len < 1e-9) return [0, 0];
  return [dlng / len, dlat / len];
}

// ---------------------------------------------------------------------------
// Emitter generation
// ---------------------------------------------------------------------------

/** Number of emitters placed along each route arc. */
const EMITTERS_PER_ROUTE = 6;

/**
 * Generate particle emitter configs for all shipping / flight routes.
 *
 * Each route gets `EMITTERS_PER_ROUTE` emitters evenly spaced along the
 * great-circle path.  Particles flow in the direction of travel at a speed
 * proportional to the Mercator-space distance, with gentle spread for volume.
 */
export function generateShippingEmitters(): EmitterConfig[] {
  const emitters: EmitterConfig[] = [];

  for (const route of ROUTES) {
    for (let i = 0; i < EMITTERS_PER_ROUTE; i++) {
      const t = (i + 0.5) / EMITTERS_PER_ROUTE; // center of each segment
      const pt = greatCirclePoint(route.from, route.to, t);
      const tangent = greatCircleTangent(route.from, route.to, t);

      // Convert position to Mercator
      const [mx, my, mz] = lngLatToMercator(pt.lng, pt.lat, 0);

      // Convert tangent to Mercator direction (finite difference)
      const step = 0.02;
      const ptAhead = greatCirclePoint(route.from, route.to, Math.min(1, t + step));
      const [mxA, myA] = lngLatToMercator(ptAhead.lng, ptAhead.lat, 0);
      const dxM = mxA - mx;
      const dyM = myA - my;
      const lenM = Math.sqrt(dxM * dxM + dyM * dyM);

      // Velocity magnitude in Mercator units/sec — tuned for visual speed
      const speed = 0.00004;
      const vx = lenM > 1e-12 ? (dxM / lenM) * speed : tangent[0] * speed * 0.001;
      const vy = lenM > 1e-12 ? (dyM / lenM) * speed : tangent[1] * speed * 0.001;

      emitters.push({
        rate: 12, // particles per second per emitter
        position: [mx, my, mz],
        positionSpread: [0.002, 0.002, 0],
        velocity: [vx, vy, 0],
        velocitySpread: [speed * 0.15, speed * 0.15, 0],
        color: route.color,
        colorSpread: [0.05, 0.05, 0.05, 0.1],
        size: 3.0,
        sizeSpread: 1.5,
        lifetime: 4.0,
        lifetimeSpread: 1.5,
        mass: 1.0,
        massSpread: 0.2,
      });
    }
  }

  return emitters;
}

/**
 * Get the raw route definitions (useful for debug overlay / line rendering).
 */
export function getRoutes(): Route[] {
  return ROUTES;
}

/**
 * Sample a complete great-circle polyline for a single route.
 * Returns an array of lng/lat points.
 */
export function sampleRoute(
  route: Route,
  segments: number = 64,
): RoutePoint[] {
  const pts: RoutePoint[] = [];
  for (let i = 0; i <= segments; i++) {
    pts.push(greatCirclePoint(route.from, route.to, i / segments));
  }
  return pts;
}
