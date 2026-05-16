import { create } from 'zustand';
import type { TransportMode } from '../types/place';
import type { LatLng } from '../utils/geo';

/**
 * 路線預覽 store：把使用者「按下預覽」抓回來的真實 Google Directions 路徑暫存起來。
 * Session-only，重整網頁就清空（Directions API 一次也才幾百毫秒，不值得持久化）。
 *
 * 快取鍵：`${fromItemId}->${toItemId}:${mode}` —— 包含 mode 是因為換交通方式
 * 對應的路線會不同；改了 mode 之後舊的預覽會自動失效，需要再按一次。
 */

export type RouteEntry =
  | { status: 'loading' }
  | { status: 'ready'; path: LatLng[] }
  | { status: 'error'; error: string };

export function routeKey(fromItemId: string, toItemId: string, mode: TransportMode): string {
  return `${fromItemId}->${toItemId}:${mode}`;
}

interface RoutePreviewStore {
  routes: Record<string, RouteEntry>;
  setLoading: (key: string) => void;
  setReady: (key: string, path: LatLng[]) => void;
  setError: (key: string, error: string) => void;
  clear: (key: string) => void;
  clearAll: () => void;
}

export const useRoutePreviewStore = create<RoutePreviewStore>((set) => ({
  routes: {},
  setLoading: (key) =>
    set((s) => ({ routes: { ...s.routes, [key]: { status: 'loading' } } })),
  setReady: (key, path) =>
    set((s) => ({ routes: { ...s.routes, [key]: { status: 'ready', path } } })),
  setError: (key, error) =>
    set((s) => ({ routes: { ...s.routes, [key]: { status: 'error', error } } })),
  clear: (key) =>
    set((s) => {
      const { [key]: _drop, ...rest } = s.routes;
      void _drop;
      return { routes: rest };
    }),
  clearAll: () => set({ routes: {} }),
}));
