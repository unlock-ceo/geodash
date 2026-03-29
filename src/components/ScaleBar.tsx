// ---------------------------------------------------------------------------
// ScaleBar — dynamic scale bar corrected for latitude
// ---------------------------------------------------------------------------
// Bottom-left, stacked above CoordinateDisplay. Updates on zoom change.
// Bar length auto-adjusts to show round numbers (100m, 1km, 5km, etc.).
// Latitude-corrected for Mercator distortion.
// ---------------------------------------------------------------------------

import { useEffect, useState, useCallback } from 'react';
import { getMapInstance } from './Map/GlobeMap';
import { metersPerPixelAtLatZoom, roundScaleDistance } from '../geo/geodesic';

const MAX_BAR_WIDTH = 120; // Max bar width in pixels

export default function ScaleBar() {
  const [barWidth, setBarWidth] = useState(60);
  const [label, setLabel] = useState('');

  const updateScale = useCallback(() => {
    const map = getMapInstance();
    if (!map) return;

    const center = map.getCenter();
    const zoom = map.getZoom();

    const mpp = metersPerPixelAtLatZoom(center.lat, zoom);
    const [roundMeters, roundLabel] = roundScaleDistance(mpp, MAX_BAR_WIDTH);

    const barPx = roundMeters / mpp;
    setBarWidth(Math.max(20, Math.min(MAX_BAR_WIDTH, barPx)));
    setLabel(roundLabel);
  }, []);

  useEffect(() => {
    const map = getMapInstance();
    if (!map) return;

    // Initial calculation
    updateScale();

    map.on('zoom', updateScale);
    map.on('move', updateScale);

    return () => {
      map.off('zoom', updateScale);
      map.off('move', updateScale);
    };
  }, [updateScale]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 52,
        left: 16,
        zIndex: 10,
      }}
    >
      {/* Scale bar line with end ticks */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          height: 10,
        }}
      >
        {/* Left tick */}
        <div style={{
          width: 1,
          height: 8,
          backgroundColor: 'rgba(255, 255, 255, 0.6)',
        }} />
        {/* Bar */}
        <div style={{
          width: barWidth,
          height: 2,
          backgroundColor: 'rgba(255, 255, 255, 0.6)',
          transition: 'width 200ms ease-out',
        }} />
        {/* Right tick */}
        <div style={{
          width: 1,
          height: 8,
          backgroundColor: 'rgba(255, 255, 255, 0.6)',
        }} />
      </div>
      {/* Label */}
      <div style={{
        fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", monospace',
        fontSize: 10,
        color: 'rgba(255, 255, 255, 0.5)',
        marginTop: 2,
      }}>
        {label}
      </div>
    </div>
  );
}
