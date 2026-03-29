import { useEffect, useRef } from 'react';
import GlobeMap from './components/Map/GlobeMap';
import DropZone from './ingestion/DropZone';
import { DemoOrchestrator } from './demo/DemoOrchestrator';
import './App.css';

export default function App() {
  const orchestratorRef = useRef<DemoOrchestrator | null>(null);

  useEffect(() => {
    // Wait briefly for the map + particle layer to initialise, then auto-play
    const timer = setTimeout(() => {
      const orchestrator = new DemoOrchestrator();
      orchestratorRef.current = orchestrator;
      orchestrator.start().catch((err) => {
        console.warn('[GeoDash] Demo failed to start:', err);
      });
    }, 2000);

    return () => {
      clearTimeout(timer);
      orchestratorRef.current?.stop();
    };
  }, []);

  return (
    <div id="geodash-root">
      <GlobeMap />
      <DropZone />
    </div>
  );
}
