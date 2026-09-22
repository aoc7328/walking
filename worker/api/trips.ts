import type { Env } from '../lib/env';
import { json } from '../lib/http';
import { requireUser } from '../lib/session';
import { findById, tripLimit } from '../lib/users';

/**
 * 使用者自己的行程。
 *
 * 分工：**D1 存索引（誰有哪些行程）、KV 存內容（行程 JSON）**。
 *
 * 為什麼不全用 KV：KV 的 list 是最終一致的，剛 put 進去的 key 可能幾十秒後
 * 才出現在列表裡。拿它來數數量擋配額，連續建立時每次都數到舊數字，等於沒擋
 * （實測連建 4 個全過）。列舉也一樣——剛建好的行程可能在清單裡看不到。
 * D1 是強一致的，所以「有幾個、有哪些」一律問 D1。
 *
 * key 一律 `u:<userId>:trip:<tripId>`，userId 來自 session，
 * 前端傳什麼都不影響——這是資料隔離的唯一依據。
 */

const TRIP_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
const MAX_SIZE = 500 * 1024;

function keyOf(userId: string, tripId: string): string {
  return `u:${userId}:trip:${tripId}`;
}

/** 這個人現在有幾個行程。 */
export async function countTrips(env: Env, userId: string): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM trips WHERE user_id = ?')
    .bind(userId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** GET /api/trips — 回完整行程陣列（維持跟單人版一樣的格式，前端不用改）。 */
export async function list(request: Request, env: Env): Promise<Response> {
  const userId = await requireUser(request, env);
  if (userId instanceof Response) return userId;

  const index = await env.DB.prepare(
    'SELECT trip_id FROM trips WHERE user_id = ? ORDER BY updated_at DESC',
  )
    .bind(userId)
    .all<{ trip_id: string }>();

  const trips: unknown[] = [];
  for (const row of index.results) {
    const raw = await env.TRIPS.get(keyOf(userId, row.trip_id));
    if (!raw) continue; // 索引有、內容沒有：當作不存在，不要讓一筆缺漏弄掛整個清單
    try {
      trips.push(JSON.parse(raw));
    } catch {
      // 壞掉的條目跳過
    }
  }
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
 * 配額只擋「新建」：已經存在的行程永遠存得回去。
 * 不然使用者沒額度時連手上這幾個都改不了，資料等於被扣住。
 */
export async function put(request: Request, env: Env, tripId: string): Promise<Response> {
  const userId = await requireUser(request, env);
  if (userId instanceof Response) return userId;
  if (!TRIP_ID_RE.test(tripId)) return json({ error: '無效的行程 ID' }, 400);

  const user = await findById(env, userId);
  if (!user) return json({ error: '找不到使用者' }, 401);
  const limit = tripLimit(env, user);
  const now = Date.now();

  /**
   * 「還沒超過上限、或這筆本來就存在」才寫入，寫成單一句 SQL——
   * 數量檢查與寫入在同一個交易裡完成。先 SELECT COUNT 再 INSERT 會有競態：
   * 兩個請求同時進來會雙雙通過檢查。
   *
   * 那個 EXISTS 不可省：滿額時 COUNT(*) < limit 為假，整個 SELECT 沒有列，
   * ON CONFLICT 的更新路徑根本輪不到，連既有行程都存不回去（實測會回 402）。
   */
  const insert = await env.DB.prepare(
    `INSERT INTO trips (user_id, trip_id, updated_at)
     SELECT ?1, ?2, ?3
     WHERE (SELECT COUNT(*) FROM trips WHERE user_id = ?1) < ?4
        OR EXISTS (SELECT 1 FROM trips WHERE user_id = ?1 AND trip_id = ?2)
     ON CONFLICT (user_id, trip_id) DO UPDATE SET updated_at = ?3`,
  )
    .bind(userId, tripId, now, limit)
    .run();

  const changes = (insert as { meta?: { changes?: number } }).meta?.changes ?? 0;
  if (changes === 0) {
    const used = await countTrips(env, userId);
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: '不是合法的 JSON' }, 400);
  }

  const raw = JSON.stringify(body);
  if (raw.length > MAX_SIZE) return json({ error: `行程超過 ${MAX_SIZE / 1024}KB 上限` }, 413);

  await env.TRIPS.put(keyOf(userId, tripId), raw);
  return json({ ok: true });
}

/** DELETE /api/trips/:id — 索引與內容一起刪，不然配額會被幽靈索引佔住。 */
export async function remove(request: Request, env: Env, tripId: string): Promise<Response> {
  const userId = await requireUser(request, env);
  if (userId instanceof Response) return userId;
  if (!TRIP_ID_RE.test(tripId)) return json({ error: '無效的行程 ID' }, 400);

  await env.DB.prepare('DELETE FROM trips WHERE user_id = ? AND trip_id = ?').bind(userId, tripId).run();
  await env.TRIPS.delete(keyOf(userId, tripId));
  return json({ ok: true });
}
