import { describe, it, expect } from 'vitest';
import { parseUSGSResponse } from '../usgsEarthquakes';
import { parseISSResponse } from '../issTracker';
import { transitionStatus } from '../feedRegistry';

// ---------------------------------------------------------------------------
// USGS response parsing
// ---------------------------------------------------------------------------

describe('parseUSGSResponse', () => {
  it('parses USGS GeoJSON features into a GeoDataset', () => {
    const mockData = {
      features: [
        {
          id: 'us7000abc',
          geometry: { type: 'Point', coordinates: [-118.5, 34.0, 10.0] },
          properties: { mag: 4.2, place: '10km NW of LA', time: 1700000000000, type: 'earthquake' },
        },
        {
          id: 'us7000def',
          geometry: { type: 'Point', coordinates: [139.7, 35.7, 5.0] },
          properties: { mag: 3.1, place: 'Near Tokyo', time: 1700000001000, type: 'earthquake' },
        },
      ],
    };

    const dataset = parseUSGSResponse(mockData);

    expect(dataset.id).toBe('usgs-earthquakes');
    expect(dataset.features).toHaveLength(2);
    expect(dataset.features[0]!.properties.mag).toBe(4.2);
    expect(dataset.features[1]!.properties.place).toBe('Near Tokyo');
    expect(dataset.crs).toBe('EPSG:4326');
    expect(dataset.bounds.sw.lng).toBeCloseTo(-118.5);
    expect(dataset.bounds.ne.lng).toBeCloseTo(139.7);
  });

  it('handles empty feature list', () => {
    const dataset = parseUSGSResponse({ features: [] });
    expect(dataset.features).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// ISS response parsing
// ---------------------------------------------------------------------------

describe('parseISSResponse', () => {
  it('parses ISS position response into a GeoDataset', () => {
    const mockData = {
      message: 'success',
      timestamp: 1700000000,
      iss_position: {
        latitude: '51.5074',
        longitude: '-0.1278',
      },
    };

    const dataset = parseISSResponse(mockData);

    expect(dataset.id).toBe('iss-tracker');
    expect(dataset.features).toHaveLength(1);
    expect(dataset.features[0]!.geometry.type).toBe('Point');
    expect((dataset.features[0]!.geometry as { coordinates: number[] }).coordinates[0]).toBeCloseTo(-0.1278);
    expect((dataset.features[0]!.geometry as { coordinates: number[] }).coordinates[1]).toBeCloseTo(51.5074);
    expect(dataset.features[0]!.properties.name).toBe('International Space Station');
  });
});

// ---------------------------------------------------------------------------
// FeedStatus state transitions
// ---------------------------------------------------------------------------

describe('FeedStatus state machine', () => {
  it('transitions to streaming on success', () => {
    expect(transitionStatus('connecting', true, 0)).toBe('streaming');
    expect(transitionStatus('stale', true, 5)).toBe('streaming');
  });

  it('stays connecting on failure with low error count', () => {
    expect(transitionStatus('connecting', false, 1)).toBe('connecting');
    expect(transitionStatus('connecting', false, 2)).toBe('connecting');
  });

  it('transitions to stale after 3 consecutive failures', () => {
    expect(transitionStatus('connecting', false, 3)).toBe('stale');
    expect(transitionStatus('streaming', false, 3)).toBe('stale');
  });

  it('stays streaming on first failure if was streaming', () => {
    expect(transitionStatus('streaming', false, 1)).toBe('streaming');
  });
});
