/**
 * 純密碼解鎖。單人使用，沒有帳號這回事。
 *
 * 程式裡不存密碼本身，存的是 PBKDF2(密碼, 'walking:gate', 100k 次) 的結果。
 * 驗證就是把輸入的密碼照樣算一次，跟 PASSWORD_HASH 比對。
 *
 * 重要：資料的 KV key 是 services/identity.ts 裡那組固定值，跟密碼「完全無關」。
 * 所以之後要改密碼，只要換掉 PASSWORD_HASH 就好，行程資料一筆都不會動到。
 *
 * 這是「門檻」不是加密 —— KV key 編在前端 bundle 裡，
 * 真的有心人翻 JS 還是繞得過去。它擋的是路過亂點的人。
 *
 * 好處是驗證純在本機算，不打後端，所以離線也能解鎖（出國沒網路照樣進得去）。
 */

/** PBKDF2('194k0039', 'walking:gate', 100000, SHA-256) */
const PASSWORD_HASH = 'a03cb21425c195762c2a13bda4b26a7613e6693b8121fd26f1fa82540fe85f8f';

const SALT = 'walking:gate';
const PBKDF2_ITERATIONS = 100_000;
const HASH_BITS = 256;
const UNLOCKED_KEY = 'walking.unlocked';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 大小寫不拘：手機鍵盤很愛自己亂跳大寫，在國外被鎖在外面太蠢了 */
async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password.trim().toLowerCase()),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(SALT), iterations: PBKDF2_ITERATIONS },
    key,
    HASH_BITS,
  );
  return bytesToHex(new Uint8Array(bits));
}

/** 長度固定，比對時不因為前幾個字元就提早跳出 */
function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyPassword(password: string): Promise<boolean> {
  if (!password.trim()) return false;
  return sameHash(await hashPassword(password), PASSWORD_HASH);
}

export function isUnlocked(): boolean {
  try {
    return localStorage.getItem(UNLOCKED_KEY) === PASSWORD_HASH;
  } catch {
    return false;
  }
}

/** 記住這台裝置已解鎖，之後開就不用再打 */
export function saveUnlock(): void {
  try {
    localStorage.setItem(UNLOCKED_KEY, PASSWORD_HASH);
  } catch {
    // 無痕模式之類的，記不住就每次打一次
  }
}

export function lock(): void {
  try {
    localStorage.removeItem(UNLOCKED_KEY);
  } catch {
    // ignore
  }
}
