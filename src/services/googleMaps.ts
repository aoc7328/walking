import type { Place, PlaceReview } from '../types/place';
import { uuid } from '../utils/format';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export function hasApiKey(): boolean {
  return Boolean(API_KEY && API_KEY !== 'your_api_key_here');
}

let waitingPromise: Promise<void> | null = null;

/**
 * 等待 Google Maps + Places 載入完成。
 * 腳本由 @vis.gl/react-google-maps 的 APIProvider 載入（含 places、marker 套件），
 * 這裡只負責等 `google.maps.places.Place` 類別出現。
 */
export function loadGoogleMaps(): Promise<void> {
  // 已經備好
  const ready = (): boolean =>
    typeof google !== 'undefined' &&
    Boolean(google.maps) &&
    Boolean((google.maps as any).places) &&
    Boolean((google.maps as any).places.Place);
  if (ready()) return Promise.resolve();
  if (waitingPromise) return waitingPromise;
  waitingPromise = new Promise<void>((resolve, reject) => {
    const STEP = 100;
    const TIMEOUT = 15000;
    let elapsed = 0;
    const id = window.setInterval(() => {
      if (ready()) {
        window.clearInterval(id);
        resolve();
      } else if ((elapsed += STEP) >= TIMEOUT) {
        window.clearInterval(id);
        waitingPromise = null;
        reject(new Error('Google Maps 載入逾時，請確認 API Key 或網路狀況'));
      }
    }, STEP);
  });
  return waitingPromise;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

interface PlaceLite {
  id?: string | null;
  displayName?: string | null;
  formattedAddress?: string | null;
  location?: { lat: () => number; lng: () => number } | null;
  rating?: number | null;
  userRatingCount?: number | null;
  types?: string[] | null;
  photos?: Array<{ getURI?: (o?: any) => string; getUrl?: (o?: any) => string }> | null;
  priceLevel?: number | string | null;
  nationalPhoneNumber?: string | null;
  websiteURI?: string | null;
  regularOpeningHours?: { weekdayDescriptions?: string[] } | null;
  reviews?: Array<{
    authorAttribution?: { displayName?: string };
    rating?: number | null;
    text?: string | null;
    publishTime?: Date | null;
  }> | null;
}

function getPhotoUrls(photos: PlaceLite['photos']): string[] | undefined {
  if (!photos || photos.length === 0) return undefined;
  const urls: string[] = [];
  for (const photo of photos.slice(0, 6)) {
    try {
      const url =
        typeof photo.getURI === 'function'
          ? photo.getURI({ maxWidth: 800 })
          : typeof photo.getUrl === 'function'
            ? photo.getUrl({ maxWidth: 800 })
            : '';
      if (url) urls.push(url);
    } catch {
      // ignore
    }
  }
  return urls.length > 0 ? urls : undefined;
}

function placeToInternal(p: PlaceLite): Place | null {
  const id = p.id;
  const name = p.displayName;
  const loc = p.location;
  if (!id || !name || !loc) return null;
  let lat: number, lng: number;
  try {
    lat = typeof loc.lat === 'function' ? loc.lat() : Number((loc as any).lat);
    lng = typeof loc.lng === 'function' ? loc.lng() : Number((loc as any).lng);
  } catch {
    return null;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: uuid(),
    placeId: id,
    name,
    address: p.formattedAddress ?? '',
    coordinates: { lat, lng },
    rating: typeof p.rating === 'number' ? p.rating : undefined,
    reviewCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : undefined,
    types: p.types ?? [],
    photoUrls: getPhotoUrls(p.photos),
    priceLevel: typeof p.priceLevel === 'number' ? p.priceLevel : undefined,
  };
}

const PLACE_LIST_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'rating',
  'userRatingCount',
  'types',
  'photos',
  'priceLevel',
];

const PLACE_DETAIL_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'rating',
  'userRatingCount',
  'types',
  'photos',
  'nationalPhoneNumber',
  'websiteURI',
  'regularOpeningHours',
  'priceLevel',
  'reviews',
];

export async function textSearch(
  query: string,
  bias?: { lat: number; lng: number },
): Promise<Place[]> {
  if (!hasApiKey()) return [];
  await loadGoogleMaps();
  const PlaceCls = (google.maps as any).places.Place;
  const req: Record<string, unknown> = {
    textQuery: query,
    fields: PLACE_LIST_FIELDS,
    language: 'zh-TW',
    maxResultCount: 20,
  };
  // 軟性地理偏好：把目前行程區域附近的結果往前排，但「不」排除其他地方的結果。
  // 刻意不再寫死 region:'TW'、也不把城市塞進查詢字串——那兩者會讓海外或冷門的小店／民宿搜不到。
  if (bias && Number.isFinite(bias.lat) && Number.isFinite(bias.lng)) {
    req.locationBias = { center: { lat: bias.lat, lng: bias.lng }, radius: 50000 };
  }
  try {
    const result = await PlaceCls.searchByText(req);
    const places: PlaceLite[] = result?.places ?? [];
    return places.map(placeToInternal).filter((p): p is Place => p !== null);
  } catch (err) {
    console.error('[walking] textSearch 失敗：', err);
    const msg = err instanceof Error ? err.message : String(err);
    if (/PERMISSION_DENIED|has not been used|disabled/i.test(msg)) {
      throw new Error('需要啟用 Places API (New)。請到 Google Cloud Console → API 和服務 → 程式庫 → 搜尋「Places API (New)」並啟用。');
    }
    if (/REQUEST_DENIED|key.*not.*valid|InvalidKeyMapError/i.test(msg)) {
      throw new Error('API Key 無效或被擋。請檢查 referrer 限制與啟用的 API。');
    }
    throw new Error('搜尋失敗：' + msg);
  }
}

/**
 * 找出指定座標附近的地點。
 * @param center 中心座標
 * @param includedTypes Google Places type 陣列（例：['restaurant', 'cafe']）
 * @param radiusMeters 搜尋半徑（公尺），預設 2500（步行 30 分鐘約 2.5 km）
 */
export async function searchNearby(
  center: { lat: number; lng: number },
  includedTypes: string[],
  radiusMeters = 2500,
): Promise<Place[]> {
  if (!hasApiKey()) return [];
  try {
    await loadGoogleMaps();
    const PlaceCls = (google.maps as any).places.Place;
    const result = await PlaceCls.searchNearby({
      fields: PLACE_LIST_FIELDS,
      locationRestriction: { center, radius: radiusMeters },
      includedTypes,
      maxResultCount: 12,
      language: 'zh-TW',
      region: 'TW',
      rankPreference: (google.maps as any).places.SearchNearbyRankPreference?.POPULARITY ?? 'POPULARITY',
    });
    const places: PlaceLite[] = result?.places ?? [];
    return places.map(placeToInternal).filter((p): p is Place => p !== null);
  } catch (err) {
    console.error('[walking] searchNearby 失敗：', err);
    const msg = err instanceof Error ? err.message : String(err);
    if (/PERMISSION_DENIED|has not been used|disabled/i.test(msg)) {
      throw new Error('需要啟用 Places API (New)');
    }
    return [];
  }
}

export async function fetchPlaceDetails(placeId: string): Promise<Partial<Place> | null> {
  if (!hasApiKey()) return null;
  try {
    await loadGoogleMaps();
    const PlaceCls = (google.maps as any).places.Place;
    const place: PlaceLite = new PlaceCls({ id: placeId });
    await (place as any).fetchFields({ fields: PLACE_DETAIL_FIELDS });

    const reviews: PlaceReview[] | undefined = place.reviews
      ?.slice(0, 5)
      .map((rv) => ({
        author: rv.authorAttribution?.displayName ?? '匿名',
        rating: rv.rating ?? 0,
        text: rv.text ?? '',
        time: rv.publishTime instanceof Date ? rv.publishTime.getTime() : undefined,
      }));

    let coordinates: { lat: number; lng: number } | undefined;
    const loc = place.location;
    if (loc && typeof loc.lat === 'function' && typeof loc.lng === 'function') {
      const lat = loc.lat();
      const lng = loc.lng();
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        coordinates = { lat, lng };
      }
    }

    return {
      name: place.displayName ?? undefined,
      address: place.formattedAddress ?? undefined,
      coordinates,
      rating: typeof place.rating === 'number' ? place.rating : undefined,
      reviewCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : undefined,
      phoneNumber: place.nationalPhoneNumber ?? undefined,
      website: place.websiteURI ?? undefined,
      openingHours: place.regularOpeningHours?.weekdayDescriptions ?? undefined,
      priceLevel: typeof place.priceLevel === 'number' ? place.priceLevel : undefined,
      types: place.types ?? undefined,
      photoUrls: getPhotoUrls(place.photos),
      reviews: reviews && reviews.length > 0 ? reviews : undefined,
    };
  } catch (err) {
    console.error('[walking] fetchPlaceDetails 失敗：', err);
    return null;
  }
}

const GOOGLE_MAPS_URL_RE = /https?:\/\/(?:www\.|maps\.)?google\.[a-z.]+\/maps?\/[^\s]+/i;

export function detectGoogleMapsLink(text: string): string | null {
  const m = text.match(GOOGLE_MAPS_URL_RE);
  return m ? m[0] : null;
}

/**
 * 解析 Google Maps 連結並嘗試取得 placeId 或座標。
 * 簡化版：抽取 query 串或 @lat,lng,zoom。
 */
export async function resolveGoogleMapsLink(url: string): Promise<Place[]> {
  const placeMatch = url.match(/\/place\/([^/]+)/);
  if (placeMatch) {
    const query = decodeURIComponent(placeMatch[1]!).replace(/\+/g, ' ');
    return textSearch(query);
  }
  return textSearch(url);
}

export function getGoogleMapsPlaceUrl(placeId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${placeId}`;
}

export function getGoogleMapsReviewsUrl(placeId: string): string {
  return `https://search.google.com/local/reviews?placeid=${placeId}`;
}

const STATIC_MAP_BASE = 'https://maps.googleapis.com/maps/api/staticmap';

// Static Maps marker + 路線顏色：品牌橘 (--accent-warm, #D85A30)。
// 用橘色不用墨綠是因為：Static Maps 底圖是綠色系（公園、街景），墨綠點擠在一起會
// 完全融入背景失去識別。橘色高對比、即使疊一團也看得出形狀。
// （互動式地圖那邊 marker 可點可放大、視覺已經夠清楚，仍用品牌主色墨綠。）
const MARKER_COLOR = '0xD85A30';

/**
 * 把一個 marker 加進 URLSearchParams。全部統一墨綠色實心 marker。
 *
 * Static Maps API 的 label 限制：只能放單一 ASCII 字元（A-Z / 0-9）。
 * - 1–9 直接顯示
 * - 10+ 沒辦法顯示完整數字 → 不放 label，只剩有顏色的 marker，
 *   完整順序看 itinerary list / day list
 */
function appendMarker(
  params: URLSearchParams,
  m: { lat: number; lng: number; label?: string },
): void {
  // 防呆：座標非有限數 → 不丟給 Google
  if (!Number.isFinite(m.lat) || !Number.isFinite(m.lng)) {
    console.warn('[googleMaps] 跳過無效座標 marker：', m);
    return;
  }
  // ⚠️ 故意不送 label，即使有也忽略。
  // 原因：Static Maps 的 markers 樣式解析有 edge case，碰到 `label:N` 可能會被
  // 當成額外位置去 geocode，結果亂跑到瑞典之類的地方（已驗證）。
  // 為了讓 PDF / HTML export 永遠不會冒出鬼點，直接放棄 label 功能。
  // 想看編號 → 用分享頁面的互動式地圖（那邊用 React marker，沒這個限制）。
  void m.label;
  params.append('markers', `color:${MARKER_COLOR}|${m.lat},${m.lng}`);
}

export function buildStaticMapUrl(
  markers: { lat: number; lng: number; label?: string }[],
  size = '600x300',
): string | null {
  if (!hasApiKey() || markers.length === 0) return null;
  const params = new URLSearchParams({ size, scale: '2', maptype: 'roadmap', key: API_KEY! });
  for (const m of markers) appendMarker(params, m);
  return `${STATIC_MAP_BASE}?${params.toString()}`;
}

/** Static Maps with optional polyline path. 給 PDF / 分享總覽用。 */
export function buildStaticMapWithPath(
  markers: { lat: number; lng: number; label?: string }[],
  path?: { lat: number; lng: number }[],
  size = '700x350',
): string | null {
  if (!hasApiKey()) return null;
  if (markers.length === 0 && (!path || path.length === 0)) return null;
  const params = new URLSearchParams({ size, scale: '2', maptype: 'roadmap', key: API_KEY! });
  // 防呆：path 內若有非有限座標，整串會讓 Static Maps 回 400 → 圖掛掉（PDF 整份失敗）。先濾掉。
  const safePath = (path ?? []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (safePath.length >= 2) {
    const pathStr = `color:${MARKER_COLOR}CC|weight:3|` + safePath.map((p) => `${p.lat},${p.lng}`).join('|');
    params.append('path', pathStr);
  }
  for (const m of markers) appendMarker(params, m);
  return `${STATIC_MAP_BASE}?${params.toString()}`;
}
