import type { Env } from '../lib/env';
import { json } from '../lib/http';
import { requireUser } from '../lib/session';

/**
 * 公開分享快照：把行程複製一份到 `share:<id>`，任何人拿到連結都看得到。
 *
 * 跟使用者自己的行程分開存，而且是「快照」不是「參照」——
 * 分享出去之後本人再改行程，對方看到的不會跟著變。
 * 連結本身就是憑證，所以 id 用 128 bits 亂數，不是短碼。
 */

const SHARE_ID_RE = /^[a-f0-9]{32}$/i;
const MAX_SIZE = 200 * 1024;
const TTL = 60 * 60 * 24 * 180; // 180 天

/** POST /api/trip — 產生分享快照。 */
export async function create(request: Request, env: Env): Promise<Response> {
  const userId = await requireUser(request, env);
  if (userId instanceof Response) return userId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: '不是合法的 JSON' }, 400);
  }

  const raw = JSON.stringify(body);
  if (raw.length > MAX_SIZE) return json({ error: `分享內容超過 ${MAX_SIZE / 1024}KB 上限` }, 413);

  const id = crypto.randomUUID().replace(/-/g, '');
  await env.TRIPS.put(`share:${id}`, raw, { expirationTtl: TTL });
  return json({ id }, 201);
}

/** GET /api/trip/:id — 公開讀取，不需登入。 */
export async function read(env: Env, id: string): Promise<Response> {
  if (!SHARE_ID_RE.test(id)) return json({ error: 'ID 格式不對' }, 400);

  const raw = await env.TRIPS.get(`share:${id}`);
  if (!raw) return json({ error: '找不到該行程（可能已過期或 ID 錯誤）' }, 404);

  return new Response(raw, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // 同一個 id 只會寫一次，可以放心快取
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
}
