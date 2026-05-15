import { useCallback } from 'react';
import { useSearchStore } from '../stores/searchStore';
import {
  detectGoogleMapsLink,
  hasApiKey,
  resolveGoogleMapsLink,
  textSearch,
} from '../services/googleMaps';

export function useSearch() {
  const setResults = useSearchStore((s) => s.setResults);
  const setLoading = useSearchStore((s) => s.setLoading);
  const setError = useSearchStore((s) => s.setError);

  const runSearch = useCallback(
    async (query: string, biasCity?: string) => {
      setError(null);
      if (!query) {
        setResults([]);
        return;
      }
      if (!hasApiKey()) {
        setError('尚未設定 Google Maps API Key（.env.local）');
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const link = detectGoogleMapsLink(query);
        const results = link ? await resolveGoogleMapsLink(link) : await textSearch(query, biasCity);
        setResults(results);
      } catch (err) {
        setError(err instanceof Error ? err.message : '搜尋失敗');
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [setResults, setLoading, setError],
  );

  return { runSearch };
}
