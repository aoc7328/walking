// Cloudflare Pages Function: POST /api/trip
// 上傳行程 JSON 到 KV，回傳短 ID。給「分享」功能用。
//
// KV 設定（一次性，在 Cloudflare 控制台做）：
// 1. Workers & Pages → KV → Create namespace → 名稱「WALKING_TRIPS」
// 2. Pages project (walking2) → Settings → Functions → KV namespace bindings
//    → 變數名稱「TRIPS」、KV namespace 選「WALKING_TRIPS」

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

interface Env {
  TRIPS?: KVNamespace;
}

type PagesContext = {
  request: Request;
  env: Env;
};

const MAX_SIZE = 200 * 1024; // 200KB 行程上限
const TTL_SECONDS = 60 * 60 * 24 * 180; // 180 天後自動清除

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

  if (!env.TRIPS) {
    return jsonResponse({ error: 'KV namespace 未設定，請到 Cloudflare 控制台綁定 TRIPS' }, 500);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: '不是合法的 JSON' }, 400);
  }

  const json = JSON.stringify(body);
  if (json.length > MAX_SIZE) {
    return jsonResponse({ error: `行程資料超過 ${MAX_SIZE / 1024}KB 上限` }, 413);
  }

  // 10 字元 hex ID（16^10 ≈ 1.1 兆組合，撞 ID 機率忽略）
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 10);

  await env.TRIPS.put(`trip:${id}`, json, { expirationTtl: TTL_SECONDS });

  return jsonResponse({ id }, 201);
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
