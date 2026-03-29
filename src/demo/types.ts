// ---------------------------------------------------------------------------
// Demo Scene Descriptor Types
// ---------------------------------------------------------------------------
// Declarative scene descriptors decouple act definitions from system
// internals.  The SceneRunner interprets these; the DemoOrchestrator
// sequences them.
// ---------------------------------------------------------------------------

import type { CameraShot } from '../camera/types';
import type { ParticleSystem } from '../engine/ParticleSystem';

/**
 * Context passed to every scene callback.
 *
 * - `map` : the MapLibre GL map instance (typed loosely to avoid hard
 *   dependency on maplibre-gl types in this module)
 * - `particleSystem` : the particle engine that owns emitters, flow fields,
 *   and bulk particle data
 * - `signal` : AbortSignal tied to the running scene's AbortController,
 *   allowing cooperative cancellation
 */
export interface SceneContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: any; // maplibregl.Map — kept as `any` to avoid coupling
  particleSystem: ParticleSystem;
  signal: AbortSignal;
}

/**
 * A single scene within an act.
 *
 * Scenes are the atomic unit of the demo timeline.  Each scene:
 *   1. runs `setup` once when it starts
 *   2. calls `update` every frame with a normalised progress [0, 1]
 *   3. runs `teardown` when it finishes or is aborted
 */
export interface SceneDescriptor {
  /** Unique identifier for debugging / logging. */
  id: string;

  /** Total duration in milliseconds. */
  duration: number;

  /** Optional camera shot evaluated automatically by the SceneRunner. */
  camera?: CameraShot;

  /** Called once when the scene begins. May be async (e.g. data loading). */
  setup: (ctx: SceneContext) => void | Promise<void>;

  /** Called when the scene ends (naturally or via abort). */
  teardown?: (ctx: SceneContext) => void;

  /** Called every animation frame with progress in [0, 1]. */
  update?: (ctx: SceneContext, progress: number) => void;
}

/**
 * An act is an ordered collection of scenes that play sequentially.
 */
export interface ActDefinition {
  id: string;
  name: string;
  scenes: SceneDescriptor[];
}
