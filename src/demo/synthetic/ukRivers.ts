// ---------------------------------------------------------------------------
// Synthetic UK River Network Data
// ---------------------------------------------------------------------------
// Generates particle emitters along major UK river systems.
// Uses simplified waypoints — purely synthetic, not cartographically exact.
// ---------------------------------------------------------------------------

import type { EmitterConfig } from '../../engine/types';
import { lngLatToMercator } from '../../engine/projection';

/** River definition: name and waypoints [lng, lat]. */
interface RiverDef {
  name: string;
  path: [number, number][];
  color: [number, number, number, number];
}

const UK_RIVERS: RiverDef[] = [
  {
    name: 'Thames',
    path: [
      [-2.03, 51.69],   // Source near Cirencester
      [-1.26, 51.75],   // Oxford
      [-0.75, 51.47],   // Reading area
      [-0.49, 51.47],   // Windsor
      [-0.12, 51.51],   // London
      [0.40, 51.45],    // Thames Estuary
    ],
    color: [0.2, 0.6, 0.8, 0.75],
  },
  {
    name: 'Severn',
    path: [
      [-3.52, 52.51],   // Source (Plynlimon)
      [-3.38, 52.52],   // Llanidloes
      [-2.73, 52.71],   // Shrewsbury
      [-2.22, 52.19],   // Worcester
      [-2.47, 51.87],   // Gloucester
      [-2.99, 51.55],   // Bristol Channel
    ],
    color: [0.15, 0.55, 0.75, 0.7],
  },
  {
    name: 'Trent',
    path: [
      [-1.82, 53.04],   // Source (Staffordshire)
      [-1.48, 52.92],   // Near Burton
      [-1.15, 52.95],   // Nottingham area
      [-0.78, 53.47],   // Gainsborough
      [-0.69, 53.69],   // Humber confluence
    ],
    color: [0.25, 0.5, 0.7, 0.65],
  },
  {
    name: 'Tay',
    path: [
      [-4.30, 56.52],   // Source (Ben Lui area)
      [-3.83, 56.59],   // Loch Tay
      [-3.43, 56.43],   // Perth
      [-2.93, 56.45],   // Dundee / Tay estuary
    ],
    color: [0.3, 0.65, 0.85, 0.7],
  },
  {
    name: 'Mersey',
    path: [
      [-2.02, 53.36],   // Source (Stockport area)
      [-2.28, 53.39],   // Manchester area
      [-2.58, 53.38],   // Warrington
      [-2.98, 53.33],   // Liverpool / estuary
    ],
    color: [0.18, 0.52, 0.72, 0.65],
  },
];

/**
 * Generate emitters along all UK rivers.
 */
export function generateUKRiverEmitters(): EmitterConfig[] {
  const emitters: EmitterConfig[] = [];

  for (const river of UK_RIVERS) {
    for (let i = 0; i < river.path.length - 1; i++) {
      const [lng0, lat0] = river.path[i]!;
      const [lng1, lat1] = river.path[i + 1]!;
      const [mx, my, mz] = lngLatToMercator(lng0, lat0, 0);

      // Flow direction
      const [mx1, my1] = lngLatToMercator(lng1, lat1, 0);
      const dx = mx1 - mx;
      const dy = my1 - my;
      const len = Math.sqrt(dx * dx + dy * dy);
      const speed = 0.0000025;
      const vx = len > 0 ? (dx / len) * speed : 0;
      const vy = len > 0 ? (dy / len) * speed : 0;

      emitters.push({
        position: [mx, my, mz],
        rate: 5,
        lifetime: 8,
        color: river.color,
        size: 2.5,
        velocity: [vx, vy, 0],
        spread: 0.15,
      });
    }
  }

  return emitters;
}
