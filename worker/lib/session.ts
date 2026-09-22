import type { Env } from './env';
import { json, randomToken, readCookie, setCookie } from './http';

/**
 * Session：隨機 token 存 cookie，KV 裡對應到 userId。
 *
 * 跟單人版最大的差別是 KV 存的值——單人版存 '1'（只代表「有登入」），
 * 這裡存 userId，因為所有資料的 key 都要照使用者切開。
 */

export const SESSION_COOKIE = 'walking_sid';
export const SESSION_TTL = 60 * 60 * 24 * 30; // 30 天
const TOKEN_RE = /^[a-f0-9]{64}$/i;

export async function createSession(env: Env, userId: string): Promise<string> {
  const token = randomToken();
  await env.TRIPS.put(`sess:${token}`, userId, { expirationTtl: SESSION_TTL });
  return setCookie(SESSION_COOKIE, token, SESSION_TTL);
}

/** 目前登入者的 userId；沒登入回 null。 */
export async function currentUserId(request: Request, env: Env): Promise<string | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token || !TOKEN_RE.test(token)) return null;
  return env.TRIPS.get(`sess:${token}`);
}

export async function destroySession(request: Request, env: Env): Promise<string> {
  const token = readCookie(request, SESSION_COOKIE);
  if (token && TOKEN_RE.test(token)) await env.TRIPS.delete(`sess:${token}`);
  return setCookie(SESSION_COOKIE, '', 0);
}

/**
 * 所有私有 API 的唯一入口。回 userId 或直接回 401。
 * 拿到 userId 之後，KV key 與 R2 key 都必須帶上它——那是資料隔離的唯一防線。
 */
export async function requireUser(request: Request, env: Env): Promise<string | Response> {
  const userId = await currentUserId(request, env);
  if (!userId) return json({ error: '請先登入' }, 401);
  return userId;
}
