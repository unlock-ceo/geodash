import { describe, it, expect } from 'vitest';
import { CinematicCamera } from '../CinematicCamera';
import { linear, easeInQuad } from '../easing';
import type { CameraKeyframe, CameraShot, FlightPath } from '../types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const kfA: CameraKeyframe = { center: [0, 0], zoom: 2, pitch: 0, bearing: 0 };
const kfB: CameraKeyframe = { center: [10, 20], zoom: 12, pitch: 60, bearing: 90 };
const kfC: CameraKeyframe = { center: [20, 40], zoom: 8, pitch: 30, bearing: 180 };

function linearShot(from: CameraKeyframe, to: CameraKeyframe): CameraShot {
  return { type: 'flyTo', from, to, duration: 1000, easing: linear };
}

// ---------------------------------------------------------------------------
// evaluate() — core interpolation
// ---------------------------------------------------------------------------

describe('CinematicCamera.evaluate', () => {
  it('at t=0 returns the from keyframe', () => {
    const shot = linearShot(kfA, kfB);
    const result = CinematicCamera.evaluate(shot, 0);
    expect(result.center[0]).toBeCloseTo(kfA.center[0]);
    expect(result.center[1]).toBeCloseTo(kfA.center[1]);
    expect(result.zoom).toBeCloseTo(kfA.zoom);
    expect(result.pitch).toBeCloseTo(kfA.pitch);
    expect(result.bearing).toBeCloseTo(kfA.bearing);
  });

  it('at t=1 returns the to keyframe', () => {
    const shot = linearShot(kfA, kfB);
    const result = CinematicCamera.evaluate(shot, 1);
    expect(result.center[0]).toBeCloseTo(kfB.center[0]);
    expect(result.center[1]).toBeCloseTo(kfB.center[1]);
    expect(result.zoom).toBeCloseTo(kfB.zoom);
    expect(result.pitch).toBeCloseTo(kfB.pitch);
    expect(result.bearing).toBeCloseTo(kfB.bearing);
  });

  it('at t=0.5 with linear easing returns the midpoint', () => {
    const shot = linearShot(kfA, kfB);
    const result = CinematicCamera.evaluate(shot, 0.5);
    expect(result.center[0]).toBeCloseTo(5);
    expect(result.center[1]).toBeCloseTo(10);
    expect(result.zoom).toBeCloseTo(7);
    expect(result.pitch).toBeCloseTo(30);
    expect(result.bearing).toBeCloseTo(45);
  });

  it('applies easing function before interpolation', () => {
    const shot: CameraShot = {
      type: 'flyTo',
      from: kfA,
      to: kfB,
      duration: 1000,
      easing: easeInQuad, // easeInQuad(0.5) = 0.25
    };
    const result = CinematicCamera.evaluate(shot, 0.5);
    // With easeInQuad, t=0.5 maps to 0.25, so zoom = 2 + (12-2)*0.25 = 4.5
    expect(result.zoom).toBeCloseTo(4.5);
    expect(result.center[0]).toBeCloseTo(2.5); // 0 + 10*0.25
    expect(result.center[1]).toBeCloseTo(5);   // 0 + 20*0.25
  });

  it('with controlPoints uses bezier path (differs from linear)', () => {
    const controlPoint: CameraKeyframe = {
      center: [5, 30], // offset from the straight line
      zoom: 6,
      pitch: 45,
      bearing: 45,
    };
    const linearResult = CinematicCamera.evaluate(linearShot(kfA, kfB), 0.5);
    const bezierShot: CameraShot = {
      type: 'flyTo',
      from: kfA,
      to: kfB,
      duration: 1000,
      easing: linear,
      controlPoints: [controlPoint],
    };
    const bezierResult = CinematicCamera.evaluate(bezierShot, 0.5);

    // The bezier result should differ from pure linear interpolation
    // because the control point pulls the curve off the straight line
    const diffLat = Math.abs(bezierResult.center[1] - linearResult.center[1]);
    expect(diffLat).toBeGreaterThan(0.1);
  });

  it('clamps t to [0,1]', () => {
    const shot = linearShot(kfA, kfB);
    const resultNeg = CinematicCamera.evaluate(shot, -0.5);
    const result0 = CinematicCamera.evaluate(shot, 0);
    expect(resultNeg.zoom).toBeCloseTo(result0.zoom);

    const resultOver = CinematicCamera.evaluate(shot, 1.5);
    const result1 = CinematicCamera.evaluate(shot, 1);
    expect(resultOver.zoom).toBeCloseTo(result1.zoom);
  });
});

// ---------------------------------------------------------------------------
// evaluatePath() — multi-segment evaluation
// ---------------------------------------------------------------------------

describe('CinematicCamera.evaluatePath', () => {
  it('finds correct segment at different t values', () => {
    const path: FlightPath = {
      keyframes: [kfA, kfB, kfC],
      durations: [1000, 1000], // two equal segments
      easings: [linear, linear],
    };

    // At t=0, should be at kfA
    const start = CinematicCamera.evaluatePath(path, 0);
    expect(start.zoom).toBeCloseTo(kfA.zoom);

    // At t=0.25, should be in first segment at local 0.5
    const quarter = CinematicCamera.evaluatePath(path, 0.25);
    expect(quarter.zoom).toBeCloseTo((kfA.zoom + kfB.zoom) / 2);

    // At t=1, should be at kfC
    const end = CinematicCamera.evaluatePath(path, 1);
    expect(end.zoom).toBeCloseTo(kfC.zoom);
  });

  it('handles empty keyframes gracefully', () => {
    const path: FlightPath = {
      keyframes: [],
      durations: [],
      easings: [],
    };
    const result = CinematicCamera.evaluatePath(path, 0.5);
    expect(result.center).toEqual([0, 0]);
    expect(result.zoom).toBe(1);
  });

  it('handles single keyframe — always returns that keyframe', () => {
    const path: FlightPath = {
      keyframes: [kfA],
      durations: [],
      easings: [],
    };
    const result = CinematicCamera.evaluatePath(path, 0.5);
    expect(result.zoom).toBeCloseTo(kfA.zoom);
    expect(result.center[0]).toBeCloseTo(kfA.center[0]);
  });

  it('handles zero total duration — returns first keyframe', () => {
    const path: FlightPath = {
      keyframes: [kfA, kfB],
      durations: [0],
      easings: [linear],
    };
    const result = CinematicCamera.evaluatePath(path, 0.5);
    expect(result.zoom).toBeCloseTo(kfA.zoom);
  });
});

// ---------------------------------------------------------------------------
// Shot presets
// ---------------------------------------------------------------------------

describe('Shot presets', () => {
  it('flyTo returns type "flyTo"', () => {
    const shot = CinematicCamera.flyTo(kfA, kfB);
    expect(shot.type).toBe('flyTo');
    expect(shot.from).toBe(kfA);
    expect(shot.to).toBe(kfB);
    expect(shot.duration).toBe(3000); // default
  });

  it('dolly adjusts zoom by distance', () => {
    const shot = CinematicCamera.dolly(kfA, 5);
    expect(shot.type).toBe('dolly');
    expect(shot.to.zoom).toBe(kfA.zoom + 5);
    // Center, pitch, bearing unchanged
    expect(shot.to.center[0]).toBe(kfA.center[0]);
    expect(shot.to.pitch).toBe(kfA.pitch);
    expect(shot.to.bearing).toBe(kfA.bearing);
  });

  it('crane adjusts pitch and clamps to [0, 85]', () => {
    const shot = CinematicCamera.crane(kfA, 100); // from pitch=0 + 100 = clamped to 85
    expect(shot.type).toBe('crane');
    expect(shot.to.pitch).toBe(85);

    // Negative delta
    const shot2 = CinematicCamera.crane(kfB, -100); // from pitch=60 - 100 = clamped to 0
    expect(shot2.to.pitch).toBe(0);
  });

  it('orbit sets from/to bearings', () => {
    const shot = CinematicCamera.orbit([0, 0], 1, 30, 120, 10, 45);
    expect(shot.type).toBe('orbit');
    expect(shot.from.bearing).toBe(30);
    expect(shot.to.bearing).toBe(120);
    expect(shot.from.zoom).toBe(10);
    expect(shot.to.zoom).toBe(10);
  });

  it('pullBack subtracts zoom and reduces pitch', () => {
    const from: CameraKeyframe = { center: [0, 0], zoom: 14, pitch: 60, bearing: 0 };
    const shot = CinematicCamera.pullBack(from, 4);
    expect(shot.type).toBe('pullBack');
    expect(shot.to.zoom).toBe(10); // 14 - 4
    expect(shot.to.pitch).toBe(50); // 60 - 10
  });

  it('globeToCity has 3 control points with from zoom 1.8 and to zoom 14', () => {
    const shot = CinematicCamera.globeToCity([-73.97, 40.77]);
    expect(shot.type).toBe('globeToCity');
    expect(shot.from.zoom).toBeCloseTo(1.8);
    expect(shot.to.zoom).toBe(14);
    expect(shot.controlPoints).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Bearing interpolation — shortest arc across 360° boundary
// ---------------------------------------------------------------------------

describe('Bearing interpolation (shortest arc)', () => {
  it('350° → 10° goes clockwise through 0° (not counterclockwise through 180°)', () => {
    const from: CameraKeyframe = { center: [0, 0], zoom: 5, pitch: 0, bearing: 350 };
    const to: CameraKeyframe = { center: [0, 0], zoom: 5, pitch: 0, bearing: 10 };
    const shot = linearShot(from, to);

    const mid = CinematicCamera.evaluate(shot, 0.5);
    // Shortest arc: 350 → 360/0 → 10, midpoint ≈ 0 (or 360)
    expect(mid.bearing).toBeCloseTo(0, 0);
  });

  it('10° → 350° goes counterclockwise through 0°', () => {
    const from: CameraKeyframe = { center: [0, 0], zoom: 5, pitch: 0, bearing: 10 };
    const to: CameraKeyframe = { center: [0, 0], zoom: 5, pitch: 0, bearing: 350 };
    const shot = linearShot(from, to);

    const mid = CinematicCamera.evaluate(shot, 0.5);
    // Shortest arc: 10 → 0/360 → 350, midpoint ≈ 0 (or 360)
    expect(mid.bearing % 360).toBeCloseTo(0, 0);
  });

  it('0° → 180° — half-circle rotation', () => {
    const from: CameraKeyframe = { center: [0, 0], zoom: 5, pitch: 0, bearing: 0 };
    const to: CameraKeyframe = { center: [0, 0], zoom: 5, pitch: 0, bearing: 180 };
    const shot = linearShot(from, to);

    const mid = CinematicCamera.evaluate(shot, 0.5);
    expect(mid.bearing).toBeCloseTo(90, 0);
  });
});
