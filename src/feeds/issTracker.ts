// ---------------------------------------------------------------------------
// ISS Tracker Feed Provider
// ---------------------------------------------------------------------------
// Fetches from https://api.wheretheiss.at/v1/satellites/25544
// HTTPS + CORS OK — works on production deployments without mixed-content issues.
// (Previously used http://api.open-notify.org which is HTTP-only and blocked
// by mixed-content policy on HTTPS-hosted deployments.)
// ---------------------------------------------------------------------------

import type { FeedProvider } from './types';
import type { GeoDataset } from '../types/geo';

const ISS_URL = 'https://api.wheretheiss.at/v1/satellites/25544';

export interface ISSResponse {
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  timestamp: number;
}

/** Parse ISS API response into a GeoDataset. */
export function parseISSResponse(data: ISSResponse): GeoDataset {
  const lat = data.latitude;
  const lng = data.longitude;

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
          altitude: data.altitude,
          velocity: data.velocity,
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
    return parseISSResponse(data);
  },
};
