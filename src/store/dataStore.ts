import { create } from 'zustand';
import type { GeoDataset } from '../types/geo';

interface DataState {
  datasets: Map<string, GeoDataset>;
  activeDatasetId: string | null;
  isLoading: boolean;

  addDataset: (ds: GeoDataset) => void;
  removeDataset: (id: string) => void;
  setActiveDataset: (id: string | null) => void;
  setLoading: (v: boolean) => void;
}

export const useDataStore = create<DataState>()((set) => ({
  datasets: new Map(),
  activeDatasetId: null,
  isLoading: false,

  addDataset: (ds) =>
    set((state) => {
      const next = new Map(state.datasets);
      next.set(ds.id, ds);
      return { datasets: next };
    }),

  removeDataset: (id) =>
    set((state) => {
      const next = new Map(state.datasets);
      next.delete(id);
      return {
        datasets: next,
        activeDatasetId: state.activeDatasetId === id ? null : state.activeDatasetId,
      };
    }),

  setActiveDataset: (id) => set({ activeDatasetId: id }),
  setLoading: (v) => set({ isLoading: v }),
}));
