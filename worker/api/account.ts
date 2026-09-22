import type { Env } from '../lib/env';
import { json } from '../lib/http';
import { SESSION_COOKIE, currentUserId } from '../lib/session';
import { setCookie } from '../lib/http';

/**
 * 刪除帳號與所有資料。
 *
 * 這不是「好有誠意」的加分功能，是隱私權政策裡承諾得到就要做得到的事。
 * 一個人的資料散在三個地方，少刪一處就等於沒刪：
 *
 * - KV：行程 JSON（u:<userId>:trip:*）與 session
 * - R2：發票、票券、入境 QR（u/<userId>/…）——注意地點照片 p/<placeId>/*
 *   是全站共用的快取、不含個人資訊，不刪
 * - D1：trips 索引與 users 那一列
 *
 * 刪不乾淨比不給刪更糟，所以逐項回報刪了幾筆，出事看得出來斷在哪。
 */

/** DELETE /api/account */
export async function remove(request: Request, env: Env): Promise<Response> {
  const userId = await currentUserId(request, env);
  if (!userId) return json({ error: '請先登入' }, 401);

  // 二次確認：要在網址帶上 confirm=<userId>，避免誤觸或被 CSRF 打到
  const confirm = new URL(request.url).searchParams.get('confirm');
  if (confirm !== userId) return json({ error: '缺少確認參數' }, 400);

  const report = { trips: 0, images: 0, index: 0, sessions: 0 };

  // ── KV：行程 ──
  let cursor: string | undefined;
  for (let i = 0; i < 10; i++) {
    const page = await env.TRIPS.list({ prefix: `u:${userId}:trip:`, limit: 1000, cursor });
    for (const k of page.keys) {
      await env.TRIPS.delete(k.name);
      report.trips += 1;
    }
    if (page.list_complete || !page.cursor) break;
    cursor = page.cursor;
  }

  // ── R2：這個人上傳的圖 ──
  let r2Cursor: string | undefined;
  for (let i = 0; i < 20; i++) {
    const page = await env.MEDIA.list({ prefix: `u/${userId}/`, cursor: r2Cursor });
    for (const o of page.objects) {
      await env.MEDIA.delete(o.key);
      report.images += 1;
    }
    if (!page.truncated || !page.cursor) break;
    r2Cursor = page.cursor;
  }

  // ── D1：索引與使用者 ──
  const del = await env.DB.prepare('DELETE FROM trips WHERE user_id = ?').bind(userId).run();
  report.index = (del as { meta?: { changes?: number } }).meta?.changes ?? 0;
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();

  // ── 這個人所有裝置的 session ──
  let sCursor: string | undefined;
  for (let i = 0; i < 10; i++) {
    const page = await env.TRIPS.list({ prefix: 'sess:', limit: 1000, cursor: sCursor });
    for (const k of page.keys) {
      if ((await env.TRIPS.get(k.name)) === userId) {
        await env.TRIPS.delete(k.name);
        report.sessions += 1;
      }
    }
    if (page.list_complete || !page.cursor) break;
    sCursor = page.cursor;
  }

  return json({ ok: true, deleted: report }, 200, { 'Set-Cookie': setCookie(SESSION_COOKIE, '', 0) });
}
