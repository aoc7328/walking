type SessionStore = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};

export type AuthEnv = {
  /** 所有受保護 API 只需讀 session，因此只要求 get。 */
  TRIPS?: Pick<SessionStore, 'get'>;
  /** PBKDF2-SHA256 雜湊；只在 Cloudflare Pages secret 保存，絕不給前端。 */
  AUTH_PASSWORD_HASH?: string;
  /** 舊資料所在的 KV 命名空間識別碼；搬離前端 bundle 後僅由 Worker 使用。 */
  DATA_NAMESPACE_ID?: string;
};

export type SessionEnv = AuthEnv & {
  TRIPS?: SessionStore;
};

const SESSION_COOKIE = 'walking_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const SESSION_RE = /^[a-f0-9]{64}$/i;

function cookieValue(request: Request, name: string): string | null {
  const cookies = request.headers.get('Cookie') ?? '';
  for (const item of cookies.split(';')) {
    const [key, ...parts] = item.trim().split('=');
    if (key === name) return parts.join('=');
  }
  return null;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

async function passwordHash(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(password.trim().toLowerCase()), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode('walking:gate'), iterations: 100_000 },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

export function privateJson(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

export async function createSession(env: SessionEnv, password: string): Promise<Response> {
  if (!env.TRIPS || !env.AUTH_PASSWORD_HASH) return privateJson({ error: '登入服務暫時無法使用' }, 503);
  const actual = await passwordHash(password);
  if (!sameText(actual, env.AUTH_PASSWORD_HASH)) return privateJson({ error: '密碼不正確' }, 401);
  const session = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  await env.TRIPS.put(`auth:session:${session}`, '1', { expirationTtl: SESSION_TTL_SECONDS });
  return privateJson({ ok: true }, 200, {
    'Set-Cookie': `${SESSION_COOKIE}=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`,
  });
}

export async function hasSession(request: Request, env: AuthEnv): Promise<boolean> {
  const session = cookieValue(request, SESSION_COOKIE);
  if (!session || !SESSION_RE.test(session) || !env.TRIPS) return false;
  return (await env.TRIPS.get(`auth:session:${session}`)) === '1';
}

/** 私有資料 API 的唯一授權入口；u= 只是公開字串，不能再當權限。 */
export async function requirePrivateAccess(request: Request, env: AuthEnv): Promise<{ dataNamespaceId: string } | Response> {
  if (!(await hasSession(request, env))) return privateJson({ error: '請先登入' }, 401);
  if (!env.DATA_NAMESPACE_ID) return privateJson({ error: '資料服務暫時無法使用' }, 503);
  return { dataNamespaceId: env.DATA_NAMESPACE_ID };
}

export async function clearSession(request: Request, env: SessionEnv): Promise<Response> {
  const session = cookieValue(request, SESSION_COOKIE);
  if (session && SESSION_RE.test(session) && env.TRIPS) await env.TRIPS.delete(`auth:session:${session}`);
  return privateJson({ ok: true }, 200, {
    'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  });
}
