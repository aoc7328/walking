// GET/PUT/DELETE /api/trips/:id?u=<userId>

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

interface Env {
  TRIPS?: KVNamespace;
}

type PagesContext = {
  request: Request;
  env: Env;
  params: { id?: string | string[] };
};

const USER_ID_RE = /^[a-f0-9]{16,40}$/i;
const TRIP_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
const MAX_SIZE = 500 * 1024; // 一個 trip 上限 500KB

function parseUserId(url: URL): string | null {
  const u = url.searchParams.get('u');
  if (!u || !USER_ID_RE.test(u)) return null;
  return u.toLowerCase();
}

function parseTripId(params: PagesContext['params']): string | null {
  const raw = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = (raw ?? '').trim();
  return TRIP_ID_RE.test(id) ? id : null;
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
  const { request, env, params } = context;
  const url = new URL(request.url);
  const userId = parseUserId(url);
  if (!userId) return jsonResponse({ error: '無效的同步 ID' }, 400);
  const tripId = parseTripId(params);
  if (!tripId) return jsonResponse({ error: '無效的行程 ID' }, 400);
  if (!env.TRIPS) return jsonResponse({ error: 'KV 未設定' }, 500);

  const raw = await env.TRIPS.get(`u:${userId}:trip:${tripId}`);
  if (!raw) return jsonResponse({ error: '找不到行程' }, 404);
  return new Response(raw, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function onRequestPut(context: PagesContext): Promise<Response> {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const userId = parseUserId(url);
  if (!userId) return jsonResponse({ error: '無效的同步 ID' }, 400);
  const tripId = parseTripId(params);
  if (!tripId) return jsonResponse({ error: '無效的行程 ID' }, 400);
  if (!env.TRIPS) return jsonResponse({ error: 'KV 未設定' }, 500);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: '不是合法的 JSON' }, 400);
  }

  const json = JSON.stringify(body);
  if (json.length > MAX_SIZE) {
    return jsonResponse({ error: `行程超過 ${MAX_SIZE / 1024}KB 上限` }, 413);
  }

  await env.TRIPS.put(`u:${userId}:trip:${tripId}`, json);
  return jsonResponse({ ok: true });
}

export async function onRequestDelete(context: PagesContext): Promise<Response> {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const userId = parseUserId(url);
  if (!userId) return jsonResponse({ error: '無效的同步 ID' }, 400);
  const tripId = parseTripId(params);
  if (!tripId) return jsonResponse({ error: '無效的行程 ID' }, 400);
  if (!env.TRIPS) return jsonResponse({ error: 'KV 未設定' }, 500);

  await env.TRIPS.delete(`u:${userId}:trip:${tripId}`);
  return jsonResponse({ ok: true });
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
