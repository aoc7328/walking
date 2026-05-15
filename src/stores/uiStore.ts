import { create } from 'zustand';
import type { CollapseState } from '../types/ui';

const LS_KEY = 'walking.collapse';

const DEFAULT_COLLAPSE: CollapseState = {
  searchBar: false,
  leftPanel: true,
  rightPanel: false,
  dayStrip: false,
};

function loadCollapse(): CollapseState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_COLLAPSE;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_COLLAPSE, ...parsed };
  } catch {
    return DEFAULT_COLLAPSE;
  }
}

function saveCollapse(state: CollapseState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

interface UIStore {
  currentDayId: string | null;
  selectedItemId: string | null;
  detailModalPlaceId: string | null;
  detailModalSource: 'search' | 'itinerary' | null;
  dateModalOpen: boolean;
  collapse: CollapseState;
  setCurrentDay: (dayId: string | null) => void;
  setSelectedItem: (itemId: string | null) => void;
  openDetail: (placeId: string, source: 'search' | 'itinerary') => void;
  closeDetail: () => void;
  openDateModal: () => void;
  closeDateModal: () => void;
  toggleCollapse: (key: keyof CollapseState) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  currentDayId: null,
  selectedItemId: null,
  detailModalPlaceId: null,
  detailModalSource: null,
  dateModalOpen: false,
  collapse: loadCollapse(),
  setCurrentDay: (dayId) => set({ currentDayId: dayId }),
  setSelectedItem: (itemId) => set({ selectedItemId: itemId }),
  openDetail: (placeId, source) =>
    set({ detailModalPlaceId: placeId, detailModalSource: source }),
  closeDetail: () => set({ detailModalPlaceId: null, detailModalSource: null }),
  openDateModal: () => set({ dateModalOpen: true }),
  closeDateModal: () => set({ dateModalOpen: false }),
  toggleCollapse: (key) =>
    set((state) => {
      const next = { ...state.collapse, [key]: !state.collapse[key] };
      saveCollapse(next);
      return { collapse: next };
    }),
}));
