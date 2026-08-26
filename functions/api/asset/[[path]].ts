// GET / DELETE /api/asset/<key>（只允許已登入的同源 session）
// 取回或刪除 R2 上的圖。
//
// 授權跟本專案其他 API 同一套：靠網址上的帳號雜湊 u。
// 物件 key 本身以 `u/<雜湊>/` 開頭，取圖時一定要對得起來，
// 才不會有人拿別人的 key 配自己的 u 就把別人的入境 QR 抓走。

interface R2ObjectBody {
  body: ReadableStream;
  size: number;
  httpMetadata?: { contentType?: string };
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
}

import { requirePrivateAccess, privateJson, type AuthEnv } from '../../_lib/auth';

interface Env extends AuthEnv { MEDIA?: R2Bucket; }

type PagesContext = {
  request: Request;
  env: Env;
  params: { path?: string | string[] };
};

/** 確認物件 key 屬於伺服器端資料命名空間。 */
function resolve(context: PagesContext, dataNamespaceId: string): { key: string } | null {
  const raw = context.params.path;
  const key = (Array.isArray(raw) ? raw.join('/') : raw ?? '').trim();
  if (!key || key.includes('..')) return null;
  if (!key.startsWith(`u/${dataNamespaceId}/`)) return null;
  return { key };
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const access = await requirePrivateAccess(context.request, context.env);
  if (access instanceof Response) return access;
  const r = resolve(context, access.dataNamespaceId);
  if (!r) return privateJson({ error: '無效的圖片位址' }, 400);
  if (!context.env.MEDIA) return privateJson({ error: '圖片服務暫時無法使用' }, 503);

  const obj = await context.env.MEDIA.get(r.key);
  if (!obj) return privateJson({ error: '找不到圖片' }, 404);

  return new Response(obj.body, {
    status: 200,
    headers: {
      'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
      // key 帶 uuid，內容永不覆寫 → 讓瀏覽器盡量長期快取，出國沒訊號也還看得到
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Vary': 'Cookie',
    },
  });
}

export async function onRequestDelete(context: PagesContext): Promise<Response> {
  const access = await requirePrivateAccess(context.request, context.env);
  if (access instanceof Response) return access;
  const r = resolve(context, access.dataNamespaceId);
  if (!r) return privateJson({ error: '無效的圖片位址' }, 400);
  if (!context.env.MEDIA) return privateJson({ error: '圖片服務暫時無法使用' }, 503);

  await context.env.MEDIA.delete(r.key);
  return privateJson({ ok: true });
}
