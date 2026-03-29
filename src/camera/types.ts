// ---------------------------------------------------------------------------
// Camera Types — GeoDash cinematic camera system
// ---------------------------------------------------------------------------

/**
 * Function mapping normalised time t in [0,1] to an eased value.
 * May exceed [0,1] for overshoot effects.
 */
export type EasingFunction = (t: number) => number;

/** Output of the camera evaluation pipeline — directly maps to MapLibre options. */
export interface CameraOptions {
  center: [number, number]; // [lng, lat]
  zoom: number;
  pitch: number;
  bearing: number;
  /** Optional hint for animation drivers. */
  duration?: number;
  /** Optional easing reference (useful when handing off to MapLibre). */
  easing?: EasingFunction;
}

/** Snapshot of camera state at a single point in time. */
export interface CameraKeyframe {
  center: [number, number]; // [lng, lat]
  zoom: number;
  pitch: number;
  bearing: number;
}

/**
 * Enumeration of cinematic shot types.
 *
 * - `flyTo`       — simple A to B with easing
 * - `dolly`       — forward / backward along view direction
 * - `crane`       — vertical movement (pitch change)
 * - `tracking`    — lateral movement following a path
 * - `orbit`       — rotate around a center point
 * - `pullBack`    — zoom out while maintaining center
 * - `diveIn`      — dramatic zoom in with pitch increase
 * - `globeToCity` — globe view morphing to street level
 */
export type ShotType =
  | 'flyTo'
  | 'dolly'
  | 'crane'
  | 'tracking'
  | 'orbit'
  | 'pullBack'
  | 'diveIn'
  | 'globeToCity';

/** Full definition of a single camera shot. */
export interface CameraShot {
  type: ShotType;
  from: CameraKeyframe;
  to: CameraKeyframe;
  duration: number; // milliseconds
  easing: EasingFunction;
  /** Additional control points for bezier / multi-segment paths. */
  controlPoints?: CameraKeyframe[];
}

/** Multi-segment flight path built from ordered keyframes. */
export interface FlightPath {
  keyframes: CameraKeyframe[];
  /** Duration (ms) between each consecutive pair of keyframes. */
  durations: number[];
  /** Easing function applied to each segment's local t. */
  easings: EasingFunction[];
}
