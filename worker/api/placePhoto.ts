import type { Env } from '../lib/env';
import { json } from '../lib/http';
import { currentUserId } from '../lib/session';

/**
 * 地點照片代理：第一次抓 Google，存進 R2，之後都從 R2 出。
 *
 * 解三個問題：
 *
 * 1. **金鑰外洩**。原本是把 `…/media?key=<API key>` 直接寫進行程 JSON，
 *    等於每個使用者都拿得到你的 Maps key 去刷你的額度。現在金鑰只留在 Worker。
 *
 * 2. **照片會過期**。Google 的 photo resource name 不是永久的——實測拿三個月前
 *    存的網址去抓，回 "The photo resource in the request is invalid"。也就是舊行程
 *    的照片本來就已經在變破圖。抓下來存 R2 才是真的留住。
 *
 * 3. **重複計費**。Places Photo 每抓一次 $0.007，而且免費額度只有 1,000／月——
 *    是所有 SKU 裡最緊的。原本每看一次行程就重抓一次；現在每個地點全站只抓一次。
 *
 * 快取 key 用 placeId 而不是使用者，所以**跨使用者共用**：
 * 一百個人都加了東京鐵塔，Google 也只被打一次。
 */

const PLACE_ID_RE = /^[A-Za-z0-9_-]{10,255}$/;
const WIDTHS = new Set([400, 800]);
const CACHE_HEADERS = {
  // 同一個 key 的內容永不改變，讓瀏覽器與邊緣盡量長期快取
  'Cache-Control': 'public, max-age=31536000, immutable',
};

function r2Key(placeId: string, width: number): string {
  return `p/${placeId}/${width}.jpg`;
}

/**
 * GET /api/place-photo?place=<placeId>&w=400
 *
 * 需要登入（避免變成公開的免費圖床），但快取是全站共用的。
 */
export async function photo(request: Request, env: Env): Promise<Response> {
  const userId = await currentUserId(request, env);
  if (!userId) return json({ error: '請先登入' }, 401);

  const url = new URL(request.url);
  const placeId = (url.searchParams.get('place') ?? '').trim();
  const width = Number(url.searchParams.get('w') ?? 400);

  if (!PLACE_ID_RE.test(placeId)) return json({ error: '無效的 placeId' }, 400);
  if (!WIDTHS.has(width)) return json({ error: '只支援 w=400 或 w=800' }, 400);

  const key = r2Key(placeId, width);

  // ── 有存過就直接出，不碰 Google ──
  const hit = await env.MEDIA.get(key);
  if (hit) {
    return new Response(hit.body, {
      status: 200,
      headers: { 'Content-Type': hit.httpMetadata?.contentType ?? 'image/jpeg', ...CACHE_HEADERS, 'X-Photo-Cache': 'hit' },
    });
  }

  if (!env.GOOGLE_MAPS_SERVER_KEY) return json({ error: '照片服務尚未設定' }, 503);

  // ── 沒存過：先問 Google 這個地點有哪些照片，取第一張 ──
  const detail = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      'X-Goog-Api-Key': env.GOOGLE_MAPS_SERVER_KEY,
      'X-Goog-FieldMask': 'photos.name', // 只要 photos → Essentials 層，最便宜
    },
  });
  if (!detail.ok) return json({ error: `取得照片清單失敗（HTTP ${detail.status}）` }, 502);

  const body = (await detail.json()) as { photos?: { name: string }[] };
  const name = body.photos?.[0]?.name;
  if (!name) return json({ error: '這個地點沒有照片' }, 404);

  const media = await fetch(
    `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${width}&key=${env.GOOGLE_MAPS_SERVER_KEY}`,
  );
  if (!media.ok) return json({ error: `下載照片失敗（HTTP ${media.status}）` }, 502);

  const bytes = await media.arrayBuffer();
  const contentType = media.headers.get('content-type') ?? 'image/jpeg';
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType } });

  return new Response(bytes, {
    status: 200,
    headers: { 'Content-Type': contentType, ...CACHE_HEADERS, 'X-Photo-Cache': 'miss' },
  });
}
