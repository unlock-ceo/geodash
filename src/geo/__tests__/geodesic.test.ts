import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  initialBearing,
  metersPerPixelAtLatZoom,
  roundScaleDistance,
  formatCoordinate,
} from '../geodesic';

// ---------------------------------------------------------------------------
// Haversine distance
// ---------------------------------------------------------------------------

describe('haversineDistance', () => {
  it('computes NYC to London distance correctly (~5570 km)', () => {
    // NYC: 40.7128°N, 74.0060°W → London: 51.5074°N, 0.1278°W
    const dist = haversineDistance(40.7128, -74.006, 51.5074, -0.1278);
    // Known distance: ~5,570 km
    expect(dist).toBeGreaterThan(5_500_000);
    expect(dist).toBeLessThan(5_650_000);
  });

  it('returns 0 for same point', () => {
    expect(haversineDistance(40, -74, 40, -74)).toBe(0);
  });

  it('computes equator antipodal distance (~20,015 km)', () => {
    const dist = haversineDistance(0, 0, 0, 180);
    // Half Earth circumference
    expect(dist).toBeGreaterThan(20_000_000);
    expect(dist).toBeLessThan(20_050_000);
  });

  it('computes short distance accurately (~111 km per degree at equator)', () => {
    const dist = haversineDistance(0, 0, 1, 0);
    // 1 degree of latitude ≈ 111.195 km
    expect(dist).toBeGreaterThan(110_000);
    expect(dist).toBeLessThan(112_000);
  });
});

// ---------------------------------------------------------------------------
// Initial bearing
// ---------------------------------------------------------------------------

describe('initialBearing', () => {
  it('north bearing is ~0°', () => {
    const bearing = initialBearing(40, -74, 41, -74);
    expect(bearing).toBeCloseTo(0, 0);
  });

  it('east bearing is ~90°', () => {
    const bearing = initialBearing(0, 0, 0, 1);
    expect(bearing).toBeCloseTo(90, 0);
  });

  it('south bearing is ~180°', () => {
    const bearing = initialBearing(41, -74, 40, -74);
    expect(bearing).toBeCloseTo(180, 0);
  });

  it('west bearing is ~270°', () => {
    const bearing = initialBearing(0, 1, 0, 0);
    expect(bearing).toBeCloseTo(270, 0);
  });
});

// ---------------------------------------------------------------------------
// Meters per pixel
// ---------------------------------------------------------------------------

describe('metersPerPixelAtLatZoom', () => {
  it('returns ~156km/px at zoom 0 at equator', () => {
    const mpp = metersPerPixelAtLatZoom(0, 0);
    // At zoom 0: Earth circumference / 256 ≈ 156,543 m/px
    expect(mpp).toBeGreaterThan(155_000);
    expect(mpp).toBeLessThan(158_000);
  });

  it('halves with each zoom level', () => {
    const mpp0 = metersPerPixelAtLatZoom(0, 10);
    const mpp1 = metersPerPixelAtLatZoom(0, 11);
    expect(mpp1).toBeCloseTo(mpp0 / 2, 2);
  });

  it('decreases with latitude (Mercator distortion)', () => {
    const equator = metersPerPixelAtLatZoom(0, 10);
    const arctic = metersPerPixelAtLatZoom(60, 10);
    expect(arctic).toBeLessThan(equator);
  });
});

// ---------------------------------------------------------------------------
// Round scale distance
// ---------------------------------------------------------------------------

describe('roundScaleDistance', () => {
  it('returns a round number that fits within the bar', () => {
    const [meters, label] = roundScaleDistance(100, 120);
    // 100 m/px * 120px = 12,000m max → should pick 10,000m = 10 km
    expect(meters).toBe(10_000);
    expect(label).toBe('10 km');
  });

  it('uses meters for small scales', () => {
    const [meters, label] = roundScaleDistance(1, 120);
    // 1 m/px * 120px = 120m max → should pick 100m
    expect(meters).toBe(100);
    expect(label).toBe('100 m');
  });
});

// ---------------------------------------------------------------------------
// Format coordinate
// ---------------------------------------------------------------------------

describe('formatCoordinate', () => {
  it('formats positive coordinates with N/E', () => {
    expect(formatCoordinate(40.6892, 74.0445)).toBe('40.6892°N 74.0445°E');
  });

  it('formats negative coordinates with S/W', () => {
    expect(formatCoordinate(-33.8688, -151.2093)).toBe('33.8688°S 151.2093°W');
  });

  it('uses custom decimal places', () => {
    expect(formatCoordinate(40.6892, -74.0445, 2)).toBe('40.69°N 74.04°W');
  });
});
