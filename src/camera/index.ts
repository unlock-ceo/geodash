// ---------------------------------------------------------------------------
// Camera module public API
// ---------------------------------------------------------------------------

export { CinematicCamera, evaluateShot, evaluatePath } from './CinematicCamera';

export {
  // Core easings
  linear,
  easeInQuad,
  easeOutQuad,
  easeInOutQuad,
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  easeInQuart,
  easeOutQuart,
  easeInOutQuart,
  // Cinematic specials
  easeInOutBack,
  easeOutElastic,
  cinematicEaseInOut,
  dramaticPullback,
  diveEasing,
  // Utilities
  cubicBezier,
  compose,
  reverse,
  mirror,
} from './easing';

export type {
  CameraOptions,
  CameraKeyframe,
  CameraShot,
  EasingFunction,
  FlightPath,
  ShotType,
} from './types';
