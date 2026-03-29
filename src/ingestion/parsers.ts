// ---------------------------------------------------------------------------
// Ingestion Parsers — GeoJSON and CSV
// ---------------------------------------------------------------------------
// Deep module: all parsing complexity is hidden behind ingestFile().
// Parser registry is extensible via Map<Format, ParserFn>.
// ---------------------------------------------------------------------------

import type { Feature, FeatureCollection, GeoJSON, Geometry, Position } from 'geojson';
import type { GeoFeature, BoundingBox } from '../types/geo';
import type { SupportedFormat, ParserFn, ParseResult } from './types';

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

/** Detect format from file extension. */
export function detectFormat(fileName: string): SupportedFormat | null {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'geojson' || ext === 'json') return 'geojson';
  if (ext === 'csv') return 'csv';
  return null;
}

// ---------------------------------------------------------------------------
// Parser registry
// ---------------------------------------------------------------------------

const parsers = new Map<SupportedFormat, ParserFn>([
  ['geojson', parseGeoJSON],
  ['csv', parseCSV],
]);

// ---------------------------------------------------------------------------
// GeoJSON parser
// ---------------------------------------------------------------------------

function parseGeoJSON(text: string, fileName: string): ParseResult {
  let parsed: GeoJSON;
  try {
    parsed = JSON.parse(text) as GeoJSON;
  } catch {
    return { status: 'empty', reason: 'Invalid JSON' };
  }

  // Normalise to FeatureCollection
  let fc: FeatureCollection;
  if (parsed.type === 'FeatureCollection') {
    fc = parsed as FeatureCollection;
  } else if (parsed.type === 'Feature') {
    fc = { type: 'FeatureCollection', features: [parsed as Feature] };
  } else if (isGeometry(parsed)) {
    fc = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: parsed as Geometry, properties: {} }],
    };
  } else {
    return { status: 'empty', reason: 'Unrecognised GeoJSON type' };
  }

  if (fc.features.length === 0) {
    return { status: 'empty', reason: 'FeatureCollection has no features' };
  }

  const features: GeoFeature[] = fc.features.map((f, i) => ({
    id: String((f.id ?? i)),
    geometry: f.geometry,
    properties: (f.properties ?? {}) as Record<string, unknown>,
  }));

  const bounds = computeBounds(features);
  const name = fileName.replace(/\.[^.]+$/, '');

  return {
    status: 'complete',
    dataset: {
      id: crypto.randomUUID(),
      name,
      features,
      crs: 'EPSG:4326',
      bounds,
    },
  };
}

function isGeometry(obj: GeoJSON): boolean {
  return ['Point', 'MultiPoint', 'LineString', 'MultiLineString',
    'Polygon', 'MultiPolygon', 'GeometryCollection'].includes(obj.type);
}

// ---------------------------------------------------------------------------
// CSV parser
// ---------------------------------------------------------------------------

/** Column name heuristics for lat/lon detection. */
const LAT_NAMES = ['lat', 'latitude', 'y', 'lat_y', 'point_y'];
const LON_NAMES = ['lng', 'lon', 'longitude', 'x', 'long', 'lat_x', 'point_x'];

/** Quote-aware CSV field split (handles RFC 4180 quoted fields with commas). */
function splitCSVRow(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuote) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function parseCSV(text: string, fileName: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { status: 'empty', reason: 'CSV has no data rows' };
  }

  const headers = splitCSVRow(lines[0]!).map((h) => h.trim());
  const headersLower = headers.map((h) => h.toLowerCase());

  // Detect lat/lon columns
  const latIdx = headersLower.findIndex((h) => LAT_NAMES.includes(h));
  const lonIdx = headersLower.findIndex((h) => LON_NAMES.includes(h));

  if (latIdx === -1 || lonIdx === -1) {
    return { status: 'empty', reason: 'No coordinates found — CSV needs lat/lon columns' };
  }

  const features: GeoFeature[] = [];
  const warnings: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVRow(lines[i]!).map((c) => c.trim());
    const lat = parseFloat(cols[latIdx] ?? '');
    const lon = parseFloat(cols[lonIdx] ?? '');

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      warnings.push(`Row ${i + 1}: invalid coordinates (${cols[latIdx]}, ${cols[lonIdx]})`);
      continue;
    }

    const properties: Record<string, unknown> = {};
    for (let c = 0; c < headers.length; c++) {
      if (c !== latIdx && c !== lonIdx) {
        const val = cols[c] ?? '';
        const num = parseFloat(val);
        properties[headers[c]!] = isNaN(num) ? val : num;
      }
    }

    features.push({
      id: String(i),
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties,
    });
  }

  if (features.length === 0) {
    return { status: 'empty', reason: 'No valid rows with coordinates found' };
  }

  const bounds = computeBounds(features);
  const name = fileName.replace(/\.[^.]+$/, '');
  const dataset = {
    id: crypto.randomUUID(),
    name,
    features,
    crs: 'EPSG:4326' as const,
    bounds,
  };

  if (warnings.length > 0) {
    return { status: 'partial', dataset, warnings };
  }
  return { status: 'complete', dataset };
}

// ---------------------------------------------------------------------------
// Bounding box computation
// ---------------------------------------------------------------------------

function extractCoords(geom: Geometry): Position[] {
  switch (geom.type) {
    case 'Point':
      return [geom.coordinates];
    case 'MultiPoint':
    case 'LineString':
      return geom.coordinates;
    case 'MultiLineString':
    case 'Polygon':
      return geom.coordinates.flat();
    case 'MultiPolygon':
      return geom.coordinates.flat(2);
    case 'GeometryCollection':
      return geom.geometries.flatMap(extractCoords);
    default:
      return [];
  }
}

function computeBounds(features: GeoFeature[]): BoundingBox {
  let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;

  for (const f of features) {
    for (const [lng, lat] of extractCoords(f.geometry)) {
      if (lng! < minLng) minLng = lng!;
      if (lng! > maxLng) maxLng = lng!;
      if (lat! < minLat) minLat = lat!;
      if (lat! > maxLat) maxLat = lat!;
    }
  }

  return {
    sw: { lng: minLng, lat: minLat },
    ne: { lng: maxLng, lat: maxLat },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Ingest a file and return a ParseResult.
 * Never throws — always resolves with a graduated status.
 */
export async function ingestFile(file: File): Promise<ParseResult> {
  const format = detectFormat(file.name);
  if (!format) {
    return { status: 'empty', reason: `Unsupported format — try .geojson or .csv` };
  }

  if (file.size > 10_000_000) {
    console.warn(`[ingestFile] Large file (${(file.size / 1_000_000).toFixed(1)}MB) — parsing may be slow`);
  }

  const text = await file.text();
  const parser = parsers.get(format);
  if (!parser) {
    return { status: 'empty', reason: `No parser registered for format: ${format}` };
  }

  return parser(text, file.name);
}
