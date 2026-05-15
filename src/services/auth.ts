/**
 * 帳號雜湊：username + password → PBKDF2(100k iter SHA-256) → 64 字元 hex。
 * 結果直接當 KV namespace key 用，沒有伺服器端的「帳號表」需要維護。
 *
 * 安全特性：
 * - 100k 迭代讓暴力破解成本高（每次猜測都要算 100k 次 HMAC-SHA-256）
 * - salt 用 username 確保不同帳號相同密碼會出不同 hash
 * - 'walking:' prefix 防止跨 app rainbow table
 *
 * 風險：使用者忘記密碼 = 永久失去資料（沒有 reset 機制）
 */

const ACCOUNT_HASH_KEY = 'walking.accountHash';
const USERNAME_KEY = 'walking.username';
const PREVIOUS_USER_ID_KEY = 'walking.userId'; // 舊版自動 UUID
const MIGRATED_TO_ACCOUNT_KEY = 'walking.migratedToAccount';

const PBKDF2_ITERATIONS = 100_000;
const HASH_BITS = 256;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** PBKDF2(password, walking:username, 100k) → 64-char hex */
export async function hashCredentials(username: string, password: string): Promise<string> {
  const u = username.trim().toLowerCase();
  if (!u) throw new Error('帳號不能為空');
  if (!password) throw new Error('密碼不能為空');
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: enc.encode(`walking:${u}`),
      iterations: PBKDF2_ITERATIONS,
    },
    key,
    HASH_BITS,
  );
  return bytesToHex(new Uint8Array(bits));
}

export function getAccountHash(): string | null {
  try {
    return localStorage.getItem(ACCOUNT_HASH_KEY);
  } catch {
    return null;
  }
}

export function getUsername(): string | null {
  try {
    return localStorage.getItem(USERNAME_KEY);
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return !!getAccountHash();
}

export function saveSession(username: string, hash: string): void {
  localStorage.setItem(ACCOUNT_HASH_KEY, hash);
  localStorage.setItem(USERNAME_KEY, username.trim());
}

export function logout(): void {
  localStorage.removeItem(ACCOUNT_HASH_KEY);
  localStorage.removeItem(USERNAME_KEY);
  // 注意：不清 walking.userId（舊 UUID 是另一回事），也不清 trips 快取
}

/** 後端「這個 hash 對應的帳號是否存在」檢查 */
export async function checkAccountExists(hash: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/auth/check?u=${encodeURIComponent(hash)}`);
    if (!res.ok) return false;
    const body = (await res.json()) as { exists?: boolean };
    return body.exists === true;
  } catch {
    return false;
  }
}

/** 建立帳號（在 KV 寫一個 marker 表示此帳號已存在） */
export async function registerAccount(hash: string): Promise<void> {
  const res = await fetch(`/api/auth/register?u=${encodeURIComponent(hash)}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? '註冊失敗');
  }
}

/** 取舊版 UUID（純自動產生那種），用於資料遷移 */
export function getLegacyUserId(): string | null {
  try {
    return localStorage.getItem(PREVIOUS_USER_ID_KEY);
  } catch {
    return null;
  }
}

export function isAccountMigrationDone(): boolean {
  return !!localStorage.getItem(MIGRATED_TO_ACCOUNT_KEY);
}

export function markAccountMigrationDone(): void {
  try {
    localStorage.setItem(MIGRATED_TO_ACCOUNT_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}
