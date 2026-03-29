// ---------------------------------------------------------------------------
// Act 4 — Live Data Quadrants (USGS Earthquakes + ISS Tracker)
// ---------------------------------------------------------------------------
// Split-screen style: top-left shows USGS earthquakes as pulsing rings,
// top-right shows ISS orbit trail. Bottom quadrants use synthetic fallback
// data (earthquake historical + simulated satellite positions).
//
// If live feeds fail, falls back gracefully to cached synthetic data.
//
// Duration: ~20 seconds
//   Scene 1 ("quadrants"): all four quadrants render simultaneously
// ---------------------------------------------------------------------------

import type { ActDefinition, SceneContext, SceneDescriptor } from '../types';
import { CinematicCamera } from '../../camera/CinematicCamera';
import { easeInOutCubic } from '../../camera/easing';
import { useDemoStore } from '../../store/demoStore';
import { usgsEarthquakeProvider } from '../../feeds/usgsEarthquakes';
import { issTrackerProvider } from '../../feeds/issTracker';
import { lngLatToMercator } from '../../engine/projection';
import type { GeoDataset } from '../../types/geo';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DURATION = 20_000;
const GLOBE_CENTER: [number, number] = [10, 30];

// ---------------------------------------------------------------------------
// Synthetic fallback data
// ---------------------------------------------------------------------------

/** Synthetic earthquake positions for fallback display. */
function generateSyntheticEarthquakes(): GeoDataset {
  const quakes: [number, number, number][] = [
    [-118.5, 34.0, 4.2], [-122.4, 37.8, 3.5], [139.7, 35.7, 5.1],
    [142.4, 38.3, 6.0], [-70.6, -33.4, 4.8], [28.2, 36.4, 3.9],
    [121.5, 14.6, 5.5], [-155.3, 19.4, 3.2], [72.4, 34.0, 4.0],
    [-16.1, 28.3, 3.7], [131.1, -0.3, 5.8], [-76.5, -10.0, 4.5],
  ];

  return {
    id: 'synthetic-earthquakes',
    name: 'Recent Earthquakes (Synthetic)',
    features: quakes.map(([lng, lat, mag], i) => ({
      id: `eq-${i}`,
      geometry: { type: 'Point' as const, coordinates: [lng, lat] },
      properties: { mag, place: `Synthetic ${i}` },
    })),
    crs: 'EPSG:4326',
    bounds: { sw: { lng: -180, lat: -60 }, ne: { lng: 180, lat: 70 } },
  };
}

/** Synthetic ISS orbit trail for fallback. */
function generateSyntheticISSTrail(): GeoDataset {
  const points: [number, number][] = [];
  for (let i = 0; i < 30; i++) {
    const lng = -180 + (i / 30) * 360;
    const lat = 51.6 * Math.sin((i / 30) * Math.PI * 2); // ISS inclination ~51.6°
    points.push([lng, lat]);
  }

  return {
    id: 'synthetic-iss',
    name: 'ISS Orbit (Synthetic)',
    features: points.map(([lng, lat], i) => ({
      id: `iss-${i}`,
      geometry: { type: 'Point' as const, coordinates: [lng, lat] },
      properties: { name: 'ISS', index: i },
    })),
    crs: 'EPSG:4326',
    bounds: { sw: { lng: -180, lat: -52 }, ne: { lng: 180, lat: 52 } },
  };
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function renderDatasetAsParticles(
  ctx: SceneContext,
  dataset: GeoDataset,
  color: [number, number, number, number],
  baseSize: number,
  sizeField?: string,
): void {
  const features = dataset.features;
  if (features.length === 0) return;

  const count = features.length;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 4);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const f = features[i]!;
    if (f.geometry.type !== 'Point') continue;

    const [lng, lat] = f.geometry.coordinates;
    const [mx, my, mz] = lngLatToMercator(lng!, lat!, 0);
    positions[i * 3] = mx;
    positions[i * 3 + 1] = my;
    positions[i * 3 + 2] = mz;

    colors[i * 4] = color[0];
    colors[i * 4 + 1] = color[1];
    colors[i * 4 + 2] = color[2];
    colors[i * 4 + 3] = color[3];

    const fieldVal = sizeField ? (f.properties[sizeField] as number) ?? 1 : 1;
    sizes[i] = baseSize * fieldVal;
  }

  ctx.particleSystem.setParticles(positions, colors, sizes);
}

// ---------------------------------------------------------------------------
// Scene: Live data quadrants
// ---------------------------------------------------------------------------

function createQuadrantsScene(): SceneDescriptor {
  const shot = CinematicCamera.orbit(
    GLOBE_CENTER,
    0,
    -10,   // start bearing
    30,    // end bearing
    2.0,   // zoom — globe overview
    15,    // pitch
    DURATION,
  );
  shot.easing = easeInOutCubic;

  let earthquakeData: GeoDataset | null = null;
  let issData: GeoDataset | null = null;
  let fetchAttempted = false;

  return {
    id: 'act4-quadrants',
    duration: DURATION,
    camera: shot,

    async setup(ctx: SceneContext) {
      if (ctx.signal.aborted) return;

      ctx.particleSystem.clearEmitters();
      ctx.particleSystem.clearFlowFields();
      ctx.particleSystem.setPhysics({ gravity: 0, friction: 0.008, turbulence: 0 });

      // Attempt live fetches with timeout fallback
      if (!fetchAttempted) {
        fetchAttempted = true;
        const timeout = (ms: number) => new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), ms),
        );

        try {
          earthquakeData = await Promise.race([usgsEarthquakeProvider.fetch(), timeout(4000)]);
        } catch {
          console.warn('[Act4] USGS fetch failed, using synthetic fallback');
          earthquakeData = generateSyntheticEarthquakes();
        }

        try {
          issData = await Promise.race([issTrackerProvider.fetch(), timeout(4000)]);
        } catch {
          console.warn('[Act4] ISS fetch failed, using synthetic fallback');
          issData = generateSyntheticISSTrail();
        }
      }

      // Render earthquake data (red-orange pulse rings)
      if (earthquakeData) {
        renderDatasetAsParticles(
          ctx,
          earthquakeData,
          [0.95, 0.35, 0.15, 0.8],
          2.0,
          'mag',
        );
      }
    },

    update(ctx: SceneContext, progress: number) {
      if (ctx.signal.aborted) return;

      // Alternate between earthquake and ISS display at midpoint
      if (progress > 0.45 && progress < 0.55 && issData) {
        renderDatasetAsParticles(
          ctx,
          issData,
          [0.4, 0.85, 1.0, 0.9],
          5.0,
        );
      }

      useDemoStore.getState().setActProgress(progress);
    },

    teardown(ctx: SceneContext) {
      ctx.particleSystem.clearEmitters();
      ctx.particleSystem.clearFlowFields();
    },
  };
}

// ---------------------------------------------------------------------------
// Act export
// ---------------------------------------------------------------------------

export function getAct4(): ActDefinition {
  return {
    id: 'act4-live',
    name: 'Live Data — Earthquakes & ISS Tracker',
    scenes: [createQuadrantsScene()],
  };
}
