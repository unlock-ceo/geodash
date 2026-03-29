// ---------------------------------------------------------------------------
// Ingestion Types
// ---------------------------------------------------------------------------

import type { GeoDataset } from '../types/geo';

/** Supported input formats. */
export type SupportedFormat = 'geojson' | 'csv';

/** Graduated parse result — never throws. */
export type ParseResult =
  | { status: 'complete'; dataset: GeoDataset }
  | { status: 'partial'; dataset: GeoDataset; warnings: string[] }
  | { status: 'empty'; reason: string };

/** Internal parser function signature. */
export type ParserFn = (text: string, fileName: string) => ParseResult;
