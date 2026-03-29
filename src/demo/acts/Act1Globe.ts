// ---------------------------------------------------------------------------
// Act 1 — Globe Overview with Shipping & Flight Particles
// ---------------------------------------------------------------------------
// A grand opening: the camera orbits a dark globe at low zoom while hundreds
// of particles stream along great-circle trade routes.  Cool blue / teal
// tones dominate, with a gentle turbulence flow field giving the particles
// an organic, alive feeling.
//
// Duration: ~20 seconds
//   Scene 1 ("spawn"): set up route emitters + flow field, orbit camera
// ---------------------------------------------------------------------------

import type { ActDefinition, SceneContext, SceneDescriptor } from '../types';
import type { FlowField } from '../../engine/types';
import { CinematicCamera } from '../../camera/CinematicCamera';
import { easeInOutCubic } from '../../camera/easing';
import { generateShippingEmitters } from '../synthetic/shippingRoutes';
import { useDemoStore } from '../../store/demoStore';

// ---------------------------------------------------------------------------
// Flow field — gentle global turbulence
// ---------------------------------------------------------------------------

/**
 * A flow field that adds a subtle swirling turbulence to particles, making
 * them feel like they're riding atmospheric currents.
 */
class GlobalTurbulenceField implements FlowField {
  private strength: number;

  constructor(strength: number = 0.000008) {
    this.strength = strength;
  }

  sample(x: number, y: number, _z: number, time: number): [number, number, number] {
    // Low-frequency sine-based flow with time variation
    const s = this.strength;
    const freq = 8000; // spatial frequency in Mercator units
    const tFreq = 0.3; // temporal frequency

    const fx = Math.sin(y * freq + time * tFreq) * s +
               Math.cos((x + y) * freq * 0.7 + time * tFreq * 1.3) * s * 0.5;
    const fy = Math.cos(x * freq - time * tFreq * 0.8) * s +
               Math.sin((x - y) * freq * 0.6 + time * tFreq * 0.9) * s * 0.5;

    return [fx, fy, 0];
  }
}

// ---------------------------------------------------------------------------
// Scene definition
// ---------------------------------------------------------------------------

function createSpawnScene(): SceneDescriptor {
  const DURATION = 20_000; // 20 seconds

  // Camera: slow orbit from bearing 0 -> 60, globe overview
  const orbitShot = CinematicCamera.orbit(
    [15, 15],   // center offset slightly for visual interest
    0,          // radius (unused — encoded in zoom)
    0,          // start bearing
    60,         // end bearing
    1.8,        // zoom — full globe
    10,         // pitch — subtle tilt
    DURATION,
  );
  // Override easing to be very smooth for the slow orbit
  orbitShot.easing = easeInOutCubic;

  return {
    id: 'act1-spawn',
    duration: DURATION,
    camera: orbitShot,

    setup(ctx: SceneContext) {
      const { particleSystem, signal } = ctx;
      if (signal.aborted) return;

      // Clear any prior state
      particleSystem.clearEmitters();
      particleSystem.clearFlowFields();

      // Configure physics for gentle movement
      particleSystem.setPhysics({
        gravity: 0,
        friction: 0.01,
        turbulence: 0,
      });

      // Add the global turbulence flow field
      particleSystem.addFlowField(new GlobalTurbulenceField(0.000008));

      // Generate and register emitters along all shipping routes
      const emitters = generateShippingEmitters();
      for (const emitter of emitters) {
        if (signal.aborted) return;
        particleSystem.addEmitter(emitter);
      }
    },

    update(ctx: SceneContext, progress: number) {
      if (ctx.signal.aborted) return;
      useDemoStore.getState().setActProgress(progress);
    },

    teardown(ctx: SceneContext) {
      // Do NOT clear emitters here — Act 2's dive scene will do that
      // so particles can fade organically during the transition.
      void ctx;
    },
  };
}

// ---------------------------------------------------------------------------
// Act export
// ---------------------------------------------------------------------------

export function getAct1(): ActDefinition {
  return {
    id: 'act1-globe',
    name: 'Globe Overview — Global Trade Routes',
    scenes: [createSpawnScene()],
  };
}
