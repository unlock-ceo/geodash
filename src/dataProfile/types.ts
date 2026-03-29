// ---------------------------------------------------------------------------
// Data Profile Types
// ---------------------------------------------------------------------------

/** Detected column type. */
export type ColumnType = 'numeric' | 'categorical' | 'temporal' | 'coordinate' | 'text';

/** Schema for a single column/property. */
export interface ColumnSchema {
  name: string;
  type: ColumnType;
  min?: number;
  max?: number;
  uniqueCount?: number;
  sampleValues?: unknown[];
}

/** Full schema for a dataset. */
export interface DataProfile {
  columns: ColumnSchema[];
  rowCount: number;
  hasCoordinates: boolean;
  temporalField?: string;
  numericFields: string[];
  categoricalFields: string[];
}

/** Detected story type for auto-visualization. */
export type StoryType = 'temporal' | 'density' | 'categorical' | 'magnitude' | 'simple';

/** Visualization style config output. */
export interface StyleConfig {
  /** Color ramp: array of [r, g, b, a] stops. */
  colorStops: [number, number, number, number][];
  /** Field to map to color (null = uniform color). */
  colorField: string | null;
  /** Base particle size. */
  baseSize: number;
  /** Field to map to size (null = uniform). */
  sizeField: string | null;
  /** Size multiplier. */
  sizeScale: number;
  /** Story type detected. */
  story: StoryType;
}
