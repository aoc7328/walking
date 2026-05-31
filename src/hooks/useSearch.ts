import { useCallback } from 'react';
import { useSearchStore } from '../stores/searchStore';
import {
  detectGoogleMapsLink,
  hasApiKey,
  resolveGoogleMapsLink,
  textSearch,
} from '../services/googleMaps';
import type { Place } from '../types/place';
import { uuid } from '../utils/format';

/**
 * 把輸入字串嘗試解析成經緯度座標。
 * 接受：「-45.123, 168.456」「-45.123 168.456」「lat,lng」等。
 * 緯度 -90~90、經度 -180~180 才算有效。失敗回 null。
 */
export function parseLatLng(input: string): { lat: number; lng: number } | null {
  const m = input
    .trim()
    .match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = parseFloat(m[1]!);
  const lng = parseFloat(m[2]!);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function useSearch() {
  const setResults = useSearchStore((s) => s.setResults);
  const setLoading = useSearchStore((s) => s.setLoading);
  const setError = useSearchStore((s) => s.setError);
  const recordSearch = useSearchStore((s) => s.recordSearch);

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
        if (results.length > 0) recordSearch(query);
      } catch (err) {
        setError(err instanceof Error ? err.message : '搜尋失敗');
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [setResults, setLoading, setError, recordSearch],
  );

  /**
   * 用手動座標建立一個地點並顯示成搜尋結果（給 Places 搜不到的冷門地點用）。
   * 名稱由使用者輸入（prompt）。placeId 用 manual- 前綴，不是真的 Google placeId，
   * 但有座標就能畫地圖、能導航。
   */
  const addByCoordinates = useCallback(
    (lat: number, lng: number) => {
      const name = window.prompt(
        '幫這個座標取一個地點名稱',
        '',
      );
      if (name === null) return; // 使用者取消
      const trimmed = name.trim();
      const place: Place = {
        id: uuid(),
        placeId: `manual-${uuid()}`,
        name: trimmed || `自訂地點 (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
        address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        coordinates: { lat, lng },
        types: [],
      };
      setError(null);
      setResults([place]);
    },
    [setResults, setError],
  );

  return { runSearch, addByCoordinates };
}
