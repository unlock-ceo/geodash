// ---------------------------------------------------------------------------
// Feeds barrel
// ---------------------------------------------------------------------------

export { startFeed, stopFeed, getFeedState } from './feedRegistry';
export { usgsEarthquakeProvider } from './usgsEarthquakes';
export { issTrackerProvider } from './issTracker';
export type { FeedProvider, FeedState, FeedStatus } from './types';
