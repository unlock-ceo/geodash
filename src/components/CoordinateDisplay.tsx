// ---------------------------------------------------------------------------
// CoordinateDisplay — cursor lat/lon readout
// ---------------------------------------------------------------------------
// Bottom-left corner, monospace text, updates on mousemove via rAF throttle.
// Shows hemisphere letters (N/S/E/W) per cartographic convention.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { getMapInstance } from './Map/GlobeMap';
import { formatCoordinate } from '../geo/geodesic';
import { useDataStore } from '../store/dataStore';

export default function CoordinateDisplay() {
  const [coords, setCoords] = useState<string>('---.----°N ---.----°E');
  const rafRef = useRef(0);
  const activeDatasetId = useDataStore((s) => s.activeDatasetId);
  const datasets = useDataStore((s) => s.datasets);

  // Get CRS from active dataset if one is loaded
  const activeCRS = activeDatasetId ? datasets.get(activeDatasetId)?.crs : null;
  const showCRS = activeCRS || (datasets.size > 0 ? 'EPSG:4326' : null);

  useEffect(() => {
    const map = getMapInstance();
    if (!map) return;

    const onMouseMove = (e: { lngLat: { lng: number; lat: number } }) => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setCoords(formatCoordinate(e.lngLat.lat, e.lngLat.lng));
      });
    };

    const onMouseLeave = () => {
      setCoords('---.----°N ---.----°E');
    };

    map.on('mousemove', onMouseMove);
    map.getCanvas().addEventListener('mouseleave', onMouseLeave);

    return () => {
      cancelAnimationFrame(rafRef.current);
      map.off('mousemove', onMouseMove);
      map.getCanvas().removeEventListener('mouseleave', onMouseLeave);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        zIndex: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 4,
        padding: '4px 8px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <div
        style={{
          fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", monospace',
          fontSize: 12,
          color: 'rgba(255, 255, 255, 0.7)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
        }}
      >
        {coords}
      </div>
      {showCRS && (
        <div
          style={{
            fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", monospace',
            fontSize: 10,
            color: 'rgba(255, 255, 255, 0.35)',
            marginTop: 2,
          }}
        >
          CRS: {showCRS}
        </div>
      )}
    </div>
  );
}
