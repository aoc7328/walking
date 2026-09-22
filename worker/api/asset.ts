import type { Env } from '../lib/env';
import { json } from '../lib/http';
import { requireUser } from '../lib/session';

/**
 * 照片 / 發票 / 票券截圖，存 R2；行程 JSON 裡只留 key。
 *
 * key 前綴帶 userId，讀取時一定要對得起來——不然任何人拿到別人的 key
 * 就能把別人的收據（上面有姓名跟卡號末四碼）抓走。
 */

const TRIP_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
const MAX_SIZE = 5 * 1024 * 1024;

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** POST /api/asset?trip=<tripId> */
export async function upload(request: Request, env: Env): Promise<Response> {
  const userId = await requireUser(request, env);
  if (userId instanceof Response) return userId;

  const tripId = (new URL(request.url).searchParams.get('trip') ?? '').trim();
  if (!TRIP_ID_RE.test(tripId)) return json({ error: '無效的行程 ID' }, 400);

  const contentType = (request.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  const ext = EXT[contentType];
  if (!ext) return json({ error: '只接受 PNG / JPEG / WebP / GIF 圖片' }, 415);

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) return json({ error: '空的檔案' }, 400);
  if (bytes.byteLength > MAX_SIZE) return json({ error: `圖片超過 ${MAX_SIZE / 1024 / 1024}MB 上限` }, 413);

  const key = `u/${userId}/${tripId}/${crypto.randomUUID()}.${ext}`;
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType } });
  return json({ key });
}

/** 確認這個 key 屬於這個人。不屬於就當作不存在。 */
function ownedKey(userId: string, raw: string): string | null {
  const key = raw.trim();
  if (!key || key.includes('..')) return null;
  if (!key.startsWith(`u/${userId}/`)) return null;
  return key;
}

/** GET /api/asset/<key> */
export async function download(request: Request, env: Env, rawKey: string): Promise<Response> {
  const userId = await requireUser(request, env);
  if (userId instanceof Response) return userId;

  const key = ownedKey(userId, rawKey);
  if (!key) return json({ error: '無效的圖片位址' }, 400);

  const obj = await env.MEDIA.get(key);
  if (!obj) return json({ error: '找不到圖片' }, 404);

  return new Response(obj.body, {
    status: 200,
    headers: {
      'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
      // key 帶 uuid、內容不會被覆寫，放心讓瀏覽器長期快取（出國沒訊號也看得到）
      'Cache-Control': 'private, max-age=31536000, immutable',
      Vary: 'Cookie',
    },
  });
}

/** DELETE /api/asset/<key> */
export async function remove(request: Request, env: Env, rawKey: string): Promise<Response> {
  const userId = await requireUser(request, env);
  if (userId instanceof Response) return userId;

  const key = ownedKey(userId, rawKey);
  if (!key) return json({ error: '無效的圖片位址' }, 400);

  await env.MEDIA.delete(key);
  return json({ ok: true });
}
