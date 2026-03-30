// ---------------------------------------------------------------------------
// Act 5 — Interactive Drop-Your-Data
// ---------------------------------------------------------------------------
// The final act: demo layers fade out, camera settles to a neutral position,
// and a "Drop your data" invitation appears. This bridges from passive
// viewing to active exploration.
//
// Duration: ~15 seconds (then stays in interactive mode)
//   Scene 1 ("invitation"): fade particles, show invitation text
// ---------------------------------------------------------------------------

import type { ActDefinition, SceneContext, SceneDescriptor } from '../types';
import { CinematicCamera } from '../../camera/CinematicCamera';
import { easeInOutCubic } from '../../camera/easing';
import { useDemoStore } from '../../store/demoStore';
import { useDataStore } from '../../store/dataStore';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DURATION = 15_000;
const NEUTRAL_CENTER: [number, number] = [0, 20]; // Neutral globe view

// ---------------------------------------------------------------------------
// Scene: Invitation
// ---------------------------------------------------------------------------

function createInvitationScene(): SceneDescriptor {
  const shot = CinematicCamera.orbit(
    NEUTRAL_CENTER,
    0,
    0,     // start bearing
    20,    // end bearing (gentle drift)
    1.5,   // zoom — full globe
    5,     // pitch — minimal
    DURATION,
  );
  shot.easing = easeInOutCubic;

  return {
    id: 'act5-invitation',
    duration: DURATION,
    camera: shot,

    setup(ctx: SceneContext) {
      if (ctx.signal.aborted) return;

      // Clear all demo particles
      ctx.particleSystem.clearEmitters();
      ctx.particleSystem.clearFlowFields();
      ctx.particleSystem.setPhysics({ gravity: 0, friction: 0.02, turbulence: 0 });

      // Only clear the particle buffer if the user hasn't dropped their own data.
      // User data takes precedence over demo cleanup.
      const hasUserData = useDataStore.getState().datasets.size > 0;
      if (!hasUserData) {
        const empty = new Float32Array(0);
        ctx.particleSystem.setParticles(empty, empty, empty);
      }
    },

    update(ctx: SceneContext, progress: number) {
      if (ctx.signal.aborted) return;
      useDemoStore.getState().setActProgress(progress);
    },

    teardown() {
      // Demo is complete — leave globe in interactive state
    },
  };
}

// ---------------------------------------------------------------------------
// Act export
// ---------------------------------------------------------------------------

export function getAct5(): ActDefinition {
  return {
    id: 'act5-interactive',
    name: 'Your Turn — Drop Your Data',
    scenes: [createInvitationScene()],
  };
}
