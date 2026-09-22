import type { Place } from '../types/place';
import { knownAuthMode } from './auth';

/**
 * 地點縮圖網址。
 *
 * 多人版走 Worker 的 `/api/place-photo` 代理：第一次抓 Google 就存進 R2，
 * 之後所有人都從 R2 出。三個好處——金鑰不再寫進行程 JSON、照片不會因為
 * Google 的 photo resource name 過期而變破圖、每個地點全站只跟 Google 要一次。
 *
 * 單人版（Pages）沒有那支 API，退回行程裡存的 Google 網址。
 * 那些網址會過期，但那是既有資料的問題，這裡不做額外處理。
 */
export function placeThumbUrl(place: Pick<Place, 'placeId' | 'photoUrls'>): string | undefined {
  if (knownAuthMode() === 'google' && place.placeId) {
    return `/api/place-photo?place=${encodeURIComponent(place.placeId)}&w=400`;
  }
  return place.photoUrls?.[0];
}
