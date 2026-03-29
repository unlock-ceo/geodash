import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCameraStore } from '../../store/cameraStore';
import { ParticleLayer } from '../../engine/ParticleLayer';

/** Singleton reference so other systems can access the map instance. */
let _mapInstance: maplibregl.Map | null = null;
export function getMapInstance(): maplibregl.Map | null {
  return _mapInstance;
}

/** Singleton reference so the demo orchestrator can access the particle layer. */
let _particleLayer: ParticleLayer | null = null;
export function getParticleLayer(): ParticleLayer | null {
  return _particleLayer;
}

const DARK_BASEMAP = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export default function GlobeMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const setCamera = useCameraStore((s) => s.setCamera);

  useEffect(() => {
    if (!containerRef.current) return;

    const { center, zoom, pitch, bearing } = useCameraStore.getState();

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DARK_BASEMAP,
      center: center as [number, number],
      zoom,
      pitch,
      bearing,
      maplibreLogo: false,
      attributionControl: false,
      renderWorldCopies: false,
      maxPitch: 85,
    });

    mapRef.current = map;
    _mapInstance = map;

    // Create and register the particle custom layer
    const particleLayer = new ParticleLayer('particle-layer');
    _particleLayer = particleLayer;

    map.on('load', () => {
      map.addLayer(particleLayer);

      // Post-processing disabled: the pipeline has three compounding bugs:
      // 1. Ping-pong uses a single buffer — intermediate passes read/write the same texture (UB).
      // 2. Final pass renders with blending OFF, overwriting MapLibre's map tiles.
      // 3. Final pass targets framebuffer null, but MapLibre may use an offscreen FBO.
      // Particles now render via the direct path (additive blending into MapLibre's active FBO).
      // TODO: Redesign post-processing with MapLibre-aware compositing.
    });

    map.on('move', () => {
      const c = map.getCenter();
      setCamera({
        center: [c.lng, c.lat],
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      });
    });

    // Forward resize events to the pipeline so FBO dimensions stay correct
    const onResize = () => {
      const canvas = map.getCanvas();
      particleLayer.getPipeline().resize(
        canvas.width,
        canvas.height,
      );
    };
    map.on('resize', onResize);

    return () => {
      map.off('resize', onResize);
      map.remove();
      mapRef.current = null;
      _mapInstance = null;
      _particleLayer = null;
    };
  }, [setCamera]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100vw',
        height: '100vh',
      }}
    />
  );
}
