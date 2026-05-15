import type { Place, PlaceReview } from '../types/place';
import { uuid } from '../utils/format';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export function hasApiKey(): boolean {
  return Boolean(API_KEY && API_KEY !== 'your_api_key_here');
}

let placesService: google.maps.places.PlacesService | null = null;
let scriptLoadingPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (typeof google !== 'undefined' && google.maps && google.maps.places) {
    return Promise.resolve();
  }
  if (scriptLoadingPromise) return scriptLoadingPromise;
  if (!hasApiKey()) {
    return Promise.reject(new Error('未設定 VITE_GOOGLE_MAPS_API_KEY'));
  }

  scriptLoadingPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-walking-gmaps]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Google Maps 載入失敗')));
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&language=zh-TW&region=TW`;
    script.async = true;
    script.defer = true;
    script.dataset.walkingGmaps = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps 載入失敗'));
    document.head.appendChild(script);
  });
  return scriptLoadingPromise;
}

function getPlacesService(): google.maps.places.PlacesService | null {
  if (placesService) return placesService;
  if (typeof google === 'undefined' || !google.maps?.places) return null;
  const div = document.createElement('div');
  const map = new google.maps.Map(div);
  placesService = new google.maps.places.PlacesService(map);
  return placesService;
}

function buildPhotoUrl(photo: google.maps.places.PlacePhoto, maxWidth = 800): string {
  return photo.getUrl({ maxWidth });
}

function placeResultToPlace(r: google.maps.places.PlaceResult): Place | null {
  const lat = r.geometry?.location?.lat();
  const lng = r.geometry?.location?.lng();
  if (lat === undefined || lng === undefined || !r.place_id || !r.name) return null;
  const place: Place = {
    id: uuid(),
    placeId: r.place_id,
    name: r.name,
    address: r.formatted_address ?? r.vicinity ?? '',
    coordinates: { lat, lng },
    rating: r.rating,
    reviewCount: r.user_ratings_total,
    types: r.types ?? [],
    photoUrls: r.photos?.slice(0, 6).map((p) => buildPhotoUrl(p)) ?? undefined,
    priceLevel: r.price_level,
  };
  return place;
}

export async function textSearch(query: string, biasLocation?: string): Promise<Place[]> {
  if (!hasApiKey()) return [];
  await loadGoogleMaps();
  const service = getPlacesService();
  if (!service) return [];

  const fullQuery = biasLocation ? `${biasLocation} ${query}` : query;
  return new Promise((resolve) => {
    service.textSearch({ query: fullQuery, language: 'zh-TW', region: 'TW' }, (results, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
        resolve([]);
        return;
      }
      const places = results
        .map(placeResultToPlace)
        .filter((p): p is Place => p !== null);
      resolve(places);
    });
  });
}

export async function fetchPlaceDetails(placeId: string): Promise<Partial<Place> | null> {
  if (!hasApiKey()) return null;
  await loadGoogleMaps();
  const service = getPlacesService();
  if (!service) return null;

  return new Promise((resolve) => {
    service.getDetails(
      {
        placeId,
        language: 'zh-TW',
        region: 'TW',
        fields: [
          'place_id',
          'name',
          'formatted_address',
          'geometry',
          'rating',
          'user_ratings_total',
          'photos',
          'types',
          'formatted_phone_number',
          'website',
          'opening_hours',
          'price_level',
          'reviews',
        ],
      },
      (r, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !r) {
          resolve(null);
          return;
        }
        const photos = r.photos?.slice(0, 6).map((p) => buildPhotoUrl(p));
        const reviews: PlaceReview[] | undefined = r.reviews?.slice(0, 5).map((rv) => ({
          author: rv.author_name,
          rating: rv.rating ?? 0,
          text: rv.text,
          time: rv.time,
        }));
        resolve({
          name: r.name,
          address: r.formatted_address,
          rating: r.rating,
          reviewCount: r.user_ratings_total,
          phoneNumber: r.formatted_phone_number,
          website: r.website,
          openingHours: r.opening_hours?.weekday_text,
          priceLevel: r.price_level,
          types: r.types,
          photoUrls: photos,
          reviews,
        });
      },
    );
  });
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
  // 簡單抽取 place query
  const placeMatch = url.match(/\/place\/([^/]+)/);
  if (placeMatch) {
    const query = decodeURIComponent(placeMatch[1]!).replace(/\+/g, ' ');
    return textSearch(query);
  }
  return textSearch(url);
}

/**
 * 產生指向 Google Maps 該地點頁的 URL。
 * 使用 place_id 格式，能精準定位（不會被名稱搜尋誤判）。
 */
export function getGoogleMapsPlaceUrl(placeId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${placeId}`;
}

/**
 * 產生指向該地點評論區的 Google Maps URL。
 * 點開後 Google Maps 會直接展開該地點的所有評論。
 */
export function getGoogleMapsReviewsUrl(placeId: string): string {
  return `https://search.google.com/local/reviews?placeid=${placeId}`;
}

const STATIC_MAP_BASE = 'https://maps.googleapis.com/maps/api/staticmap';

export function buildStaticMapUrl(
  markers: { lat: number; lng: number; label?: string; color?: string }[],
  size = '600x300',
): string | null {
  if (!hasApiKey() || markers.length === 0) return null;
  const params = new URLSearchParams({ size, scale: '2', maptype: 'roadmap', key: API_KEY! });
  for (const m of markers) {
    const label = m.label ? `|label:${m.label}` : '';
    const color = m.color ? `color:${m.color}|` : '';
    params.append('markers', `${color}${m.lat},${m.lng}${label}`);
  }
  return `${STATIC_MAP_BASE}?${params.toString()}`;
}
