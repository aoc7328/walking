// GET /api/trips?u=<userId>
// 列出使用者的所有行程，依 updatedAt 倒序

interface KVNamespace {
  get(key: string): Promise<string | null>;
  list(opts: { prefix: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

interface Env {
  TRIPS?: KVNamespace;
}

type PagesContext = {
  request: Request;
  env: Env;
};

const USER_ID_RE = /^[a-f0-9]{16,40}$/i;

function parseUserId(url: URL): string | null {
  const u = url.searchParams.get('u');
  if (!u || !USER_ID_RE.test(u)) return null;
  return u.toLowerCase();
}

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
  const userId = parseUserId(url);
  if (!userId) return jsonResponse({ error: '無效的同步 ID' }, 400);
  if (!env.TRIPS) return jsonResponse({ error: 'KV 未設定' }, 500);

  const prefix = `u:${userId}:trip:`;
  const trips: unknown[] = [];
  let cursor: string | undefined;
  // 分頁拉，最多 1000 行程（KV list 預設 limit 1000）
  for (let i = 0; i < 5; i++) {
    const page = await env.TRIPS.list({ prefix, limit: 1000, cursor });
    for (const k of page.keys) {
      const raw = await env.TRIPS.get(k.name);
      if (raw) {
        try {
          trips.push(JSON.parse(raw));
        } catch {
          // skip 壞掉的條目
        }
      }
    }
    if (page.list_complete || !page.cursor) break;
    cursor = page.cursor;
  }

  // 依 updatedAt 倒序
  trips.sort((a, b) => {
    const aU = typeof (a as { updatedAt?: number }).updatedAt === 'number' ? (a as { updatedAt: number }).updatedAt : 0;
    const bU = typeof (b as { updatedAt?: number }).updatedAt === 'number' ? (b as { updatedAt: number }).updatedAt : 0;
    return bU - aU;
  });

  return jsonResponse(trips);
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
