import { describe, it, expect } from 'vitest';
import { inferSchema } from '../schemaInference';
import type { GeoFeature } from '../../types/geo';

function makeFeature(id: string, props: Record<string, unknown>): GeoFeature {
  return {
    id,
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: props,
  };
}

// ---------------------------------------------------------------------------
// Column type detection
// ---------------------------------------------------------------------------

describe('inferSchema', () => {
  it('detects numeric columns', () => {
    const features = [
      makeFeature('1', { value: 42, name: 'A' }),
      makeFeature('2', { value: 99, name: 'B' }),
      makeFeature('3', { value: 7, name: 'C' }),
    ];

    const profile = inferSchema(features);
    const valueCol = profile.columns.find((c) => c.name === 'value');
    expect(valueCol?.type).toBe('numeric');
    expect(valueCol?.min).toBe(7);
    expect(valueCol?.max).toBe(99);
    expect(profile.numericFields).toContain('value');
  });

  it('detects coordinate columns by name', () => {
    const features = [
      makeFeature('1', { lat: 40.7, lng: -73.9 }),
    ];

    const profile = inferSchema(features);
    expect(profile.columns.find((c) => c.name === 'lat')?.type).toBe('coordinate');
    expect(profile.columns.find((c) => c.name === 'lng')?.type).toBe('coordinate');
  });

  it('detects temporal columns by name pattern', () => {
    const features = [
      makeFeature('1', { timestamp: '2024-01-15T10:00:00Z', value: 5 }),
      makeFeature('2', { timestamp: '2024-01-16T11:00:00Z', value: 8 }),
    ];

    const profile = inferSchema(features);
    const tsCol = profile.columns.find((c) => c.name === 'timestamp');
    expect(tsCol?.type).toBe('temporal');
    expect(profile.temporalField).toBe('timestamp');
  });

  it('detects categorical fields with few unique values', () => {
    const features = Array.from({ length: 50 }, (_, i) =>
      makeFeature(String(i), { category: i % 3 === 0 ? 'A' : i % 3 === 1 ? 'B' : 'C', value: i }),
    );

    const profile = inferSchema(features);
    const catCol = profile.columns.find((c) => c.name === 'category');
    expect(catCol?.type).toBe('categorical');
    expect(profile.categoricalFields).toContain('category');
  });

  it('handles empty features', () => {
    const profile = inferSchema([]);
    expect(profile.rowCount).toBe(0);
    expect(profile.columns).toHaveLength(0);
  });

  it('reports row count correctly', () => {
    const features = [
      makeFeature('1', { v: 1 }),
      makeFeature('2', { v: 2 }),
      makeFeature('3', { v: 3 }),
    ];

    const profile = inferSchema(features);
    expect(profile.rowCount).toBe(3);
  });

  it('detects epoch timestamps as temporal', () => {
    const features = [
      makeFeature('1', { time: 1700000000000 }),
      makeFeature('2', { time: 1700000001000 }),
    ];

    const profile = inferSchema(features);
    const timeCol = profile.columns.find((c) => c.name === 'time');
    expect(timeCol?.type).toBe('temporal');
  });
});
