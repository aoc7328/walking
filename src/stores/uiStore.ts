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
  /**
   * 從行程卡片開詳情時，精確指到那一天的那一個 item。
   * 同一個地點（飯店、機場）會出現在很多天；只靠 placeId 去掃，永遠撈到第一次出現的那份，
   * 「✓ 已在 Day N」顯示錯天、「從行程移除」刪錯天，都是這個原因。
   */
  detailModalItemRef: { dayId: string; itemId: string } | null;
  dateModalOpen: boolean;
  newTripModalOpen: boolean;
  tripSwitcherOpen: boolean;
  shareModalOpen: boolean;
  overviewModalOpen: boolean;
  downloadModalOpen: boolean;
  ledgerModalOpen: boolean;
  notesModalOpen: boolean;
  collapse: CollapseState;
  setCurrentDay: (dayId: string | null) => void;
  setSelectedItem: (itemId: string | null) => void;
  openDetail: (placeId: string, source: 'search' | 'itinerary', itemRef?: { dayId: string; itemId: string }) => void;
  closeDetail: () => void;
  openDateModal: () => void;
  closeDateModal: () => void;
  openNewTripModal: () => void;
  closeNewTripModal: () => void;
  toggleTripSwitcher: () => void;
  closeTripSwitcher: () => void;
  openShareModal: () => void;
  closeShareModal: () => void;
  openOverviewModal: () => void;
  closeOverviewModal: () => void;
  openDownloadModal: () => void;
  closeDownloadModal: () => void;
  openLedgerModal: () => void;
  closeLedgerModal: () => void;
  openNotesModal: () => void;
  closeNotesModal: () => void;
  toggleCollapse: (key: keyof CollapseState) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  currentDayId: null,
  selectedItemId: null,
  detailModalPlaceId: null,
  detailModalSource: null,
  detailModalItemRef: null,
  dateModalOpen: false,
  newTripModalOpen: false,
  tripSwitcherOpen: false,
  shareModalOpen: false,
  overviewModalOpen: false,
  downloadModalOpen: false,
  ledgerModalOpen: false,
  notesModalOpen: false,
  collapse: loadCollapse(),
  setCurrentDay: (dayId) => set({ currentDayId: dayId }),
  setSelectedItem: (itemId) => set({ selectedItemId: itemId }),
  openDetail: (placeId, source, itemRef) =>
    set({ detailModalPlaceId: placeId, detailModalSource: source, detailModalItemRef: itemRef ?? null }),
  closeDetail: () => set({ detailModalPlaceId: null, detailModalSource: null, detailModalItemRef: null }),
  openDateModal: () => set({ dateModalOpen: true }),
  closeDateModal: () => set({ dateModalOpen: false }),
  openNewTripModal: () => set({ newTripModalOpen: true, tripSwitcherOpen: false }),
  closeNewTripModal: () => set({ newTripModalOpen: false }),
  toggleTripSwitcher: () => set((state) => ({ tripSwitcherOpen: !state.tripSwitcherOpen })),
  closeTripSwitcher: () => set({ tripSwitcherOpen: false }),
  openShareModal: () => set({ shareModalOpen: true }),
  closeShareModal: () => set({ shareModalOpen: false }),
  openOverviewModal: () => set({ overviewModalOpen: true }),
  closeOverviewModal: () => set({ overviewModalOpen: false }),
  openDownloadModal: () => set({ downloadModalOpen: true }),
  closeDownloadModal: () => set({ downloadModalOpen: false }),
  openLedgerModal: () => set({ ledgerModalOpen: true }),
  closeLedgerModal: () => set({ ledgerModalOpen: false }),
  openNotesModal: () => set({ notesModalOpen: true }),
  closeNotesModal: () => set({ notesModalOpen: false }),
  toggleCollapse: (key) =>
    set((state) => {
      const next = { ...state.collapse, [key]: !state.collapse[key] };
      saveCollapse(next);
      return { collapse: next };
    }),
}));
