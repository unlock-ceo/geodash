// ---------------------------------------------------------------------------
// DemoControls — play/pause/skip overlay for demo playback
// ---------------------------------------------------------------------------
// Bottom-center frosted glass pill. Shows act indicator dots, play/pause
// toggle, skip button, and progress bar. Fades to 30% opacity after 3s
// idle, fully visible on hover.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDemoStore } from '../store/demoStore';
import { getOrchestrator } from '../App';

const ACT_COUNT = 5;

export default function DemoControls() {
  const phase = useDemoStore((s) => s.phase);
  const currentAct = useDemoStore((s) => s.currentAct);
  const actProgress = useDemoStore((s) => s.actProgress);
  const [isHovered, setIsHovered] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Reset idle timer on any interaction
  const resetIdle = useCallback(() => {
    setIsIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setIsIdle(true), 3000);
  }, []);

  useEffect(() => {
    if (phase === 'playing') {
      resetIdle();
    }
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [phase, resetIdle]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const orchestrator = getOrchestrator();
      if (!orchestrator) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (phase === 'playing') {
          orchestrator.stop();
          useDemoStore.getState().setPhase('paused');
        } else if (phase === 'paused') {
          // Resume — not fully implemented (would need scene state preservation)
          // For now, restart from current act
          const actIdx = orchestrator.getCurrentActIdx();
          orchestrator.skipToAct(actIdx + 1);
        }
        resetIdle();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        orchestrator.skipNext();
        resetIdle();
      } else if (e.code === 'Escape') {
        orchestrator.stop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, resetIdle]);

  const handlePlayPause = useCallback(() => {
    const orchestrator = getOrchestrator();
    if (!orchestrator) return;

    if (phase === 'playing') {
      orchestrator.stop();
      useDemoStore.getState().setPhase('paused');
    } else {
      const actIdx = orchestrator.getCurrentActIdx();
      orchestrator.skipToAct(actIdx + 1);
    }
    resetIdle();
  }, [phase, resetIdle]);

  const handleSkip = useCallback(() => {
    const orchestrator = getOrchestrator();
    if (!orchestrator) return;
    orchestrator.skipNext();
    resetIdle();
  }, [resetIdle]);

  // Only show during demo playback or when paused
  if (phase !== 'playing' && phase !== 'paused') {
    // Show end message when complete
    if (phase === 'complete') {
      return (
        <div
          style={{
            position: 'fixed',
            bottom: 48,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(12px)',
            borderRadius: 20,
            padding: '10px 20px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: 13,
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            letterSpacing: '0.03em',
          }}
        >
          Explore the globe or drop a dataset
        </div>
      );
    }
    return null;
  }

  const opacity = isIdle && !isHovered ? 0.3 : 1;

  return (
    <div
      onMouseEnter={() => { setIsHovered(true); resetIdle(); }}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={resetIdle}
      style={{
        position: 'fixed',
        bottom: 48,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(12px)',
        borderRadius: 9999,
        padding: '8px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        border: '1px solid rgba(255, 255, 255, 0.06)',
        opacity,
        transition: 'opacity 500ms ease-in-out',
        userSelect: 'none',
      }}
    >
      {/* Play/Pause button */}
      <button
        onClick={handlePlayPause}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: '50%',
          color: 'rgba(255, 255, 255, 0.8)',
        }}
        title={phase === 'playing' ? 'Pause (Space)' : 'Play (Space)'}
      >
        {phase === 'playing' ? (
          // Pause icon
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          // Play icon
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6,4 20,12 6,20" />
          </svg>
        )}
      </button>

      {/* Act indicator dots */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {Array.from({ length: ACT_COUNT }, (_, i) => (
          <div
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor:
                i + 1 === currentAct
                  ? '#4FC3F7'
                  : i + 1 < currentAct
                    ? 'rgba(255, 255, 255, 0.6)'
                    : 'rgba(255, 255, 255, 0.2)',
              transition: 'background-color 300ms ease-out',
            }}
          />
        ))}
      </div>

      {/* Skip button */}
      <button
        onClick={handleSkip}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: '50%',
          color: 'rgba(255, 255, 255, 0.8)',
        }}
        title="Skip (→)"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="4,4 14,12 4,20" />
          <rect x="16" y="4" width="3" height="16" rx="1" />
        </svg>
      </button>

      {/* Progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 20,
          right: 20,
          height: 2,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${actProgress * 100}%`,
            height: '100%',
            backgroundColor: '#4FC3F7',
            borderRadius: 1,
            transition: 'width 100ms linear',
          }}
        />
      </div>
    </div>
  );
}
