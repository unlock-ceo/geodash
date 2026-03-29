// ---------------------------------------------------------------------------
// USGS Earthquake Feed Provider
// ---------------------------------------------------------------------------
// Fetches from https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson
// CORS OK — no proxy needed.
// ---------------------------------------------------------------------------

import type { FeedProvider } from './types';
import type { GeoDataset, GeoFeature, BoundingBox } from '../types/geo';

const USGS_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson';

/** Parse USGS GeoJSON response into a GeoDataset. */
export function parseUSGSResponse(data: {
  features: Array<{
    id?: string;
    geometry: { type: string; coordinates: number[] };
    properties: Record<string, unknown>;
  }>;
}): GeoDataset {
  const features: GeoFeature[] = [];
  let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;

  for (let i = 0; i < data.features.length; i++) {
    const f = data.features[i]!;
    const [lng, lat] = f.geometry.coordinates;

    if (lng! < minLng) minLng = lng!;
    if (lng! > maxLng) maxLng = lng!;
    if (lat! < minLat) minLat = lat!;
    if (lat! > maxLat) maxLat = lat!;

    features.push({
      id: String(f.id ?? i),
      geometry: {
        type: 'Point',
        coordinates: [lng!, lat!, f.geometry.coordinates[2] ?? 0],
      },
      properties: {
        mag: f.properties.mag as number,
        place: f.properties.place as string,
        time: f.properties.time as number,
        type: f.properties.type as string,
      },
    });
  }

  const bounds: BoundingBox = {
    sw: { lng: minLng, lat: minLat },
    ne: { lng: maxLng, lat: maxLat },
  };

  return {
    id: 'usgs-earthquakes',
    name: 'USGS Earthquakes (Past Week)',
    features,
    crs: 'EPSG:4326',
    bounds,
  };
}

export const usgsEarthquakeProvider: FeedProvider = {
  id: 'usgs-earthquakes',
  displayName: 'USGS Earthquakes',
  interval: 300_000, // 5 minutes
  async fetch(): Promise<GeoDataset> {
    const response = await fetch(USGS_URL);
    if (!response.ok) throw new Error(`USGS HTTP ${response.status}`);
    const data = await response.json();
    return parseUSGSResponse(data);
  },
};
