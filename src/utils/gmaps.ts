/**
 * Google Maps 深連結產生器（手機版 / 分享頁共用）。
 *
 * Google 把舊格式 `?q=place_id:xxx` 廢了，現在會被當字面字串去搜，結果是「找不到結果，
 * 改用 Google 搜尋」。一律用官方 Maps URLs API 的格式：
 * https://developers.google.com/maps/documentation/urls/get-started
 *
 * 這些只是普通網址，開的是使用者手機上的 Google Maps App／網頁版，
 * 不經過我們的 API Key，不會產生任何 Google Maps Platform 費用。
 */

/** 地點介紹頁。`query` 給名字當顯示與 fallback，`query_place_id` 才是真正的對應依據。 */
export function placeUrl(
  placeId?: string,
  name?: string,
  lat?: number,
  lng?: number,
): string | null {
  if (name) {
    const params = new URLSearchParams({ api: '1', query: name });
    if (placeId) params.set('query_place_id', placeId);
    return `https://www.google.com/maps/search/?${params.toString()}`;
  }
  if (lat !== undefined && lng !== undefined) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return null;
}

/** 指定起訖點的路線（分享頁用：上一站 → 這一站）。 */
export function directionsUrl(
  origin: { la: number; lo: number },
  dest: { la: number; lo: number; p?: string },
  mode: string,
): string {
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.la},${origin.lo}`,
    destination: `${dest.la},${dest.lo}`,
    travelmode: mode,
  });
  if (dest.p) params.set('destination_place_id', dest.p);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * 從「使用者目前位置」導航到某個點——手機上最實用的那種。
 * 刻意不給 origin：Google Maps 會自己用目前定位當起點。
 */
export function navigateUrl(
  dest: { lat: number; lng: number; placeId?: string },
  mode: string = 'driving',
): string {
  const params = new URLSearchParams({
    api: '1',
    destination: `${dest.lat},${dest.lng}`,
    travelmode: mode,
  });
  if (dest.placeId) params.set('destination_place_id', dest.placeId);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
