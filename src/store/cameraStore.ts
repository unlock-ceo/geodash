import { create } from 'zustand';

interface CameraState {
  center: [number, number]; // [lng, lat]
  zoom: number;
  pitch: number;
  bearing: number;
  isAnimating: boolean;
  currentShot: string | null; // name of active cinematic shot

  setCamera: (
    opts: Partial<Pick<CameraState, 'center' | 'zoom' | 'pitch' | 'bearing'>>,
  ) => void;
  setAnimating: (v: boolean) => void;
  setCurrentShot: (name: string | null) => void;
}

export const useCameraStore = create<CameraState>()((set) => ({
  center: [0, 20],
  zoom: 1.8,
  pitch: 0,
  bearing: 0,
  isAnimating: false,
  currentShot: null,

  setCamera: (opts) => set((state) => ({ ...state, ...opts })),
  setAnimating: (v) => set({ isAnimating: v }),
  setCurrentShot: (name) => set({ currentShot: name }),
}));
