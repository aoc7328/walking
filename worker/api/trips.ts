import type { Env } from '../lib/env';
import { json } from '../lib/http';
import { requireUser } from '../lib/session';
import { findById, tripLimit } from '../lib/users';

/**
 * 使用者自己的行程。key 一律 `u:<userId>:trip:<tripId>`——
 * userId 來自 session，前端傳什麼都不影響，這是資料隔離的唯一依據。
 */

const TRIP_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
const MAX_SIZE = 500 * 1024;

function keyOf(userId: string, tripId: string): string {
  return `u:${userId}:trip:${tripId}`;
}

/** 這個人現在有幾個行程。只 list key 不讀內容，所以很便宜。 */
export async function countTrips(env: Env, userId: string): Promise<number> {
  const prefix = `u:${userId}:trip:`;
  let count = 0;
  let cursor: string | undefined;
  for (let i = 0; i < 5; i++) {
    const page = await env.TRIPS.list({ prefix, limit: 1000, cursor });
    count += page.keys.length;
    if (page.list_complete || !page.cursor) break;
    cursor = page.cursor;
  }
  return count;
}

/** GET /api/trips — 回完整行程陣列（維持跟單人版一樣的格式，前端不用改）。 */
export async function list(request: Request, env: Env): Promise<Response> {
  const userId = await requireUser(request, env);
  if (userId instanceof Response) return userId;

  const prefix = `u:${userId}:trip:`;
  const trips: unknown[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 5; i++) {
    const page = await env.TRIPS.list({ prefix, limit: 1000, cursor });
    for (const k of page.keys) {
      const raw = await env.TRIPS.get(k.name);
      if (!raw) continue;
      try {
        trips.push(JSON.parse(raw));
      } catch {
        // 壞掉的條目跳過，不要讓一筆爛資料弄掛整個清單
      }
    }
    if (page.list_complete || !page.cursor) break;
    cursor = page.cursor;
  }

  trips.sort((a, b) => {
    const au = typeof (a as { updatedAt?: number }).updatedAt === 'number' ? (a as { updatedAt: number }).updatedAt : 0;
    const bu = typeof (b as { updatedAt?: number }).updatedAt === 'number' ? (b as { updatedAt: number }).updatedAt : 0;
    return bu - au;
  });
  return json(trips);
}

/** GET /api/trips/:id */
export async function get(request: Request, env: Env, tripId: string): Promise<Response> {
  const userId = await requireUser(request, env);
  if (userId instanceof Response) return userId;
  if (!TRIP_ID_RE.test(tripId)) return json({ error: '無效的行程 ID' }, 400);

  const raw = await env.TRIPS.get(keyOf(userId, tripId));
  if (!raw) return json({ error: '找不到行程' }, 404);
  return json(JSON.parse(raw));
}

/**
 * PUT /api/trips/:id
 *
 * 配額只在「新建」時檢查：已經存在的行程永遠存得回去。
 * 不然使用者買不起額度時，連改都改不了手上這幾個，資料等於被扣住。
 */
export async function put(request: Request, env: Env, tripId: string): Promise<Response> {
  const userId = await requireUser(request, env);
  if (userId instanceof Response) return userId;
  if (!TRIP_ID_RE.test(tripId)) return json({ error: '無效的行程 ID' }, 400);

  const key = keyOf(userId, tripId);
  const exists = (await env.TRIPS.get(key)) !== null;

  if (!exists) {
    const user = await findById(env, userId);
    if (!user) return json({ error: '找不到使用者' }, 401);
    const limit = tripLimit(env, user);
    const used = await countTrips(env, userId);
    if (used >= limit) {
      return json(
        {
          error: `免費方案最多同時保留 ${limit} 個行程`,
          reason: 'quota',
          quota: { used, limit },
          hint: '刪掉一個舊行程就能再建新的，或加購額度。',
        },
        402,
      );
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: '不是合法的 JSON' }, 400);
  }

  const raw = JSON.stringify(body);
  if (raw.length > MAX_SIZE) return json({ error: `行程超過 ${MAX_SIZE / 1024}KB 上限` }, 413);

  await env.TRIPS.put(key, raw);
  return json({ ok: true });
}

/** DELETE /api/trips/:id */
export async function remove(request: Request, env: Env, tripId: string): Promise<Response> {
  const userId = await requireUser(request, env);
  if (userId instanceof Response) return userId;
  if (!TRIP_ID_RE.test(tripId)) return json({ error: '無效的行程 ID' }, 400);

  await env.TRIPS.delete(keyOf(userId, tripId));
  return json({ ok: true });
}
