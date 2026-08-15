import { getUserId } from './identity';

/**
 * 圖片資產（票券 QR、Visit Japan Web 入境 QR、訂位截圖）存 R2。
 *
 * trip JSON 裡只留 key，圖本身走 /api/asset。這樣圖不佔 KV 的 500KB 額度，
 * 也不會像舊版的入境 QR 那樣「存不進雲端、重整就沒了」。
 */

/** data URL（canvas 產出的）轉成可上傳的 Blob。 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head ?? '')?.[1] ?? 'image/png';
  const bin = atob(b64 ?? '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** 上傳一張圖，回傳 R2 物件 key。失敗丟例外（訊息可直接給使用者看）。 */
export async function uploadAsset(blob: Blob, tripId: string): Promise<string> {
  const u = getUserId();
  const res = await fetch(`/api/asset?u=${encodeURIComponent(u)}&trip=${encodeURIComponent(tripId)}`, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'image/png' },
    body: blob,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `上傳失敗（HTTP ${res.status}）`);
  }
  const { key } = (await res.json()) as { key: string };
  return key;
}

/**
 * 圖片網址（絕對路徑）。
 * 刻意回絕對網址：列印用的新視窗是 about:blank，相對路徑在那裡解不出來。
 */
export function assetUrl(key: string): string {
  const u = getUserId();
  return `${window.location.origin}/api/asset/${key}?u=${encodeURIComponent(u)}`;
}

/**
 * 一筆帶圖的資料要用的 src。
 * 新資料走 R2 的 key；`image` 是舊版 base64 的相容退路（那批本來就沒存進雲端）。
 */
export function imageSrc(ref: { imageKey?: string; image?: string }): string {
  if (ref.imageKey) return assetUrl(ref.imageKey);
  return ref.image ?? '';
}

/**
 * 刻意沒有「刪掉某一列就順手刪 R2 檔案」這件事。
 *
 * 帳本是手動儲存制：使用者刪了一列但沒按儲存（或直接關掉），資料會原封不動回來——
 * 這時圖若已經被刪掉，就變成永遠修不好的破圖。留著孤兒檔案安全得多，
 * R2 免費額度 10GB，幾張票券截圖無關痛癢。真要清，到 Cloudflare 後台清 bucket。
 *
 * 後端仍有 DELETE /api/asset/<key> 可用（未來若做「垃圾回收」再接）。
 */
