// Cloudflare Pages Function: GET /api/trip/:id
// 用 ID 從 KV 拿回行程 JSON。給 TripViewer 用。

interface KVNamespace {
  get(key: string): Promise<string | null>;
}

interface Env {
  TRIPS?: KVNamespace;
}

type PagesContext = {
  params: { id?: string | string[] };
  env: Env;
};

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...extraHeaders,
    },
  });
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { params, env } = context;
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = (rawId ?? '').trim();

  if (!/^[a-f0-9]{6,16}$/i.test(id)) {
    return jsonResponse({ error: 'ID 格式不對' }, 400);
  }

  if (!env.TRIPS) {
    return jsonResponse({ error: 'KV namespace 未設定' }, 500);
  }

  const json = await env.TRIPS.get(`trip:${id}`);
  if (!json) {
    return jsonResponse({ error: '找不到該行程（可能已過期或 ID 錯誤）' }, 404);
  }

  return new Response(json, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      // 行程內容不會變（同 ID 只會 put 一次），讓瀏覽器與 Cloudflare edge 快取
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
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
