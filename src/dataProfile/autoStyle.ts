// ---------------------------------------------------------------------------
// Auto-Styling — generate particle style config from data profile
// ---------------------------------------------------------------------------

import type { GeoDataset } from '../types/geo';
import type { DataProfile, StyleConfig, StoryType } from './types';
import { inferSchema } from './schemaInference';
import { detectStory } from './storyDetection';

// ---------------------------------------------------------------------------
// Color ramps
// ---------------------------------------------------------------------------

/** Sequential blue-cyan ramp for magnitude/density. */
const SEQUENTIAL_RAMP: [number, number, number, number][] = [
  [0.1, 0.2, 0.4, 0.6],
  [0.15, 0.4, 0.7, 0.75],
  [0.2, 0.6, 0.9, 0.85],
  [0.4, 0.85, 1.0, 0.9],
  [0.7, 0.95, 1.0, 0.95],
];

/** Categorical palette — distinct hues. */
const CATEGORICAL_PALETTE: [number, number, number, number][] = [
  [0.31, 0.76, 0.97, 0.85],  // Cyan
  [0.98, 0.45, 0.29, 0.85],  // Orange
  [0.56, 0.87, 0.44, 0.85],  // Green
  [0.91, 0.36, 0.78, 0.85],  // Pink
  [1.0, 0.84, 0.28, 0.85],   // Yellow
  [0.47, 0.44, 0.88, 0.85],  // Purple
];

/** Temporal ramp — warm progression. */
const TEMPORAL_RAMP: [number, number, number, number][] = [
  [0.15, 0.25, 0.5, 0.5],
  [0.3, 0.5, 0.7, 0.65],
  [0.6, 0.7, 0.4, 0.75],
  [0.9, 0.6, 0.2, 0.85],
  [1.0, 0.35, 0.15, 0.95],
];

// ---------------------------------------------------------------------------
// Auto-style pipeline
// ---------------------------------------------------------------------------

/**
 * Profile a dataset and generate visualization style config.
 * Pipeline: features → schemaInference → storyDetection → styleConfig
 */
export function profileAndStyle(dataset: GeoDataset): StyleConfig {
  const profile = inferSchema(dataset.features);
  const story = detectStory(profile);
  return generateStyle(profile, story);
}

function generateStyle(profile: DataProfile, story: StoryType): StyleConfig {
  switch (story) {
    case 'temporal':
      return {
        colorStops: TEMPORAL_RAMP,
        colorField: profile.temporalField ?? null,
        baseSize: 4.0,
        sizeField: null,
        sizeScale: 1.0,
        story,
      };

    case 'magnitude':
      return {
        colorStops: SEQUENTIAL_RAMP,
        colorField: findMagnitudeField(profile),
        baseSize: 3.0,
        sizeField: findMagnitudeField(profile),
        sizeScale: 2.0,
        story,
      };

    case 'categorical':
      return {
        colorStops: CATEGORICAL_PALETTE,
        colorField: profile.categoricalFields[0] ?? null,
        baseSize: 4.0,
        sizeField: null,
        sizeScale: 1.0,
        story,
      };

    case 'density':
      return {
        colorStops: SEQUENTIAL_RAMP,
        colorField: null,
        baseSize: 3.0,
        sizeField: null,
        sizeScale: 1.0,
        story,
      };

    case 'simple':
    default:
      return {
        colorStops: [[0.31, 0.76, 0.97, 0.85]],
        colorField: null,
        baseSize: 4.0,
        sizeField: null,
        sizeScale: 1.0,
        story,
      };
  }
}

function findMagnitudeField(profile: DataProfile): string | null {
  const priority = ['mag', 'magnitude', 'value', 'intensity', 'score', 'count', 'population'];
  for (const p of priority) {
    if (profile.numericFields.some((f) => f.toLowerCase() === p)) {
      return profile.numericFields.find((f) => f.toLowerCase() === p) ?? null;
    }
  }
  // Fall back to first numeric field
  return profile.numericFields[0] ?? null;
}

/**
 * Given a StyleConfig and a feature's properties, return the particle
 * color and size for that feature.
 */
export function styleFeature(
  config: StyleConfig,
  properties: Record<string, unknown>,
  fieldMin: number,
  fieldMax: number,
): { color: [number, number, number, number]; size: number } {
  let color: [number, number, number, number] = config.colorStops[0] ?? [0.5, 0.5, 0.5, 0.8];
  let size = config.baseSize;

  if (config.colorField && config.colorStops.length > 1) {
    const val = properties[config.colorField];

    if (typeof val === 'number' && fieldMax > fieldMin) {
      // Numeric → interpolate along color ramp
      const t = Math.max(0, Math.min(1, (val - fieldMin) / (fieldMax - fieldMin)));
      color = sampleColorRamp(config.colorStops, t);
    } else if (typeof val === 'string') {
      // Categorical → hash to palette index
      const hash = simpleHash(val);
      color = config.colorStops[hash % config.colorStops.length]!;
    }
  }

  if (config.sizeField) {
    const val = properties[config.sizeField];
    if (typeof val === 'number' && fieldMax > fieldMin) {
      const t = Math.max(0, Math.min(1, (val - fieldMin) / (fieldMax - fieldMin)));
      size = config.baseSize + t * config.baseSize * config.sizeScale;
    }
  }

  return { color, size };
}

function sampleColorRamp(
  stops: [number, number, number, number][],
  t: number,
): [number, number, number, number] {
  const idx = t * (stops.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, stops.length - 1);
  const frac = idx - lo;

  const a = stops[lo]!;
  const b = stops[hi]!;
  return [
    a[0] + (b[0] - a[0]) * frac,
    a[1] + (b[1] - a[1]) * frac,
    a[2] + (b[2] - a[2]) * frac,
    a[3] + (b[3] - a[3]) * frac,
  ];
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
