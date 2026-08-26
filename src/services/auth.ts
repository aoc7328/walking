/**
 * 密碼只傳給同源的登入 API；後端以 Cloudflare Pages secret 驗證後，發 HttpOnly
 * session cookie。前端拿不到雜湊、session 值或資料命名空間，也不能自行偽造授權。
 */

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
