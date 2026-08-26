// GET /api/trips（只允許已登入的同源 session）

interface KVNamespace {
  get(key: string): Promise<string | null>;
  list(opts: { prefix: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

import { requirePrivateAccess, privateJson, type AuthEnv } from '../../_lib/auth';

type Env = AuthEnv & { TRIPS?: KVNamespace; };

type PagesContext = {
  request: Request;
  env: Env;
};

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const access = await requirePrivateAccess(request, env);
  if (access instanceof Response) return access;
  if (!env.TRIPS) return privateJson({ error: '資料服務暫時無法使用' }, 503);

  const prefix = `u:${access.dataNamespaceId}:trip:`;
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

  return privateJson(trips);
}
