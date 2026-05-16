import type { TransportMode } from '../types/place';
import { loadGoogleMaps, hasApiKey } from './googleMaps';
import type { LatLng } from '../utils/geo';

interface LegResult {
  durationMinutes: number;
  distanceMeters: number;
}

const cache = new Map<string, LegResult>();
const inflight = new Map<string, Promise<LegResult | null>>();

function cacheKey(o: LatLng, d: LatLng, mode: TransportMode): string {
  return `${o.lat.toFixed(5)},${o.lng.toFixed(5)}|${d.lat.toFixed(5)},${d.lng.toFixed(5)}|${mode}`;
}

function getTravelMode(mode: TransportMode): google.maps.TravelMode {
  switch (mode) {
    case 'driving':
      return google.maps.TravelMode.DRIVING;
    case 'walking':
      return google.maps.TravelMode.WALKING;
    case 'transit':
      return google.maps.TravelMode.TRANSIT;
    case 'bicycling':
      return google.maps.TravelMode.BICYCLING;
  }
}

let service: google.maps.DirectionsService | null = null;
function getService(): google.maps.DirectionsService {
  if (!service) service = new google.maps.DirectionsService();
  return service;
}

export async function fetchLegDuration(
  origin: LatLng,
  destination: LatLng,
  mode: TransportMode,
): Promise<LegResult | null> {
  if (!hasApiKey()) return null;
  const key = cacheKey(origin, destination, mode);
  if (cache.has(key)) return cache.get(key)!;
  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async (): Promise<LegResult | null> => {
    try {
      await loadGoogleMaps();
      const svc = getService();
      const result = await svc.route({
        origin,
        destination,
        travelMode: getTravelMode(mode),
      });
      const leg = result.routes[0]?.legs[0];
      if (!leg || !leg.duration) return null;
      const value: LegResult = {
        durationMinutes: Math.max(1, Math.round(leg.duration.value / 60)),
        distanceMeters: leg.distance?.value ?? 0,
      };
      cache.set(key, value);
      return value;
    } catch (err) {
      console.warn('[walking] fetchLegDuration 失敗：', err);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, promise);
  return promise;
}

/**
 * 取得「實際路線幾何」用來在地圖上畫真實的路徑（不是直線）。
 * 給「預覽路線」按鈕用。
 *
 * 用 overview_path（每條 route 都有，已抽稀），畫起來夠用且輕量。
 * fallback 才走 step.path。
 */
export async function fetchDirectionsPath(
  origin: LatLng,
  destination: LatLng,
  mode: TransportMode,
): Promise<LatLng[]> {
  if (!hasApiKey()) throw new Error('未設定 Google Maps API Key');
  await loadGoogleMaps();
  const svc = getService();

  const result = await svc.route({
    origin,
    destination,
    travelMode: getTravelMode(mode),
  });
  const route = result.routes[0];
  if (!route) throw new Error('找不到路線');

  if (route.overview_path && route.overview_path.length > 0) {
    return route.overview_path.map((p) => ({ lat: p.lat(), lng: p.lng() }));
  }
  // Fallback
  const path: LatLng[] = [];
  for (const leg of route.legs ?? []) {
    for (const step of leg.steps ?? []) {
      for (const p of step.path ?? []) {
        path.push({ lat: p.lat(), lng: p.lng() });
      }
    }
  }
  if (path.length === 0) throw new Error('路線資料為空');
  return path;
}
