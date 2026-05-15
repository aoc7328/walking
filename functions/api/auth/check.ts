// GET /api/auth/check?u=<hash>
// 回傳 { exists: boolean }，告訴 client 這個雜湊有沒有對應帳號（之前 register 過）

interface KVNamespace {
  get(key: string): Promise<string | null>;
}

interface Env {
  TRIPS?: KVNamespace;
}

type PagesContext = {
  request: Request;
  env: Env;
};

const HASH_RE = /^[a-f0-9]{32,64}$/i;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const u = url.searchParams.get('u');
  if (!u || !HASH_RE.test(u)) return jsonResponse({ error: '無效的雜湊' }, 400);
  if (!env.TRIPS) return jsonResponse({ error: 'KV 未設定' }, 500);

  const exists = (await env.TRIPS.get(`u:${u.toLowerCase()}:_account`)) !== null;
  return jsonResponse({ exists });
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
