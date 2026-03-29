import { create } from 'zustand';

type DemoPhase = 'idle' | 'playing' | 'paused' | 'complete';

interface DemoState {
  phase: DemoPhase;
  currentAct: number; // 0 = not started, 1-5 = act number
  actProgress: number; // 0-1 progress within current act

  setPhase: (p: DemoPhase) => void;
  setCurrentAct: (act: number) => void;
  setActProgress: (p: number) => void;
  reset: () => void;
}

export const useDemoStore = create<DemoState>()((set) => ({
  phase: 'idle',
  currentAct: 0,
  actProgress: 0,

  setPhase: (p) => set({ phase: p }),
  setCurrentAct: (act) => set({ currentAct: act }),
  setActProgress: (p) => set({ actProgress: p }),
  reset: () => set({ phase: 'idle', currentAct: 0, actProgress: 0 }),
}));
