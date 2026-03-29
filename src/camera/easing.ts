// ---------------------------------------------------------------------------
// Easing Library — cinematic-quality curves for GeoDash camera system
// ---------------------------------------------------------------------------
// Every function maps t in [0,1] to an eased value (may exceed [0,1] for
// overshoot effects).  All functions are pure.
// ---------------------------------------------------------------------------

import type { EasingFunction } from './types';

// ---- Core polynomial easings ------------------------------------------------

export const linear: EasingFunction = (t) => t;

export const easeInQuad: EasingFunction = (t) => t * t;
export const easeOutQuad: EasingFunction = (t) => t * (2 - t);
export const easeInOutQuad: EasingFunction = (t) =>
  t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

export const easeInCubic: EasingFunction = (t) => t * t * t;
export const easeOutCubic: EasingFunction = (t) => {
  const t1 = t - 1;
  return t1 * t1 * t1 + 1;
};
export const easeInOutCubic: EasingFunction = (t) =>
  t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

export const easeInQuart: EasingFunction = (t) => t * t * t * t;
export const easeOutQuart: EasingFunction = (t) => {
  const t1 = t - 1;
  return 1 - t1 * t1 * t1 * t1;
};
export const easeInOutQuart: EasingFunction = (t) => {
  const t1 = t - 1;
  return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * t1 * t1 * t1 * t1;
};

// ---- Cinematic specials -----------------------------------------------------

/**
 * Back easing — slight overshoot that gives a feeling of physical "weight".
 * Overshoot constant s = 1.70158 (standard) amplified for in-out variant.
 */
export const easeInOutBack: EasingFunction = (t) => {
  const s = 1.70158 * 1.525;
  const t2 = t * 2;
  if (t2 < 1) {
    return 0.5 * (t2 * t2 * ((s + 1) * t2 - s));
  }
  const post = t2 - 2;
  return 0.5 * (post * post * ((s + 1) * post + s) + 2);
};

/**
 * Elastic out — spring settle effect, ideal for UI element arrivals.
 */
export const easeOutElastic: EasingFunction = (t) => {
  if (t === 0 || t === 1) return t;
  const p = 0.3;
  const s = p / 4;
  return Math.pow(2, -10 * t) * Math.sin(((t - s) * (2 * Math.PI)) / p) + 1;
};

/**
 * Cinematic ease-in-out — slow start, fast middle, slow end with a subtle
 * micro-overshoot at the tail (approx 1.2 % overshoot, then settles).
 *
 * Built by blending a cubic-bezier core with a damped sine nudge at t > 0.85.
 */
export const cinematicEaseInOut: EasingFunction = (t) => {
  // Core: custom cubic bezier approximation (0.45, 0.05, 0.15, 1.0)
  const core = cubicBezier(0.45, 0.05, 0.15, 1.0);
  const base = core(t);

  // Micro-overshoot nudge near the end
  if (t > 0.85) {
    const local = (t - 0.85) / 0.15; // 0..1 within tail
    const nudge = Math.sin(local * Math.PI) * 0.012;
    return base + nudge;
  }
  return base;
};

/**
 * Dramatic pullback — slight forward motion (0-15 %), then strong pullback
 * easing through the remaining 85 %.  Great for "reveal" moments.
 */
export const dramaticPullback: EasingFunction = (t) => {
  if (t < 0.15) {
    // Slight forward push (negative progress — moves opposite direction)
    const local = t / 0.15;
    return -0.06 * Math.sin(local * Math.PI);
  }
  // Smooth ease-out for the main pullback
  const local = (t - 0.15) / 0.85;
  const eased = 1 - Math.pow(1 - local, 3);
  return eased;
};

/**
 * Dive easing — accelerating dive with a soft landing.
 * Quadratic-in for the first 70 %, then cubic-out deceleration.
 */
export const diveEasing: EasingFunction = (t) => {
  if (t < 0.7) {
    // Accelerating phase (quadratic in, scaled to cover ~40 % of output)
    const local = t / 0.7;
    return 0.4 * local * local;
  }
  // Decelerating soft-landing phase (cubic out)
  const local = (t - 0.7) / 0.3;
  const eased = 1 - Math.pow(1 - local, 3);
  return 0.4 + 0.6 * eased;
};

// ---- Cubic Bezier -----------------------------------------------------------

/**
 * Build an easing function from cubic-bezier control points, matching the CSS
 * `cubic-bezier(p1x, p1y, p2x, p2y)` specification.
 *
 * Uses Newton-Raphson iteration to invert the X polynomial, then evaluates the
 * Y polynomial at the solved parameter.
 */
export function cubicBezier(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
): EasingFunction {
  // Pre-compute polynomial coefficients for the X and Y curves.
  //   B(u) = 3(1-u)^2 u P1 + 3(1-u) u^2 P2 + u^3
  //        = (3 P1) u  +  (3 P2 - 6 P1) u^2  +  (3 P1 - 3 P2 + 1) u^3
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;

  function sampleCurveX(u: number): number {
    return ((ax * u + bx) * u + cx) * u;
  }
  function sampleCurveY(u: number): number {
    return ((ay * u + by) * u + cy) * u;
  }
  function sampleCurveDerivativeX(u: number): number {
    return (3 * ax * u + 2 * bx) * u + cx;
  }

  /** Solve for the bezier parameter u given input x, using Newton-Raphson. */
  function solveCurveX(x: number): number {
    // Initial guess using linear interpolation
    let u = x;

    // Newton-Raphson iterations (8 is more than enough for < 1e-7 precision)
    for (let i = 0; i < 8; i++) {
      const currentX = sampleCurveX(u) - x;
      const derivative = sampleCurveDerivativeX(u);
      if (Math.abs(currentX) < 1e-7) return u;
      if (Math.abs(derivative) < 1e-7) break;
      u -= currentX / derivative;
    }

    // Fall back to bisection if Newton-Raphson didn't converge
    let lo = 0;
    let hi = 1;
    u = x;
    for (let i = 0; i < 20; i++) {
      const currentX = sampleCurveX(u);
      if (Math.abs(currentX - x) < 1e-7) return u;
      if (x > currentX) {
        lo = u;
      } else {
        hi = u;
      }
      u = (lo + hi) / 2;
    }
    return u;
  }

  return (t: number): number => {
    // Boundary clamp
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return sampleCurveY(solveCurveX(t));
  };
}

// ---- Combinators ------------------------------------------------------------

/**
 * Chain multiple easings across equal-duration segments of [0,1].
 *
 * `compose(easeInQuad, easeOutCubic)` applies easeInQuad on [0, 0.5) and
 * easeOutCubic on [0.5, 1], each mapping their local t from 0 to 1.  The
 * output is stitched so that the combined curve goes from 0 to 1.
 */
export function compose(...easings: EasingFunction[]): EasingFunction {
  const n = easings.length;
  if (n === 0) return linear;
  if (n === 1) return easings[0]!;

  return (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;

    const segmentLength = 1 / n;
    const segIndex = Math.min(Math.floor(t / segmentLength), n - 1);
    const localT = (t - segIndex * segmentLength) / segmentLength;
    const easingFn = easings[segIndex]!;

    // Scale: each segment contributes 1/n of total progress
    const segStart = segIndex / n;
    const segSize = 1 / n;
    return segStart + segSize * easingFn(localT);
  };
}

/**
 * Reverse an easing: the curve is played backwards.
 * `reverse(easeInQuad)` behaves like easeOutQuad.
 */
export function reverse(easing: EasingFunction): EasingFunction {
  return (t: number): number => 1 - easing(1 - t);
}

/**
 * Mirror an easing: ease-in for the first half, then ease-out (reversed) for
 * the second half, producing a symmetrical in-out curve.
 */
export function mirror(easing: EasingFunction): EasingFunction {
  return (t: number): number => {
    if (t < 0.5) {
      return easing(t * 2) / 2;
    }
    return 1 - easing((1 - t) * 2) / 2;
  };
}
