// ---------------------------------------------------------------------------
// FeedRegistry — deep module owning polling, retry, and state management
// ---------------------------------------------------------------------------
// startFeed(provider) returns a dispose function.
// Errors become state transitions (connecting→stale), never exceptions.
// ---------------------------------------------------------------------------

import type { FeedProvider, FeedState, FeedStatus } from './types';

const MAX_FAILURES = 3;
const BASE_BACKOFF = 2000; // 2 seconds

type FeedListener = (state: FeedState) => void;

interface ActiveFeed {
  provider: FeedProvider;
  state: FeedState;
  timer: ReturnType<typeof setTimeout> | null;
  listeners: Set<FeedListener>;
}

const activeFeeds = new Map<string, ActiveFeed>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start a feed. Returns a dispose function to stop it.
 * If the feed is already running, returns the existing dispose.
 */
export function startFeed(provider: FeedProvider, listener?: FeedListener): () => void {
  let feed = activeFeeds.get(provider.id);

  if (!feed) {
    feed = {
      provider,
      state: {
        status: 'connecting',
        lastData: null,
        lastUpdate: 0,
        errorCount: 0,
      },
      timer: null,
      listeners: new Set(),
    };
    activeFeeds.set(provider.id, feed);
    poll(feed);
  }

  if (listener) {
    feed.listeners.add(listener);
  }

  return () => stopFeed(provider.id);
}

/** Stop a specific feed by ID. */
export function stopFeed(id: string): void {
  const feed = activeFeeds.get(id);
  if (!feed) return;

  if (feed.timer !== null) {
    clearTimeout(feed.timer);
  }
  feed.state.status = 'stopped';
  notify(feed);
  activeFeeds.delete(id);
}

/** Get the current state of a feed. */
export function getFeedState(id: string): FeedState | null {
  return activeFeeds.get(id)?.state ?? null;
}

/** Subscribe to feed state changes. Returns unsubscribe function. */
export function subscribeFeed(id: string, listener: FeedListener): () => void {
  const feed = activeFeeds.get(id);
  if (!feed) return () => {};
  feed.listeners.add(listener);
  return () => feed.listeners.delete(listener);
}

// ---------------------------------------------------------------------------
// Internal polling loop
// ---------------------------------------------------------------------------

async function poll(feed: ActiveFeed): Promise<void> {
  const { provider } = feed;

  try {
    const dataset = await provider.fetch();
    // Success — reset error count, update state
    feed.state = {
      status: 'streaming',
      lastData: dataset,
      lastUpdate: Date.now(),
      errorCount: 0,
    };
    notify(feed);

    // Schedule next poll at normal interval
    feed.timer = setTimeout(() => poll(feed), provider.interval);
  } catch (err) {
    feed.state.errorCount++;

    if (feed.state.errorCount >= MAX_FAILURES) {
      // Transition to stale — keep last-good data
      feed.state.status = 'stale';
      notify(feed);
      // Continue polling with exponential backoff
      const backoff = BASE_BACKOFF * Math.pow(2, feed.state.errorCount - MAX_FAILURES);
      feed.timer = setTimeout(() => poll(feed), Math.min(backoff, 60_000));
    } else {
      // Still connecting/retrying
      const prevStatus = feed.state.status;
      feed.state.status = prevStatus === 'streaming' ? 'streaming' : 'connecting';
      notify(feed);
      // Retry with linear backoff
      feed.timer = setTimeout(() => poll(feed), BASE_BACKOFF * feed.state.errorCount);
    }

    console.warn(`[FeedRegistry] ${provider.displayName} fetch failed (${feed.state.errorCount}/${MAX_FAILURES}):`, err);
  }
}

function notify(feed: ActiveFeed): void {
  for (const listener of feed.listeners) {
    try {
      listener(feed.state);
    } catch (e) {
      console.warn('[FeedRegistry] Listener error:', e);
    }
  }
}

// ---------------------------------------------------------------------------
// Testing helpers
// ---------------------------------------------------------------------------

/** Reset all feeds — for testing only. */
export function _resetAllFeeds(): void {
  for (const [id] of activeFeeds) {
    stopFeed(id);
  }
}

/** Transition a feed status directly — for testing state machine. */
export function transitionStatus(
  current: FeedStatus,
  success: boolean,
  errorCount: number,
): FeedStatus {
  if (success) return 'streaming';
  if (errorCount >= MAX_FAILURES) return 'stale';
  if (current === 'streaming') return 'streaming';
  return 'connecting';
}
