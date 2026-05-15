// POST /api/auth/register?u=<hash>
// 建立帳號 marker（idempotent，已存在也回 200）

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
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

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const u = url.searchParams.get('u');
  if (!u || !HASH_RE.test(u)) return jsonResponse({ error: '無效的雜湊' }, 400);
  if (!env.TRIPS) return jsonResponse({ error: 'KV 未設定' }, 500);

  const key = `u:${u.toLowerCase()}:_account`;
  const existing = await env.TRIPS.get(key);
  if (existing) {
    return jsonResponse({ ok: true, created: false });
  }
  await env.TRIPS.put(key, JSON.stringify({ createdAt: Date.now() }));
  return jsonResponse({ ok: true, created: true }, 201);
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
