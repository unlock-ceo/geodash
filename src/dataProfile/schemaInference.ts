// ---------------------------------------------------------------------------
// Schema Inference — detect column types from feature properties
// ---------------------------------------------------------------------------

import type { GeoFeature } from '../types/geo';
import type { ColumnSchema, DataProfile } from './types';

const TEMPORAL_PATTERNS = [
  /^(date|time|timestamp|datetime|created|updated|start|end)/i,
  /(date|time|timestamp)$/i,
];

const COORDINATE_NAMES = new Set([
  'lat', 'latitude', 'lng', 'lon', 'longitude', 'x', 'y',
  'lat_y', 'lat_x', 'point_x', 'point_y', 'long',
]);

/**
 * Infer the schema of a dataset from its features.
 * Samples up to 100 features for performance.
 */
export function inferSchema(features: GeoFeature[]): DataProfile {
  if (features.length === 0) {
    return {
      columns: [],
      rowCount: 0,
      hasCoordinates: true, // GeoJSON features always have geometry
      numericFields: [],
      categoricalFields: [],
    };
  }

  // Sample features for inference
  const sampleSize = Math.min(features.length, 100);
  const sample = features.slice(0, sampleSize);

  // Collect all property keys
  const keySet = new Set<string>();
  for (const f of sample) {
    for (const key of Object.keys(f.properties)) {
      keySet.add(key);
    }
  }

  const columns: ColumnSchema[] = [];
  const numericFields: string[] = [];
  const categoricalFields: string[] = [];
  let temporalField: string | undefined;

  for (const key of keySet) {
    const values: unknown[] = [];
    for (const f of sample) {
      const v = f.properties[key];
      if (v !== undefined && v !== null && v !== '') {
        values.push(v);
      }
    }

    const col = inferColumnType(key, values);
    columns.push(col);

    switch (col.type) {
      case 'numeric':
        numericFields.push(key);
        break;
      case 'categorical':
        categoricalFields.push(key);
        break;
      case 'temporal':
        if (!temporalField) temporalField = key;
        break;
    }
  }

  return {
    columns,
    rowCount: features.length,
    hasCoordinates: true,
    temporalField,
    numericFields,
    categoricalFields,
  };
}

function inferColumnType(name: string, values: unknown[]): ColumnSchema {
  if (values.length === 0) {
    return { name, type: 'text' };
  }

  // Check if it's a coordinate column
  if (COORDINATE_NAMES.has(name.toLowerCase())) {
    return { name, type: 'coordinate' };
  }

  // Check if temporal by name
  const isTemporal = TEMPORAL_PATTERNS.some((p) => p.test(name));
  if (isTemporal) {
    return {
      name,
      type: 'temporal',
      sampleValues: values.slice(0, 5),
    };
  }

  // Check value types
  let numericCount = 0;
  let min = Infinity;
  let max = -Infinity;
  const uniqueValues = new Set<string>();

  for (const v of values) {
    const str = String(v);
    uniqueValues.add(str);

    if (typeof v === 'number' && !isNaN(v)) {
      numericCount++;
      if (v < min) min = v;
      if (v > max) max = v;
    } else {
      const parsed = parseFloat(str);
      if (!isNaN(parsed)) {
        numericCount++;
        if (parsed < min) min = parsed;
        if (parsed > max) max = parsed;
      }
    }
  }

  // Check for temporal values (ISO date strings, epoch timestamps)
  if (numericCount === values.length && min > 946684800000 && max < 4102444800000) {
    // Looks like millisecond timestamps (2000-2100)
    return { name, type: 'temporal', min, max, sampleValues: values.slice(0, 5) };
  }

  // Numeric if >80% of values are numeric
  if (numericCount / values.length > 0.8) {
    return {
      name,
      type: 'numeric',
      min: min === Infinity ? undefined : min,
      max: max === -Infinity ? undefined : max,
      uniqueCount: uniqueValues.size,
    };
  }

  // Categorical if few unique values relative to total
  if (uniqueValues.size <= 20 || uniqueValues.size / values.length < 0.1) {
    return {
      name,
      type: 'categorical',
      uniqueCount: uniqueValues.size,
      sampleValues: [...uniqueValues].slice(0, 10),
    };
  }

  return { name, type: 'text', uniqueCount: uniqueValues.size };
}
