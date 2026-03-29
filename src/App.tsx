import { useEffect, useRef } from 'react';
import GlobeMap from './components/Map/GlobeMap';
import DropZone from './ingestion/DropZone';
import DemoControls from './components/DemoControls';
import CoordinateDisplay from './components/CoordinateDisplay';
import ScaleBar from './components/ScaleBar';
import { DemoOrchestrator } from './demo/DemoOrchestrator';
import './App.css';

/** Global orchestrator instance for DemoControls access. */
let _orchestratorInstance: DemoOrchestrator | null = null;
export function getOrchestrator(): DemoOrchestrator | null {
  return _orchestratorInstance;
}

export default function App() {
  const orchestratorRef = useRef<DemoOrchestrator | null>(null);

  useEffect(() => {
    // Wait briefly for the map + particle layer to initialise, then auto-play
    const timer = setTimeout(() => {
      const orchestrator = new DemoOrchestrator();
      orchestratorRef.current = orchestrator;
      _orchestratorInstance = orchestrator;
      orchestrator.start().catch((err) => {
        console.warn('[GeoDash] Demo failed to start:', err);
      });
    }, 2000);

    return () => {
      clearTimeout(timer);
      orchestratorRef.current?.stop();
      _orchestratorInstance = null;
    };
  }, []);

  return (
    <div id="geodash-root">
      <GlobeMap />
      <DropZone />
      <DemoControls />
      <CoordinateDisplay />
      <ScaleBar />
    </div>
  );
}
