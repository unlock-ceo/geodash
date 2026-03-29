import type { Geometry } from 'geojson';

export interface LngLat {
  lng: number;
  lat: number;
}

export interface BoundingBox {
  sw: LngLat;
  ne: LngLat;
}

export interface GeoFeature {
  id: string;
  geometry: Geometry;
  properties: Record<string, unknown>;
}

export type CRS = 'EPSG:4326' | 'EPSG:3857' | (string & {});

export interface GeoDataset {
  id: string;
  name: string;
  features: GeoFeature[];
  crs: CRS;
  bounds: BoundingBox;
  temporalField?: string;
  temporalRange?: [Date, Date];
}
