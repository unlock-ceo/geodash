// ---------------------------------------------------------------------------
// Act 2 — NYC Hex Grid Dive with Temporal Pulse
// ---------------------------------------------------------------------------
// The camera sweeps from the globe down into New York City.  As it arrives,
// the shipping-route particles fade out and a dense hex grid materialises
// over Manhattan and its boroughs.  A radial pulse wave emanates from
// Times Square every few seconds, swelling particle sizes and shifting
// colours toward hot amber — a heartbeat for the city.
//
// Duration: ~25 seconds total
//   Scene 1 ("dive")  : globeToCity camera transition, clear globe particles,
//                        spawn hex grid as camera arrives (~8s)
//   Scene 2 ("pulse") : temporal pulse loop with slow city orbit (~17s)
// ---------------------------------------------------------------------------

import type { ActDefinition, SceneContext, SceneDescriptor } from '../types';
import type { FlowField } from '../../engine/types';
import { CinematicCamera } from '../../camera/CinematicCamera';
import { easeInOutCubic } from '../../camera/easing';
import {
  generateNYCHexGrid,
  createTemporalPulse,
  applyTemporalPulse,
} from '../synthetic/nycGrid';
import { useDemoStore } from '../../store/demoStore';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NYC_CENTER: [number, number] = [-73.985, 40.758]; // Times Square area
const DIVE_DURATION = 8_000;  // 8 seconds for the city dive
const PULSE_DURATION = 17_000; // 17 seconds for pulse + orbit

// ---------------------------------------------------------------------------
// City-level micro-turbulence flow field
// ---------------------------------------------------------------------------

class CityTurbulenceField implements FlowField {
  sample(x: number, y: number, _z: number, time: number): [number, number, number] {
    // Very gentle drift — urban "heat shimmer" effect
    const s = 0.0000015;
    const fx = Math.sin(y * 50000 + time * 0.5) * s;
    const fy = Math.cos(x * 50000 - time * 0.7) * s;
    return [fx, fy, 0];
  }
}

// ---------------------------------------------------------------------------
// Scene 1: Dive into NYC
// ---------------------------------------------------------------------------

function createDiveScene(): SceneDescriptor {
  const diveShot = CinematicCamera.globeToCity(NYC_CENTER, DIVE_DURATION);

  // We'll hold the hex grid data so the pulse scene can reference it
  let hexGridSpawned = false;

  return {
    id: 'act2-dive',
    duration: DIVE_DURATION,
    camera: diveShot,

    setup(ctx: SceneContext) {
      if (ctx.signal.aborted) return;
      hexGridSpawned = false;

      // Physics: zero gravity, low friction for the city view
      ctx.particleSystem.setPhysics({
        gravity: 0,
        friction: 0.005,
        turbulence: 0,
      });
    },

    update(ctx: SceneContext, progress: number) {
      if (ctx.signal.aborted) return;

      // At ~70% through the dive, clear globe emitters and spawn hex grid
      if (progress > 0.7 && !hexGridSpawned) {
        hexGridSpawned = true;

        const { particleSystem } = ctx;

        // Clear shipping route emitters and flow fields
        particleSystem.clearEmitters();
        particleSystem.clearFlowFields();

        // Add city-level micro-turbulence
        particleSystem.addFlowField(new CityTurbulenceField());

        // Generate and set hex grid particles
        const grid = generateNYCHexGrid(0.003);
        particleSystem.setParticles(grid.positions, grid.colors, grid.sizes);
      }

      // Update progress — dive is ~30% of act
      useDemoStore.getState().setActProgress(progress * 0.3);
    },

    teardown(_ctx: SceneContext) {
      // Leave particles in place for the pulse scene
    },
  };
}

// ---------------------------------------------------------------------------
// Scene 2: Temporal pulse with slow orbit
// ---------------------------------------------------------------------------

function createPulseScene(): SceneDescriptor {
  // Slow orbit around NYC at street level
  const orbitShot = CinematicCamera.orbit(
    NYC_CENTER,
    0,            // radius (encoded in zoom)
    -20,          // start bearing
    40,           // end bearing (slow 60-deg sweep)
    14.5,         // zoom — close to street level
    60,           // pitch — looking down at an angle
    PULSE_DURATION,
  );
  orbitShot.easing = easeInOutCubic;

  // Mutable state for the pulse animation
  let pulseFn: ((lng: number, lat: number, time: number) => number) | null = null;
  let basePositions: Float32Array | null = null;
  let baseColors: Float32Array | null = null;
  let baseSizes: Float32Array | null = null;
  let lngLats: Float32Array | null = null;
  let gridCount = 0;
  let pulseStartTime = 0;

  // Working buffers (reused each frame)
  let workColors: Float32Array | null = null;
  let workSizes: Float32Array | null = null;

  return {
    id: 'act2-pulse',
    duration: PULSE_DURATION,
    camera: orbitShot,

    setup(ctx: SceneContext) {
      if (ctx.signal.aborted) return;

      // Create the pulse function centred on Times Square
      pulseFn = createTemporalPulse({ lng: NYC_CENTER[0], lat: NYC_CENTER[1] }, 0.008);
      pulseStartTime = performance.now() / 1000;

      // Regenerate grid to capture fresh base data for modulation
      const grid = generateNYCHexGrid(0.003);
      gridCount = grid.count;

      // Store base positions, colours, and sizes for modulation
      basePositions = new Float32Array(grid.positions);
      baseColors = new Float32Array(grid.colors);
      baseSizes = new Float32Array(grid.sizes);

      // Build lng/lat lookup from positions (reverse Mercator isn't worth it;
      // regenerate from the grid generation logic)
      lngLats = new Float32Array(gridCount * 2);
      // We need the original lng/lat pairs. Regenerate them.
      const lngLatPairs = generateNYCLngLats(0.003, gridCount);
      lngLats.set(lngLatPairs);

      // Set initial particles
      ctx.particleSystem.setParticles(grid.positions, grid.colors, grid.sizes);

      // Allocate working buffers
      workColors = new Float32Array(gridCount * 4);
      workSizes = new Float32Array(gridCount);
    },

    update(ctx: SceneContext, progress: number) {
      if (ctx.signal.aborted) return;
      if (!pulseFn || !basePositions || !baseColors || !baseSizes || !lngLats || !workColors || !workSizes) return;

      const now = performance.now() / 1000;
      const elapsed = now - pulseStartTime;

      // Apply temporal pulse modulation
      applyTemporalPulse(
        basePositions,
        baseColors,
        baseSizes,
        workColors,
        workSizes,
        gridCount,
        lngLats,
        pulseFn,
        elapsed,
      );

      // Push modulated data to particle system (positions are cached from setup)
      ctx.particleSystem.setParticles(basePositions, workColors, workSizes);

      // Update act progress — pulse is the remaining 70%
      useDemoStore.getState().setActProgress(0.3 + progress * 0.7);
    },

    teardown(ctx: SceneContext) {
      // Clean up for next act
      ctx.particleSystem.clearEmitters();
      ctx.particleSystem.clearFlowFields();
      pulseFn = null;
      basePositions = null;
      baseColors = null;
      baseSizes = null;
      lngLats = null;
      workColors = null;
      workSizes = null;
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: regenerate lng/lat pairs matching generateNYCHexGrid order
// ---------------------------------------------------------------------------

const NYC_BOUNDS = {
  minLng: -74.06,
  maxLng: -73.82,
  minLat: 40.63,
  maxLat: 40.84,
};

/**
 * Regenerate the lng/lat pairs in the same order as generateNYCHexGrid.
 * This is a lightweight pass that skips the Mercator projection.
 */
function generateNYCLngLats(resolution: number, _expectedCount: number): Float32Array {
  const dx = resolution;
  const dy = resolution * Math.sqrt(3) / 2;

  const pairs: number[] = [];
  let row = 0;
  for (let lat = NYC_BOUNDS.minLat; lat <= NYC_BOUNDS.maxLat; lat += dy) {
    const offset = (row % 2 === 0) ? 0 : dx / 2;
    for (let lng = NYC_BOUNDS.minLng + offset; lng <= NYC_BOUNDS.maxLng; lng += dx) {
      // Replicate the activity threshold from generateNYCHexGrid
      const a = activityAtFast(lng, lat);
      if (a < 0.02) continue;
      pairs.push(lng, lat);
    }
    row++;
  }

  return new Float32Array(pairs);
}

// Inline fast activity check — mirrors nycGrid.ts logic
const HOTSPOTS = [
  { lng: -73.985, lat: 40.758, weight: 1.0 },
  { lng: -74.006, lat: 40.713, weight: 0.7 },
  { lng: -73.955, lat: 40.768, weight: 0.5 },
  { lng: -73.944, lat: 40.728, weight: 0.45 },
  { lng: -73.988, lat: 40.692, weight: 0.35 },
  { lng: -73.913, lat: 40.774, weight: 0.3 },
  { lng: -73.949, lat: 40.805, weight: 0.4 },
];

function activityAtFast(lng: number, lat: number): number {
  let total = 0;
  const cosLat = Math.cos(lat * Math.PI / 180);
  for (const hs of HOTSPOTS) {
    const dlng = (lng - hs.lng) * cosLat;
    const dlat = lat - hs.lat;
    const dist2 = dlng * dlng + dlat * dlat;
    const sigma = 0.015;
    total += hs.weight * Math.exp(-dist2 / (2 * sigma * sigma));
  }
  const hash = Math.sin(lng * 12345.6789 + lat * 98765.4321) * 43758.5453;
  const jitter = (hash - Math.floor(hash)) * 0.15;
  return Math.max(0, Math.min(1, total + jitter));
}

// ---------------------------------------------------------------------------
// Act export
// ---------------------------------------------------------------------------

export function getAct2(): ActDefinition {
  return {
    id: 'act2-nyc',
    name: 'NYC Deep Dive — Temporal Pulse',
    scenes: [createDiveScene(), createPulseScene()],
  };
}
