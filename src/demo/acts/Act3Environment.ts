// ---------------------------------------------------------------------------
// Act 3 — UK Rivers + Ocean Currents (Environmental Flow)
// ---------------------------------------------------------------------------
// Camera cranes from NYC view outward to the North Atlantic, then sweeps
// along the Gulf Stream toward the UK. Ocean current and river particles
// flow as organic streams across the dark globe.
//
// Duration: ~25 seconds
//   Scene 1 ("pullback"): crane from NYC view to Atlantic overview (~8s)
//   Scene 2 ("flow"):     orbit over UK/Atlantic with flowing particles (~17s)
// ---------------------------------------------------------------------------

import type { ActDefinition, SceneContext, SceneDescriptor } from '../types';
import type { FlowField } from '../../engine/types';
import { CinematicCamera } from '../../camera/CinematicCamera';
import { easeInOutCubic } from '../../camera/easing';
import { generateOceanCurrentEmitters } from '../synthetic/oceanCurrents';
import { generateUKRiverEmitters } from '../synthetic/ukRivers';
import { useDemoStore } from '../../store/demoStore';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PULLBACK_DURATION = 8_000;
const FLOW_DURATION = 17_000;
const ATLANTIC_CENTER: [number, number] = [-20, 48]; // Mid-Atlantic
const UK_CENTER: [number, number] = [-2, 54]; // UK overview

// ---------------------------------------------------------------------------
// Ocean turbulence flow field
// ---------------------------------------------------------------------------

class OceanTurbulenceField implements FlowField {
  sample(x: number, y: number, _z: number, time: number): [number, number, number] {
    const s = 0.0000006;
    const fx = Math.sin(y * 30000 + time * 0.2) * s + Math.cos(x * 20000 + time * 0.15) * s * 0.5;
    const fy = Math.cos(x * 30000 - time * 0.18) * s * 0.7;
    return [fx, fy, 0];
  }
}

// ---------------------------------------------------------------------------
// Scene 1: Pullback from NYC to Atlantic
// ---------------------------------------------------------------------------

function createPullbackScene(): SceneDescriptor {
  const shot = CinematicCamera.crane(
    ATLANTIC_CENTER,
    3.0,   // start zoom (zoomed in from NYC)
    2.2,   // end zoom (zoomed out for Atlantic)
    40,    // start pitch
    15,    // end pitch
    -30,   // start bearing
    10,    // end bearing
    PULLBACK_DURATION,
  );

  return {
    id: 'act3-pullback',
    duration: PULLBACK_DURATION,
    camera: shot,

    setup(ctx: SceneContext) {
      if (ctx.signal.aborted) return;
      const { particleSystem } = ctx;

      // Clear NYC particles
      particleSystem.clearEmitters();
      particleSystem.clearFlowFields();

      // Set physics for ocean flow
      particleSystem.setPhysics({
        gravity: 0,
        friction: 0.003,
        turbulence: 0,
      });

      // Add ocean turbulence
      particleSystem.addFlowField(new OceanTurbulenceField());

      // Spawn ocean current emitters
      const oceanEmitters = generateOceanCurrentEmitters();
      for (const e of oceanEmitters) {
        if (ctx.signal.aborted) return;
        particleSystem.addEmitter(e);
      }
    },

    update(ctx: SceneContext, progress: number) {
      if (ctx.signal.aborted) return;
      useDemoStore.getState().setActProgress(progress * 0.3);
    },

    teardown() {
      // Leave particles flowing for next scene
    },
  };
}

// ---------------------------------------------------------------------------
// Scene 2: Flow view — orbiting UK + Atlantic
// ---------------------------------------------------------------------------

function createFlowScene(): SceneDescriptor {
  const shot = CinematicCamera.orbit(
    UK_CENTER,
    0,
    10,    // start bearing
    -40,   // end bearing (slow sweep)
    4.5,   // zoom — showing UK + surrounding ocean
    35,    // pitch
    FLOW_DURATION,
  );
  shot.easing = easeInOutCubic;

  let riversSpawned = false;

  return {
    id: 'act3-flow',
    duration: FLOW_DURATION,
    camera: shot,

    setup(ctx: SceneContext) {
      if (ctx.signal.aborted) return;
      riversSpawned = false;
    },

    update(ctx: SceneContext, progress: number) {
      if (ctx.signal.aborted) return;

      // Spawn UK river emitters at 20% through this scene
      if (progress > 0.2 && !riversSpawned) {
        riversSpawned = true;
        const riverEmitters = generateUKRiverEmitters();
        for (const e of riverEmitters) {
          if (ctx.signal.aborted) return;
          ctx.particleSystem.addEmitter(e);
        }
      }

      useDemoStore.getState().setActProgress(0.3 + progress * 0.7);
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

export function getAct3(): ActDefinition {
  return {
    id: 'act3-environment',
    name: 'Environmental Flow — Ocean Currents & UK Rivers',
    scenes: [createPullbackScene(), createFlowScene()],
  };
}
