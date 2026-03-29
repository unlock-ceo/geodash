import { describe, it, expect } from 'vitest';
import {
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
  easeInOutBack,
  easeOutElastic,
  cinematicEaseInOut,
  dramaticPullback,
  diveEasing,
  cubicBezier,
  compose,
  reverse,
  mirror,
} from '../easing';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Assert f(0)===0 and f(1)===1 within tolerance. */
function assertBoundaries(fn: (t: number) => number, name: string) {
  expect(fn(0), `${name}(0) should be 0`).toBeCloseTo(0, 5);
  expect(fn(1), `${name}(1) should be 1`).toBeCloseTo(1, 5);
}

/** Assert monotonically non-decreasing over [0,1] at N sample points. */
function assertMonotonic(fn: (t: number) => number, name: string, samples = 50) {
  let prev = fn(0);
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const val = fn(t);
    expect(val, `${name} should be monotonic at t=${t}`).toBeGreaterThanOrEqual(prev - 1e-9);
    prev = val;
  }
}

// ---------------------------------------------------------------------------
// Boundary conditions: f(0)===0, f(1)===1
// ---------------------------------------------------------------------------

describe('Easing boundary conditions', () => {
  const standardEasings: [string, (t: number) => number][] = [
    ['linear', linear],
    ['easeInQuad', easeInQuad],
    ['easeOutQuad', easeOutQuad],
    ['easeInOutQuad', easeInOutQuad],
    ['easeInCubic', easeInCubic],
    ['easeOutCubic', easeOutCubic],
    ['easeInOutCubic', easeInOutCubic],
    ['easeInQuart', easeInQuart],
    ['easeOutQuart', easeOutQuart],
    ['easeInOutQuart', easeInOutQuart],
    ['easeInOutBack', easeInOutBack],
    ['easeOutElastic', easeOutElastic],
  ];

  for (const [name, fn] of standardEasings) {
    it(`${name}: f(0)===0 and f(1)===1`, () => {
      assertBoundaries(fn, name);
    });
  }
});

// ---------------------------------------------------------------------------
// Monotonicity for polynomial easings
// ---------------------------------------------------------------------------

describe('Polynomial easing monotonicity', () => {
  const monotonic: [string, (t: number) => number][] = [
    ['easeInQuad', easeInQuad],
    ['easeOutQuad', easeOutQuad],
    ['easeInOutQuad', easeInOutQuad],
    ['easeInCubic', easeInCubic],
    ['easeOutCubic', easeOutCubic],
    ['easeInOutCubic', easeInOutCubic],
    ['easeInQuart', easeInQuart],
    ['easeOutQuart', easeOutQuart],
    ['easeInOutQuart', easeInOutQuart],
  ];

  for (const [name, fn] of monotonic) {
    it(`${name} is monotonically non-decreasing`, () => {
      assertMonotonic(fn, name);
    });
  }
});

// ---------------------------------------------------------------------------
// Cinematic specials
// ---------------------------------------------------------------------------

describe('cinematicEaseInOut', () => {
  it('f(0)≈0 and f(1)≈1', () => {
    assertBoundaries(cinematicEaseInOut, 'cinematicEaseInOut');
  });

  it('micro-overshoot — value slightly > 1 near t=0.95', () => {
    // Sample in the [0.86, 0.99] range to find a value exceeding 1
    let maxVal = 0;
    for (let t = 0.86; t < 1.0; t += 0.01) {
      maxVal = Math.max(maxVal, cinematicEaseInOut(t));
    }
    expect(maxVal).toBeGreaterThan(1.0);
    // But the overshoot is small — less than 2%
    expect(maxVal).toBeLessThan(1.02);
  });
});

describe('dramaticPullback', () => {
  it('f(0)≈0 and f(1)≈1', () => {
    assertBoundaries(dramaticPullback, 'dramaticPullback');
  });

  it('goes negative in the [0, 0.15) range', () => {
    let minVal = 0;
    for (let t = 0.01; t < 0.15; t += 0.01) {
      minVal = Math.min(minVal, dramaticPullback(t));
    }
    expect(minVal).toBeLessThan(0);
  });

  it('reaches approximately 1 at t=1', () => {
    expect(dramaticPullback(1)).toBeCloseTo(1, 2);
  });
});

describe('diveEasing', () => {
  it('f(0)≈0 and f(1)≈1', () => {
    assertBoundaries(diveEasing, 'diveEasing');
  });

  it('two-phase: output at t=0.7 is ~0.4', () => {
    expect(diveEasing(0.7)).toBeCloseTo(0.4, 1);
  });

  it('two-phase: output at t=1 is ~1.0', () => {
    expect(diveEasing(1)).toBeCloseTo(1.0, 2);
  });
});

// ---------------------------------------------------------------------------
// Cubic Bezier
// ---------------------------------------------------------------------------

describe('cubicBezier', () => {
  it('identity bezier (0,0,1,1) matches linear', () => {
    const identity = cubicBezier(0, 0, 1, 1);
    for (let t = 0; t <= 1; t += 0.1) {
      expect(identity(t)).toBeCloseTo(t, 2);
    }
  });

  it('CSS ease curve (0.25, 0.1, 0.25, 1.0) produces expected midpoint', () => {
    const ease = cubicBezier(0.25, 0.1, 0.25, 1.0);
    // At t=0.5, CSS ease produces approximately 0.80
    const mid = ease(0.5);
    expect(mid).toBeGreaterThan(0.6);
    expect(mid).toBeLessThan(0.95);
  });

  it('boundary conditions: f(0)=0, f(1)=1', () => {
    const ease = cubicBezier(0.25, 0.1, 0.25, 1.0);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Combinators
// ---------------------------------------------------------------------------

describe('compose', () => {
  it('compose with no easings returns linear', () => {
    const fn = compose();
    expect(fn(0)).toBe(0);
    expect(fn(0.5)).toBe(0.5);
    expect(fn(1)).toBe(1);
  });

  it('compose with one easing returns that easing', () => {
    const fn = compose(easeInQuad);
    expect(fn(0.5)).toBeCloseTo(easeInQuad(0.5), 5);
  });

  it('compose chains two easings across equal segments', () => {
    const fn = compose(easeInQuad, easeOutCubic);
    // At t=0.25 we're in the first segment (localT=0.5)
    // First segment contributes [0, 0.5) of output, easeInQuad(0.5) = 0.25
    // So output = 0 + 0.5 * 0.25 = 0.125
    expect(fn(0.25)).toBeCloseTo(0.125, 3);
    // At boundaries
    expect(fn(0)).toBe(0);
    expect(fn(1)).toBe(1);
  });
});

describe('reverse', () => {
  it('reverse(easeInQuad) inverts the curve', () => {
    const rev = reverse(easeInQuad);
    // reverse(f)(t) = 1 - f(1-t)
    // At t=0: 1 - easeInQuad(1) = 1 - 1 = 0
    expect(rev(0)).toBeCloseTo(0, 5);
    // At t=1: 1 - easeInQuad(0) = 1 - 0 = 1
    expect(rev(1)).toBeCloseTo(1, 5);
    // At t=0.5: 1 - easeInQuad(0.5) = 1 - 0.25 = 0.75 (like easeOut)
    expect(rev(0.5)).toBeCloseTo(0.75, 5);
  });
});

describe('mirror', () => {
  it('mirror is symmetric around t=0.5', () => {
    const fn = mirror(easeInQuad);
    // At t=0.25: easeInQuad(0.5)/2 = 0.25/2 = 0.125
    const left = fn(0.25);
    // At t=0.75: 1 - easeInQuad(0.5)/2 = 1 - 0.125 = 0.875
    const right = fn(0.75);
    // left + right should ≈ 1 (symmetry)
    expect(left + right).toBeCloseTo(1, 5);
  });

  it('mirror f(0)=0 and f(1)=1', () => {
    const fn = mirror(easeInCubic);
    expect(fn(0)).toBeCloseTo(0, 5);
    expect(fn(1)).toBeCloseTo(1, 5);
  });

  it('mirror f(0.5) is approximately 0.5', () => {
    const fn = mirror(easeInQuad);
    // mirror(easeInQuad)(0.5) = easeInQuad(1) / 2 = 1 / 2 = 0.5
    expect(fn(0.5)).toBeCloseTo(0.5, 5);
  });
});
