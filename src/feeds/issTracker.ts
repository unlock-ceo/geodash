// ---------------------------------------------------------------------------
// ISS Tracker Feed Provider
// ---------------------------------------------------------------------------
// Fetches from http://api.open-notify.org/iss-now.json
// CORS OK — no proxy needed.
// ---------------------------------------------------------------------------

import type { FeedProvider } from './types';
import type { GeoDataset } from '../types/geo';

const ISS_URL = 'http://api.open-notify.org/iss-now.json';

interface ISSResponse {
  message: string;
  timestamp: number;
  iss_position: {
    latitude: string;
    longitude: string;
  };
}

/** Parse ISS API response into a GeoDataset. */
export function parseISSResponse(data: ISSResponse): GeoDataset {
  const lat = parseFloat(data.iss_position.latitude);
  const lng = parseFloat(data.iss_position.longitude);

  return {
    id: 'iss-tracker',
    name: 'ISS Position',
    features: [
      {
        id: 'iss',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {
          name: 'International Space Station',
          timestamp: data.timestamp,
          latitude: lat,
          longitude: lng,
        },
      },
    ],
    crs: 'EPSG:4326',
    bounds: {
      sw: { lng: lng - 1, lat: lat - 1 },
      ne: { lng: lng + 1, lat: lat + 1 },
    },
  };
}

export const issTrackerProvider: FeedProvider = {
  id: 'iss-tracker',
  displayName: 'ISS Tracker',
  interval: 5_000, // 5 seconds — ISS moves fast
  async fetch(): Promise<GeoDataset> {
    const response = await fetch(ISS_URL);
    if (!response.ok) throw new Error(`ISS API HTTP ${response.status}`);
    const data: ISSResponse = await response.json();
    if (data.message !== 'success') throw new Error('ISS API returned non-success');
    return parseISSResponse(data);
  },
};
