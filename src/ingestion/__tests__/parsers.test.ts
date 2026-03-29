import { describe, it, expect, vi, beforeAll } from 'vitest';
import { ingestFile } from '../parsers';
import { detectFormat } from '../parsers';

// Mock crypto.randomUUID for deterministic IDs
beforeAll(() => {
  let counter = 0;
  vi.stubGlobal('crypto', {
    randomUUID: () => `test-uuid-${++counter}`,
  });
});

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

describe('detectFormat', () => {
  it('detects .geojson', () => {
    expect(detectFormat('data.geojson')).toBe('geojson');
  });

  it('detects .json as geojson', () => {
    expect(detectFormat('data.json')).toBe('geojson');
  });

  it('detects .csv', () => {
    expect(detectFormat('points.csv')).toBe('csv');
  });

  it('returns null for unknown extensions', () => {
    expect(detectFormat('image.png')).toBeNull();
    expect(detectFormat('data.xlsx')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GeoJSON parsing
// ---------------------------------------------------------------------------

describe('GeoJSON parsing', () => {
  it('parses a FeatureCollection', async () => {
    const geojson = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-73.98, 40.75] },
          properties: { name: 'NYC' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-0.12, 51.51] },
          properties: { name: 'London' },
        },
      ],
    });

    const file = new File([geojson], 'cities.geojson', { type: 'application/json' });
    const result = await ingestFile(file);

    expect(result.status).toBe('complete');
    if (result.status === 'complete') {
      expect(result.dataset.features).toHaveLength(2);
      expect(result.dataset.name).toBe('cities');
      expect(result.dataset.crs).toBe('EPSG:4326');
      expect(result.dataset.bounds.sw.lng).toBeCloseTo(-73.98);
      expect(result.dataset.bounds.ne.lat).toBeCloseTo(51.51);
    }
  });

  it('wraps a single Feature into a FeatureCollection', async () => {
    const geojson = JSON.stringify({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [10, 20] },
      properties: { label: 'test' },
    });

    const file = new File([geojson], 'point.geojson');
    const result = await ingestFile(file);

    expect(result.status).toBe('complete');
    if (result.status === 'complete') {
      expect(result.dataset.features).toHaveLength(1);
    }
  });

  it('wraps a bare Geometry into a FeatureCollection', async () => {
    const geojson = JSON.stringify({
      type: 'Point',
      coordinates: [5, 10],
    });

    const file = new File([geojson], 'bare.geojson');
    const result = await ingestFile(file);

    expect(result.status).toBe('complete');
    if (result.status === 'complete') {
      expect(result.dataset.features).toHaveLength(1);
      expect(result.dataset.features[0]!.geometry.type).toBe('Point');
    }
  });

  it('returns empty for invalid JSON', async () => {
    const file = new File(['not json at all'], 'bad.geojson');
    const result = await ingestFile(file);
    expect(result.status).toBe('empty');
  });

  it('returns empty for empty FeatureCollection', async () => {
    const geojson = JSON.stringify({ type: 'FeatureCollection', features: [] });
    const file = new File([geojson], 'empty.geojson');
    const result = await ingestFile(file);
    expect(result.status).toBe('empty');
  });

  it('computes correct bounding box for multi-point features', async () => {
    const geojson = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [[-10, -20], [30, 40]] },
          properties: {},
        },
      ],
    });

    const file = new File([geojson], 'line.geojson');
    const result = await ingestFile(file);

    expect(result.status).toBe('complete');
    if (result.status === 'complete') {
      expect(result.dataset.bounds.sw.lng).toBeCloseTo(-10);
      expect(result.dataset.bounds.sw.lat).toBeCloseTo(-20);
      expect(result.dataset.bounds.ne.lng).toBeCloseTo(30);
      expect(result.dataset.bounds.ne.lat).toBeCloseTo(40);
    }
  });
});

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

describe('CSV parsing', () => {
  it('detects lat/lon columns by name', async () => {
    const csv = 'name,latitude,longitude\nNYC,40.75,-73.98\nLondon,51.51,-0.12';
    const file = new File([csv], 'cities.csv');
    const result = await ingestFile(file);

    expect(result.status).toBe('complete');
    if (result.status === 'complete') {
      expect(result.dataset.features).toHaveLength(2);
      expect(result.dataset.features[0]!.geometry.type).toBe('Point');
    }
  });

  it('detects lat/lng shorthand columns', async () => {
    const csv = 'id,lat,lng\n1,40.75,-73.98';
    const file = new File([csv], 'data.csv');
    const result = await ingestFile(file);

    expect(result.status).toBe('complete');
    if (result.status === 'complete') {
      expect(result.dataset.features).toHaveLength(1);
    }
  });

  it('detects x/y columns', async () => {
    const csv = 'label,y,x\nA,40.75,-73.98';
    const file = new File([csv], 'xy.csv');
    const result = await ingestFile(file);

    expect(result.status).toBe('complete');
  });

  it('returns partial for rows with invalid coordinates', async () => {
    const csv = 'name,lat,lon\nGood,40.75,-73.98\nBad,abc,xyz\nAlso Good,51.51,-0.12';
    const file = new File([csv], 'mixed.csv');
    const result = await ingestFile(file);

    expect(result.status).toBe('partial');
    if (result.status === 'partial') {
      expect(result.dataset.features).toHaveLength(2);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Row 3');
    }
  });

  it('returns empty when no lat/lon columns found', async () => {
    const csv = 'city,population\nNYC,8000000';
    const file = new File([csv], 'nocols.csv');
    const result = await ingestFile(file);

    expect(result.status).toBe('empty');
    if (result.status === 'empty') {
      expect(result.reason).toContain('No coordinates found');
    }
  });

  it('returns empty for CSV with only headers', async () => {
    const csv = 'lat,lon';
    const file = new File([csv], 'headers.csv');
    const result = await ingestFile(file);

    expect(result.status).toBe('empty');
  });

  it('parses numeric properties correctly', async () => {
    const csv = 'name,lat,lon,value\nA,40.75,-73.98,42.5';
    const file = new File([csv], 'nums.csv');
    const result = await ingestFile(file);

    expect(result.status).toBe('complete');
    if (result.status === 'complete') {
      expect(result.dataset.features[0]!.properties['value']).toBe(42.5);
      expect(result.dataset.features[0]!.properties['name']).toBe('A');
    }
  });
});

// ---------------------------------------------------------------------------
// Unsupported format
// ---------------------------------------------------------------------------

describe('unsupported format', () => {
  it('returns empty for .png', async () => {
    const file = new File(['binary'], 'image.png');
    const result = await ingestFile(file);
    expect(result.status).toBe('empty');
    if (result.status === 'empty') {
      expect(result.reason).toContain('Unsupported format');
    }
  });
});
