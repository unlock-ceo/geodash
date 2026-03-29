/**
 * Geo-coordinate projection utilities.
 *
 * Converts between geographic (lng/lat/alt) and MapLibre's Mercator
 * coordinate system used by custom layers.
 */

import maplibregl from 'maplibre-gl';

/**
 * Convert [lng, lat, alt] to MapLibre's Mercator coordinate system [0-1, 0-1, altitude-scaled].
 * MapLibre custom layers expect positions in this space.
 */
export function lngLatToMercator(
  lng: number,
  lat: number,
  altitude: number = 0,
): [number, number, number] {
  const mc = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], altitude);
  return [mc.x, mc.y, mc.z];
}

/**
 * Batch convert an array of [lng, lat, alt] positions to Mercator coordinates.
 * Input: Float32Array with 3 floats per position (lng, lat, alt)
 * Output: Float32Array with 3 floats per position (mx, my, mz) in Mercator space
 */
export function batchLngLatToMercator(
  positions: Float32Array,
  count: number,
): Float32Array {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const lng = positions[i3]!;
    const lat = positions[i3 + 1]!;
    const alt = positions[i3 + 2]!;
    const mc = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], alt);
    out[i3] = mc.x;
    out[i3 + 1] = mc.y;
    out[i3 + 2] = mc.z;
  }
  return out;
}

/**
 * Get the scale factor (meters per Mercator unit) at a given latitude.
 * Useful for converting metric sizes to Mercator-space sizes for rendering.
 */
export function metersPerPixelAtLat(lat: number, zoom: number): number {
  const mc = maplibregl.MercatorCoordinate.fromLngLat([0, lat]);
  return mc.meterInMercatorCoordinateUnits() * Math.pow(2, zoom) * 512;
}
