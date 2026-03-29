// ---------------------------------------------------------------------------
// DropZone — full-window drag-and-drop overlay for file ingestion
// ---------------------------------------------------------------------------
// Invisible by default. Appears on browser dragenter, hides on dragleave
// or successful drop. Calls ingestFile() and renders features as particles.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import { ingestFile } from './parsers';
import type { ParseResult } from './types';
import { useDataStore } from '../store/dataStore';
import { getMapInstance, getParticleLayer } from '../components/Map/GlobeMap';
import { lngLatToMercator } from '../engine/projection';
import type { GeoFeature } from '../types/geo';

type DropState = 'hidden' | 'active' | 'hover' | 'parsing';

interface Toast {
  message: string;
  type: 'success' | 'warning' | 'error';
  id: number;
}

let toastId = 0;

export default function DropZone() {
  const [state, setState] = useState<DropState>('hidden');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dragCounter = useRef(0);

  const addToast = useCallback((message: string, type: Toast['type'], duration = 3000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { message, type, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const renderFeaturesAsParticles = useCallback((features: GeoFeature[]) => {
    const layer = getParticleLayer();
    if (!layer) return;

    const ps = layer.getParticleSystem();
    const points: { lng: number; lat: number }[] = [];

    for (const f of features) {
      if (f.geometry.type === 'Point') {
        const [lng, lat] = f.geometry.coordinates;
        points.push({ lng: lng!, lat: lat! });
      } else if (f.geometry.type === 'MultiPoint') {
        for (const coord of f.geometry.coordinates) {
          points.push({ lng: coord[0]!, lat: coord[1]! });
        }
      } else if (f.geometry.type === 'LineString') {
        for (const coord of f.geometry.coordinates) {
          points.push({ lng: coord[0]!, lat: coord[1]! });
        }
      } else if (f.geometry.type === 'Polygon') {
        for (const ring of f.geometry.coordinates) {
          for (const coord of ring) {
            points.push({ lng: coord[0]!, lat: coord[1]! });
          }
        }
      }
    }

    if (points.length === 0) return;

    const count = points.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 4);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const p = points[i]!;
      const [mx, my, mz] = lngLatToMercator(p.lng, p.lat, 0);
      positions[i * 3] = mx;
      positions[i * 3 + 1] = my;
      positions[i * 3 + 2] = mz;

      // Cyan accent color
      colors[i * 4] = 0.31;
      colors[i * 4 + 1] = 0.76;
      colors[i * 4 + 2] = 0.97;
      colors[i * 4 + 3] = 0.85;

      sizes[i] = 4.0;
    }

    ps.setParticles(positions, colors, sizes);
  }, []);

  const flyToBounds = useCallback((sw: { lng: number; lat: number }, ne: { lng: number; lat: number }) => {
    const map = getMapInstance();
    if (!map) return;
    map.fitBounds(
      [[sw.lng, sw.lat], [ne.lng, ne.lat]],
      { padding: 60, duration: 1500, maxZoom: 14 },
    );
  }, []);

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;

    const file = e.dataTransfer?.files[0];
    if (!file) {
      setState('hidden');
      return;
    }

    setState('parsing');

    const result: ParseResult = await ingestFile(file);

    switch (result.status) {
      case 'complete':
        useDataStore.getState().addDataset(result.dataset);
        renderFeaturesAsParticles(result.dataset.features);
        flyToBounds(result.dataset.bounds.sw, result.dataset.bounds.ne);
        addToast(
          `Loaded ${result.dataset.features.length.toLocaleString()} features from ${file.name}`,
          'success',
        );
        break;
      case 'partial':
        useDataStore.getState().addDataset(result.dataset);
        renderFeaturesAsParticles(result.dataset.features);
        flyToBounds(result.dataset.bounds.sw, result.dataset.bounds.ne);
        addToast(
          `Loaded ${result.dataset.features.length.toLocaleString()} features — ${result.warnings.length} rows skipped`,
          'warning',
          5000,
        );
        break;
      case 'empty':
        addToast(result.reason, 'error');
        break;
    }

    setState('hidden');
  }, [addToast, renderFeaturesAsParticles, flyToBounds]);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) {
      setState('active');
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (state === 'active') {
      setState('hover');
    }
  }, [state]);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setState('hidden');
    }
  }, []);

  useEffect(() => {
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [handleDragEnter, handleDragOver, handleDragLeave, handleDrop]);

  return (
    <>
      {/* Drop overlay */}
      {state !== 'hidden' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            transition: 'opacity 200ms ease-out',
            opacity: 1,
          }}
        >
          <div
            style={{
              border: `2px dashed ${state === 'hover' ? 'rgba(147, 197, 253, 0.8)' : 'rgba(255, 255, 255, 0.3)'}`,
              borderRadius: 16,
              padding: '48px 64px',
              textAlign: 'center',
              transition: 'border-color 200ms ease-out',
            }}
          >
            {state === 'parsing' ? (
              <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 18, fontWeight: 300, letterSpacing: '0.05em' }}>
                Parsing...
              </div>
            ) : (
              <>
                {/* Upload icon */}
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.5)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ margin: '0 auto 16px' }}
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 18, fontWeight: 300, letterSpacing: '0.05em' }}>
                  {state === 'hover' ? 'Release to load' : 'Drop GeoJSON or CSV'}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Toast notifications */}
      <div
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 60,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              padding: '10px 16px',
              borderRadius: 6,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(12px)',
              border: `1px solid ${
                toast.type === 'success'
                  ? 'rgba(102, 187, 106, 0.4)'
                  : toast.type === 'warning'
                    ? 'rgba(255, 183, 77, 0.4)'
                    : 'rgba(239, 83, 80, 0.4)'
              }`,
              color: toast.type === 'success'
                ? '#66BB6A'
                : toast.type === 'warning'
                  ? '#FFB74D'
                  : '#EF5350',
              fontSize: 13,
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              maxWidth: 360,
              animation: 'fadeIn 200ms ease-out',
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </>
  );
}
