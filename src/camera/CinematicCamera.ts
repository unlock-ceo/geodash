// ---------------------------------------------------------------------------
// CinematicCamera — pure-function cinematic camera evaluation engine
// ---------------------------------------------------------------------------
// Core interface:  CinematicCamera.evaluate(shot, t) => CameraOptions
//
// All methods are static, all functions are pure.  No mutable state,
// no side effects, maximally testable.
// ---------------------------------------------------------------------------

import type {
  CameraKeyframe,
  CameraOptions,
  CameraShot,
  FlightPath,
} from './types';

import {
  cinematicEaseInOut,
  diveEasing,
  dramaticPullback,
  easeInOutCubic,
  easeOutCubic,
} from './easing';

// ---------------------------------------------------------------------------
// Default durations (milliseconds)
// ---------------------------------------------------------------------------
const DEFAULT_DURATION_FLY = 3000;
const DEFAULT_DURATION_DOLLY = 2000;
const DEFAULT_DURATION_CRANE = 2500;
const DEFAULT_DURATION_TRACKING = 4000;
const DEFAULT_DURATION_ORBIT = 6000;
const DEFAULT_DURATION_PULL_BACK = 3000;
const DEFAULT_DURATION_DIVE = 3500;
const DEFAULT_DURATION_GLOBE_TO_CITY = 8000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a number to [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation between two numbers.
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ---------------------------------------------------------------------------
// CinematicCamera class
// ---------------------------------------------------------------------------

export class CinematicCamera {
  // ------------------------------------------------------------------
  // Core evaluation
  // ------------------------------------------------------------------

  /**
   * Pure evaluation of a camera shot at normalised time `t` in [0, 1].
   *
   * 1. Apply the shot's easing to `t`.
   * 2. If the shot has `controlPoints`, use bezier interpolation across the
   *    full keyframe sequence (from, ...controlPoints, to).
   * 3. Otherwise linearly interpolate between `from` and `to`.
   */
  static evaluate(shot: CameraShot, t: number): CameraOptions {
    const clamped = clamp(t, 0, 1);
    const eased = shot.easing(clamped);

    if (shot.controlPoints && shot.controlPoints.length > 0) {
      const keyframes: CameraKeyframe[] = [
        shot.from,
        ...shot.controlPoints,
        shot.to,
      ];
      return CinematicCamera.bezierInterpolate(keyframes, eased);
    }

    return CinematicCamera.lerpKeyframe(shot.from, shot.to, eased);
  }

  // ------------------------------------------------------------------
  // Flight path (multi-segment) evaluation
  // ------------------------------------------------------------------

  /**
   * Evaluate a multi-segment flight path at global normalised time `t`.
   *
   * The total duration is the sum of `path.durations`.  We find which segment
   * `t` falls into, compute the local t within that segment, apply the
   * segment's easing, and interpolate between the two bounding keyframes.
   */
  static evaluatePath(path: FlightPath, t: number): CameraOptions {
    const { keyframes, durations, easings } = path;

    if (keyframes.length === 0) {
      return { center: [0, 0], zoom: 1, pitch: 0, bearing: 0 };
    }
    if (keyframes.length === 1) {
      const kf = keyframes[0]!;
      return { center: [...kf.center], zoom: kf.zoom, pitch: kf.pitch, bearing: kf.bearing };
    }

    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    if (totalDuration === 0) {
      const kf = keyframes[0]!;
      return { center: [...kf.center], zoom: kf.zoom, pitch: kf.pitch, bearing: kf.bearing };
    }

    const globalT = clamp(t, 0, 1);
    const elapsed = globalT * totalDuration;

    // Find the segment
    let accumulated = 0;
    for (let i = 0; i < durations.length; i++) {
      const segDuration = durations[i]!;
      if (elapsed <= accumulated + segDuration) {
        const localT = segDuration > 0 ? (elapsed - accumulated) / segDuration : 0;
        const easingFn = easings[i] ?? easeInOutCubic;
        const easedT = easingFn(localT);
        const from = keyframes[i]!;
        const to = keyframes[i + 1]!;
        return CinematicCamera.lerpKeyframe(from, to, easedT);
      }
      accumulated += segDuration;
    }

    // t === 1 — return last keyframe
    const last = keyframes[keyframes.length - 1]!;
    return {
      center: [...last.center],
      zoom: last.zoom,
      pitch: last.pitch,
      bearing: last.bearing,
    };
  }

  // ------------------------------------------------------------------
  // Shot presets (factory functions)
  // ------------------------------------------------------------------

  /** Simple A to B fly-to with cinematic easing. */
  static flyTo(
    from: CameraKeyframe,
    to: CameraKeyframe,
    duration: number = DEFAULT_DURATION_FLY,
  ): CameraShot {
    return {
      type: 'flyTo',
      from,
      to,
      duration,
      easing: cinematicEaseInOut,
    };
  }

  /**
   * Dolly — forward / backward movement along the view direction.
   * Implemented as a zoom change: positive `distance` zooms in, negative zooms out.
   */
  static dolly(
    from: CameraKeyframe,
    distance: number,
    duration: number = DEFAULT_DURATION_DOLLY,
  ): CameraShot {
    const to: CameraKeyframe = {
      center: [...from.center],
      zoom: from.zoom + distance,
      pitch: from.pitch,
      bearing: from.bearing,
    };
    return {
      type: 'dolly',
      from,
      to,
      duration,
      easing: easeInOutCubic,
    };
  }

  /**
   * Crane — vertical camera movement realised as a pitch change.
   * Positive `heightDelta` tilts toward overhead; negative tilts toward horizon.
   */
  static crane(
    from: CameraKeyframe,
    heightDelta: number,
    duration: number = DEFAULT_DURATION_CRANE,
  ): CameraShot {
    const to: CameraKeyframe = {
      center: [...from.center],
      zoom: from.zoom,
      pitch: clamp(from.pitch + heightDelta, 0, 85),
      bearing: from.bearing,
    };
    return {
      type: 'crane',
      from,
      to,
      duration,
      easing: easeOutCubic,
    };
  }

  /**
   * Tracking — lateral movement following a multi-keyframe path.
   * Uses bezier interpolation through all provided keyframes.
   */
  static tracking(
    path: CameraKeyframe[],
    duration: number = DEFAULT_DURATION_TRACKING,
  ): CameraShot {
    if (path.length < 2) {
      const kf = path[0] ?? { center: [0, 0] as [number, number], zoom: 10, pitch: 0, bearing: 0 };
      return {
        type: 'tracking',
        from: kf,
        to: kf,
        duration,
        easing: easeInOutCubic,
      };
    }

    const from = path[0]!;
    const to = path[path.length - 1]!;
    const controlPoints = path.slice(1, -1);

    return {
      type: 'tracking',
      from,
      to,
      duration,
      easing: easeInOutCubic,
      controlPoints: controlPoints.length > 0 ? controlPoints : undefined,
    };
  }

  /**
   * Orbit — rotate around a center point between two bearings.
   * Bearing interpolation automatically takes the shortest path around 360 deg.
   */
  static orbit(
    center: [number, number],
    _radius: number, // reserved for future 3D offset; currently encoded via zoom
    startBearing: number,
    endBearing: number,
    zoom: number,
    pitch: number = 45,
    duration: number = DEFAULT_DURATION_ORBIT,
  ): CameraShot {
    const from: CameraKeyframe = {
      center: [...center],
      zoom,
      pitch,
      bearing: startBearing,
    };
    const to: CameraKeyframe = {
      center: [...center],
      zoom,
      pitch,
      bearing: endBearing,
    };
    return {
      type: 'orbit',
      from,
      to,
      duration,
      easing: easeInOutCubic,
    };
  }

  /**
   * Pull back — zoom out while maintaining center.
   * `zoomDelta` is subtracted from the current zoom (positive value = zoom out).
   */
  static pullBack(
    from: CameraKeyframe,
    zoomDelta: number,
    duration: number = DEFAULT_DURATION_PULL_BACK,
  ): CameraShot {
    const to: CameraKeyframe = {
      center: [...from.center],
      zoom: from.zoom - zoomDelta,
      pitch: Math.max(from.pitch - 10, 0), // slight pitch reduction for drama
      bearing: from.bearing,
    };
    return {
      type: 'pullBack',
      from,
      to,
      duration,
      easing: dramaticPullback,
    };
  }

  /**
   * Dive in — dramatic zoom in with increasing pitch for immersion.
   */
  static diveIn(
    from: CameraKeyframe,
    to: CameraKeyframe,
    duration: number = DEFAULT_DURATION_DIVE,
  ): CameraShot {
    return {
      type: 'diveIn',
      from,
      to,
      duration,
      easing: diveEasing,
    };
  }

  /**
   * Globe to city — special multi-phase shot that morphs from a full globe
   * view down to street-level at the given city center.
   *
   * The flight arc:
   *   1. Start at globe overview (zoom 1.8, pitch 0)
   *   2. Swing toward the city while zooming to mid-range (zoom ~6)
   *   3. Dive into the city at high pitch (zoom 14, pitch 60)
   *
   * Uses control points for the dramatic bezier arc.
   */
  static globeToCity(
    cityCenter: [number, number],
    duration: number = DEFAULT_DURATION_GLOBE_TO_CITY,
  ): CameraShot {
    // Compute a bearing from the globe's default center [0, 20] toward the city
    const targetBearing = CinematicCamera.initialBearing(
      [0, 20],
      cityCenter,
    );

    const from: CameraKeyframe = {
      center: [0, 20],
      zoom: 1.8,
      pitch: 0,
      bearing: 0,
    };

    const to: CameraKeyframe = {
      center: [...cityCenter],
      zoom: 14,
      pitch: 60,
      bearing: targetBearing,
    };

    // Mid-point control: halfway between, mid-zoom, moderate pitch
    const midLng = lerp(0, cityCenter[0], 0.5);
    const midLat = lerp(20, cityCenter[1], 0.5);
    const midBearing = CinematicCamera.lerpBearing(0, targetBearing, 0.4);

    const controlPoints: CameraKeyframe[] = [
      {
        // Phase 1: slight zoom out for grandeur before swinging
        center: [lerp(0, midLng, 0.3), lerp(20, midLat, 0.3)],
        zoom: 1.5,
        pitch: 10,
        bearing: CinematicCamera.lerpBearing(0, targetBearing, 0.15),
      },
      {
        // Phase 2: swing toward the city at mid-range altitude
        center: [midLng, midLat],
        zoom: 6,
        pitch: 35,
        bearing: midBearing,
      },
      {
        // Phase 3: approaching the city, tilting down
        center: [lerp(midLng, cityCenter[0], 0.7), lerp(midLat, cityCenter[1], 0.7)],
        zoom: 10,
        pitch: 50,
        bearing: CinematicCamera.lerpBearing(midBearing, targetBearing, 0.7),
      },
    ];

    return {
      type: 'globeToCity',
      from,
      to,
      duration,
      easing: diveEasing,
      controlPoints,
    };
  }

  // ------------------------------------------------------------------
  // Interpolation internals
  // ------------------------------------------------------------------

  /**
   * De Casteljau bezier interpolation across N keyframes.
   *
   * Each camera property (center lng, center lat, zoom, pitch, bearing) is
   * interpolated independently.  Bearing uses shortest-arc interpolation
   * at every level of the recursion.
   */
  private static bezierInterpolate(
    keyframes: CameraKeyframe[],
    t: number,
  ): CameraOptions {
    if (keyframes.length === 1) {
      const kf = keyframes[0]!;
      return {
        center: [...kf.center],
        zoom: kf.zoom,
        pitch: kf.pitch,
        bearing: kf.bearing,
      };
    }

    // De Casteljau: reduce N points to N-1 by pairwise lerp, recurse
    const reduced: CameraKeyframe[] = [];
    for (let i = 0; i < keyframes.length - 1; i++) {
      const a = keyframes[i]!;
      const b = keyframes[i + 1]!;
      reduced.push({
        center: [lerp(a.center[0], b.center[0], t), lerp(a.center[1], b.center[1], t)],
        zoom: lerp(a.zoom, b.zoom, t),
        pitch: lerp(a.pitch, b.pitch, t),
        bearing: CinematicCamera.lerpBearing(a.bearing, b.bearing, t),
      });
    }

    return CinematicCamera.bezierInterpolate(reduced, t);
  }

  /**
   * Linear interpolation between two keyframes.  Bearing uses shortest-arc.
   */
  private static lerpKeyframe(
    a: CameraKeyframe,
    b: CameraKeyframe,
    t: number,
  ): CameraOptions {
    return {
      center: [
        lerp(a.center[0], b.center[0], t),
        lerp(a.center[1], b.center[1], t),
      ],
      zoom: lerp(a.zoom, b.zoom, t),
      pitch: lerp(a.pitch, b.pitch, t),
      bearing: CinematicCamera.lerpBearing(a.bearing, b.bearing, t),
    };
  }

  /**
   * Shortest-arc bearing interpolation that correctly handles the 360 deg
   * wraparound.  Both input bearings are normalised to [0, 360) and the
   * shortest angular path is taken.
   */
  private static lerpBearing(a: number, b: number, t: number): number {
    // Normalise to [0, 360)
    const na = ((a % 360) + 360) % 360;
    const nb = ((b % 360) + 360) % 360;

    let diff = nb - na;
    // Take the shortest arc
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    const result = na + diff * t;
    return ((result % 360) + 360) % 360;
  }

  // ------------------------------------------------------------------
  // Geodesic helpers (internal)
  // ------------------------------------------------------------------

  /**
   * Compute the initial bearing (forward azimuth) from point A to point B on
   * the sphere.  Returns degrees in [0, 360).
   */
  private static initialBearing(
    a: [number, number],
    b: [number, number],
  ): number {
    const toRad = Math.PI / 180;
    const toDeg = 180 / Math.PI;

    const lat1 = a[1] * toRad;
    const lat2 = b[1] * toRad;
    const dLng = (b[0] - a[0]) * toRad;

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

    const bearing = Math.atan2(y, x) * toDeg;
    return ((bearing % 360) + 360) % 360;
  }
}

// Re-export convenience function matching the spec's pure-function interface:
//   (shot, t) => CameraOptions
export const evaluateShot = CinematicCamera.evaluate;
export const evaluatePath = CinematicCamera.evaluatePath;
