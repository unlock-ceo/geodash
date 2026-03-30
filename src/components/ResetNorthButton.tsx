// ---------------------------------------------------------------------------
// ResetNorthButton — compass button to reset map bearing to north
// ---------------------------------------------------------------------------
// Top-right corner. Visible only when map is rotated (bearing !== 0).
// SVG compass needle rotates to always point true north. On click,
// smoothly animates bearing back to 0 via MapLibre easeTo.
// ---------------------------------------------------------------------------

import { useCameraStore } from '../store/cameraStore';
import { getMapInstance } from './Map/GlobeMap';

export default function ResetNorthButton() {
  const bearing = useCameraStore((s) => s.bearing);
  const isVisible = Math.abs(bearing) > 0.5;

  const handleClick = () => {
    const map = getMapInstance();
    if (!map) return;
    map.easeTo({ bearing: 0, duration: 500 });
  };

  return (
    <button
      onClick={handleClick}
      aria-label="Reset to north"
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 10,
        width: 36,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: 6,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        cursor: 'pointer',
        padding: 0,
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
        transition: 'opacity 300ms ease',
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        style={{
          transform: `rotate(${-bearing}deg)`,
          transition: 'transform 200ms ease-out',
        }}
      >
        {/* North half — bright */}
        <polygon
          points="10,2 13,11 10,9 7,11"
          fill="rgba(255, 100, 100, 0.9)"
        />
        {/* South half — dim */}
        <polygon
          points="10,18 13,11 10,13 7,11"
          fill="rgba(255, 255, 255, 0.3)"
        />
      </svg>
    </button>
  );
}
