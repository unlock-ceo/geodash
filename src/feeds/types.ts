// ---------------------------------------------------------------------------
// Feed Types
// ---------------------------------------------------------------------------

import type { GeoDataset } from '../types/geo';

/** Status state machine for a live data feed. */
export type FeedStatus = 'connecting' | 'streaming' | 'stale' | 'stopped';

/** Configuration for a data feed provider. */
export interface FeedProvider {
  /** Unique identifier. */
  id: string;
  /** Human-readable name. */
  displayName: string;
  /** Polling interval in milliseconds. */
  interval: number;
  /** Fetch function — returns a GeoDataset or throws on failure. */
  fetch(): Promise<GeoDataset>;
}

/** State snapshot of a running feed. */
export interface FeedState {
  status: FeedStatus;
  lastData: GeoDataset | null;
  lastUpdate: number;
  errorCount: number;
}
