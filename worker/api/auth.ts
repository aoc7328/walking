import type { Env } from '../lib/env';
import { json, randomToken, readCookie, sameText, setCookie } from '../lib/http';
import { createSession, currentUserId, destroySession } from '../lib/session';
import { findById, tripLimit, upsertFromGoogle } from '../lib/users';
import { countTrips } from './trips';

/**
 * Google 登入（OAuth 2.0 authorization code flow）。
 *
 * 只要 openid / email / profile 這三個非敏感 scope，所以不需要 Google 的應用程式審查，
 * 但同意畫面必須填得出隱私權政策網址。
 */

const STATE_COOKIE = 'walking_oauth_state';
const STATE_TTL = 600; // 10 分鐘內要走完，不然重來

function redirectUri(request: Request): string {
  return new URL('/api/auth/callback', request.url).toString();
}

/** GET /api/auth/mode — 前端用這支判斷要顯示密碼欄還是 Google 按鈕。 */
export function mode(): Response {
  return json({ mode: 'google' });
}

/** GET /api/auth/google — 轉去 Google 同意畫面。 */
export function start(request: Request, env: Env): Response {
  const state = randomToken(16);
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri(request));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  // 讓使用者每次都能挑帳號——很多人有工作跟私人兩個 Google 帳號
  url.searchParams.set('prompt', 'select_account');

  return new Response(null, {
    status: 302,
    headers: { Location: url.toString(), 'Set-Cookie': setCookie(STATE_COOKIE, state, STATE_TTL) },
  });
}

/**
 * id_token 是 Google 的 JWT。這裡只解 payload 不驗簽章——
 * 因為它是我們自己用 client_secret 直接向 token endpoint 走 HTTPS 換回來的，
 * 傳輸過程已經由 TLS 保證來源，Google 官方文件也明說這種情況不必再驗。
 * （若哪天改成從前端收 id_token，就一定要驗簽章與 aud/iss。）
 */
function decodeIdToken(idToken: string): { sub?: string; email?: string; name?: string; picture?: string; email_verified?: boolean } {
  const part = idToken.split('.')[1];
  if (!part) throw new Error('id_token 格式不對');
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const text = new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)));
  return JSON.parse(text);
}

/** GET /api/auth/callback — Google 導回來，換 token、建使用者、發 session。 */
export async function callback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = readCookie(request, STATE_COOKIE);

  if (url.searchParams.get('error')) return json({ error: `Google 登入被取消（${url.searchParams.get('error')}）` }, 400);
  if (!code) return json({ error: '缺少授權碼' }, 400);
  if (!state || !expected || !sameText(state, expected)) return json({ error: '登入狀態對不上，請重新登入' }, 400);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(request),
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) return json({ error: `跟 Google 換 token 失敗（HTTP ${res.status}）` }, 502);

  const token = (await res.json()) as { id_token?: string };
  if (!token.id_token) return json({ error: 'Google 沒有回傳 id_token' }, 502);

  const claims = decodeIdToken(token.id_token);
  if (!claims.sub) return json({ error: 'id_token 缺少 sub' }, 502);
  if (claims.email && claims.email_verified === false) return json({ error: '這個 Google 帳號的信箱尚未驗證' }, 403);

  const user = await upsertFromGoogle(env, {
    sub: claims.sub,
    email: claims.email ?? '',
    name: claims.name ?? '',
    picture: claims.picture ?? '',
  });

  const sessionCookie = await createSession(env, user.id);
  const headers = new Headers({ Location: new URL('/', request.url).toString() });
  headers.append('Set-Cookie', sessionCookie);
  headers.append('Set-Cookie', setCookie(STATE_COOKIE, '', 0)); // 用完就清掉
  return new Response(null, { status: 302, headers });
}

/**
 * GET /api/auth/session
 *
 * 刻意保留單人版的 { ok: true } 欄位：前端的 isUnlocked() 只看這個，
 * 同一份前端才能同時跑在舊的 Pages 與這個 Worker 上。
 */
export async function session(request: Request, env: Env): Promise<Response> {
  const userId = await currentUserId(request, env);
  if (!userId) return json({ ok: false }, 401);

  const user = await findById(env, userId);
  if (!user) return json({ ok: false }, 401); // session 還在但使用者被刪了

  const used = await countTrips(env, userId);
  return json({
    ok: true,
    // 刪除帳號時要帶回來當確認參數，避免誤觸或被 CSRF 打到
    userId: user.id,
    user: { name: user.name, email: user.email, picture: user.picture },
    quota: { used, limit: tripLimit(env, user) },
  });
}

/** POST /api/auth/logout */
export async function logout(request: Request, env: Env): Promise<Response> {
  const cookie = await destroySession(request, env);
  return json({ ok: true }, 200, { 'Set-Cookie': cookie });
}
