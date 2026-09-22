/**
 * 密碼只傳給同源的登入 API；後端以 Cloudflare Pages secret 驗證後，發 HttpOnly
 * session cookie。前端拿不到雜湊、session 值或資料命名空間，也不能自行偽造授權。
 */

export type AuthMode = 'password' | 'google';

/**
 * 後端用的是哪一種登入。
 *
 * 單人版（Cloudflare Pages）沒有這支 API：_redirects 會把它導到 index.html，
 * 所以拿到的是 200 + HTML，解析 JSON 時丟例外 → catch 當成密碼版。
 * 多人版 Worker 回 { mode: 'google' }。同一份前端才能兩邊都跑。
 */
export async function getAuthMode(): Promise<AuthMode> {
  try {
    const res = await fetch('/api/auth/mode', { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) return 'password';
    const body = (await res.json()) as { mode?: string };
    return body.mode === 'google' ? 'google' : 'password';
  } catch {
    return 'password';
  }
}

export async function verifyPassword(password: string): Promise<boolean> {
  const response = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
    body: JSON.stringify({ password }),
  });
  return response.ok;
}

export async function isUnlocked(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
    return response.ok && (await response.json() as { ok?: boolean }).ok === true;
  } catch { return false; }
}
