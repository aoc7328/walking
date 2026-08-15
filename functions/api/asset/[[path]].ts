// GET / DELETE /api/asset/<key>?u=<userId>
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

interface Env {
  MEDIA?: R2Bucket;
}

type PagesContext = {
  request: Request;
  env: Env;
  params: { path?: string | string[] };
};

const USER_ID_RE = /^[a-f0-9]{16,64}$/i;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/** 解析出 (key, userId)，並確認這個 key 屬於這個帳號。不合法一律回 null。 */
function resolve(context: PagesContext): { key: string; userId: string } | null {
  const url = new URL(context.request.url);
  const u = (url.searchParams.get('u') ?? '').toLowerCase();
  if (!USER_ID_RE.test(u)) return null;

  const raw = context.params.path;
  const key = (Array.isArray(raw) ? raw.join('/') : raw ?? '').trim();
  if (!key || key.includes('..')) return null;
  if (!key.startsWith(`u/${u}/`)) return null;
  return { key, userId: u };
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const r = resolve(context);
  if (!r) return jsonResponse({ error: '無效的圖片位址' }, 400);
  if (!context.env.MEDIA) return jsonResponse({ error: 'R2 未設定（Pages 專案要綁 MEDIA）' }, 500);

  const obj = await context.env.MEDIA.get(r.key);
  if (!obj) return jsonResponse({ error: '找不到圖片' }, 404);

  return new Response(obj.body, {
    status: 200,
    headers: {
      'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
      // key 帶 uuid，內容永不覆寫 → 讓瀏覽器盡量長期快取，出國沒訊號也還看得到
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}

export async function onRequestDelete(context: PagesContext): Promise<Response> {
  const r = resolve(context);
  if (!r) return jsonResponse({ error: '無效的圖片位址' }, 400);
  if (!context.env.MEDIA) return jsonResponse({ error: 'R2 未設定（Pages 專案要綁 MEDIA）' }, 500);

  await context.env.MEDIA.delete(r.key);
  return jsonResponse({ ok: true });
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
