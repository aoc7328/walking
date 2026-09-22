// GET/PUT/DELETE /api/trips/:id（只允許已登入的同源 session）

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

import { requirePrivateAccess, privateJson, type AuthEnv } from '../../_lib/auth';

type Env = AuthEnv & { TRIPS?: KVNamespace; };

type PagesContext = {
  request: Request;
  env: Env;
  params: { id?: string | string[] };
};

const TRIP_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
// 2 MB 而不是 500 KB：沖繩那趟（18 天、98 站）已經 398 KB，再長一點就存不進去。
// KV 單筆本身允許 25 MB，500 KB 是我們自己設的，設得太保守。
const MAX_SIZE = 2 * 1024 * 1024;

function parseTripId(params: PagesContext['params']): string | null {
  const raw = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = (raw ?? '').trim();
  return TRIP_ID_RE.test(id) ? id : null;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env, params } = context;
  const access = await requirePrivateAccess(request, env);
  if (access instanceof Response) return access;
  const tripId = parseTripId(params);
  if (!tripId) return privateJson({ error: '無效的行程 ID' }, 400);
  if (!env.TRIPS) return privateJson({ error: '資料服務暫時無法使用' }, 503);

  const raw = await env.TRIPS.get(`u:${access.dataNamespaceId}:trip:${tripId}`);
  if (!raw) return privateJson({ error: '找不到行程' }, 404);
  return privateJson(JSON.parse(raw));
}

export async function onRequestPut(context: PagesContext): Promise<Response> {
  const { request, env, params } = context;
  const access = await requirePrivateAccess(request, env);
  if (access instanceof Response) return access;
  const tripId = parseTripId(params);
  if (!tripId) return privateJson({ error: '無效的行程 ID' }, 400);
  if (!env.TRIPS) return privateJson({ error: '資料服務暫時無法使用' }, 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: '不是合法的 JSON' }, 400);
  }

  const json = JSON.stringify(body);
  if (json.length > MAX_SIZE) {
    return privateJson({ error: `行程超過 ${MAX_SIZE / 1024}KB 上限` }, 413);
  }

  await env.TRIPS.put(`u:${access.dataNamespaceId}:trip:${tripId}`, json);
  return privateJson({ ok: true });
}

export async function onRequestDelete(context: PagesContext): Promise<Response> {
  const { request, env, params } = context;
  const access = await requirePrivateAccess(request, env);
  if (access instanceof Response) return access;
  const tripId = parseTripId(params);
  if (!tripId) return privateJson({ error: '無效的行程 ID' }, 400);
  if (!env.TRIPS) return privateJson({ error: '資料服務暫時無法使用' }, 503);

  await env.TRIPS.delete(`u:${access.dataNamespaceId}:trip:${tripId}`);
  return privateJson({ ok: true });
}
