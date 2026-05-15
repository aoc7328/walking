import { create } from 'zustand';
import type { Place } from '../types/place';

const HISTORY_KEY = 'walking.searchHistory';
const HISTORY_MAX = 5;

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string').slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // ignore
  }
}

interface SearchStore {
  query: string;
  results: Place[];
  isLoading: boolean;
  error: string | null;
  history: string[];
  setQuery: (query: string) => void;
  setResults: (results: Place[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
  recordSearch: (query: string) => void;
  removeFromHistory: (query: string) => void;
  clearHistory: () => void;
}

export const useSearchStore = create<SearchStore>((set) => ({
  query: '',
  results: [],
  isLoading: false,
  error: null,
  history: loadHistory(),
  setQuery: (query) => set({ query }),
  setResults: (results) => set({ results }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clear: () => set({ query: '', results: [], error: null }),
  recordSearch: (query) =>
    set((state) => {
      const q = query.trim();
      if (!q) return {};
      const filtered = state.history.filter((h) => h !== q);
      const next = [q, ...filtered].slice(0, HISTORY_MAX);
      saveHistory(next);
      return { history: next };
    }),
  removeFromHistory: (query) =>
    set((state) => {
      const next = state.history.filter((h) => h !== query);
      saveHistory(next);
      return { history: next };
    }),
  clearHistory: () =>
    set(() => {
      saveHistory([]);
      return { history: [] };
    }),
}));
