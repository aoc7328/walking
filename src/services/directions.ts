import type { TransportMode } from '../types/place';
import { loadGoogleMaps, hasApiKey } from './googleMaps';
import type { LatLng } from '../utils/geo';

interface LegResult {
  durationMinutes: number;
  distanceMeters: number;
}

// 成功「和失敗」都要記。
// 失敗也記的原因：Google 對某些 leg 永遠算不出路線（最常見的是偏遠地區選「大眾運輸」），
// 每次回 null。而呼叫端（RightPanel）是「這天還有 leg 沒時間就重抓」，
// 只要不記住失敗，行程每動一次就會再打一次 Directions——在備註欄打字是逐字寫進 store 的，
// 等於打一個字送一次請求。負快取把「問過、Google 說沒有」也算數。
// 快取只存在記憶體，重新整理頁面就會再試一次，所以暫時性的網路失敗不會被永久記住。
const cache = new Map<string, LegResult | null>();
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
  // 大眾運輸一律不問 Google。
  // 原因：紐西蘭、北海道這類地區 Google 根本沒有大眾運輸資料，每次都回「算不出來」——
  // 但查不到一樣計費，而且算得出來的那些準不準也無從驗證。
  // 想查大眾運輸就按預覽鈕，那顆會直接開 Google Maps（見 LegConnector）。
  // 時間可以自己填（setLegDuration），填了就會納入當天的時間鏈。
  if (mode === 'transit') return null;
  const key = cacheKey(origin, destination, mode);
  if (cache.has(key)) return cache.get(key) ?? null;
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
      if (!leg || !leg.duration) {
        cache.set(key, null);
        return null;
      }
      const value: LegResult = {
        durationMinutes: Math.max(1, Math.round(leg.duration.value / 60)),
        distanceMeters: leg.distance?.value ?? 0,
      };
      cache.set(key, value);
      return value;
    } catch (err) {
      console.warn('[walking] fetchLegDuration 失敗：', err);
      cache.set(key, null);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, promise);
  return promise;
}

// 預覽路線的「路徑幾何」快取。
// 鍵是「起點座標 + 終點座標 + 交通方式」，不是行程卡片的 id——
// 所以調整過行程卡片、順序又變回同樣兩個點時，按下去是直接從記憶體拿，不會再打一次 API。
// 只記成功的：失敗不記，按鈕上的「點擊重試」才有意義。
// 跟上面的 cache 分開放，因為存的東西不一樣（那個是時間/距離，這個是整條路徑）。
const pathCache = new Map<string, LatLng[]>();
const pathInflight = new Map<string, Promise<LatLng[]>>();

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
  // 大眾運輸不走這條（UI 會直接給 Google Maps 連結）。這裡只是防呆。
  if (mode === 'transit') throw new Error('大眾運輸請用 Google Maps 查看');

  const key = cacheKey(origin, destination, mode);
  const cached = pathCache.get(key);
  if (cached) return cached;
  const pending = pathInflight.get(key);
  if (pending) return pending;

  const promise = fetchDirectionsPathUncached(origin, destination, mode);
  pathInflight.set(key, promise);
  try {
    const path = await promise;
    pathCache.set(key, path);
    return path;
  } finally {
    pathInflight.delete(key);
  }
}

async function fetchDirectionsPathUncached(
  origin: LatLng,
  destination: LatLng,
  mode: TransportMode,
): Promise<LatLng[]> {
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
