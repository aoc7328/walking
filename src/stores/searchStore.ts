import { create } from 'zustand';
import type { Place } from '../types/place';

interface SearchStore {
  query: string;
  results: Place[];
  isLoading: boolean;
  error: string | null;
  setQuery: (query: string) => void;
  setResults: (results: Place[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useSearchStore = create<SearchStore>((set) => ({
  query: '',
  results: [],
  isLoading: false,
  error: null,
  setQuery: (query) => set({ query }),
  setResults: (results) => set({ results }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clear: () => set({ query: '', results: [], error: null }),
}));
