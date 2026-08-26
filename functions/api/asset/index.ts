// POST /api/asset?trip=<tripId>（只允許已登入的同源 session）
// 上傳一張圖（票券 QR / Visit Japan Web 入境 QR / 訂位截圖）到 R2，回傳物件 key。
//
// 為什麼不塞進 trip JSON：base64 圖動輒數百 KB，會撞 KV 的 500KB 上限
//（Visit Japan Web 的 QR 原本就是因為這樣才被迫「不存雲端、重整就消失」）。
// 圖進 R2，trip 裡只留 key，兩邊各司其職。

interface R2Object {
  key: string;
}

interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer,
    opts?: { httpMetadata?: { contentType?: string } },
  ): Promise<R2Object>;
}

import { requirePrivateAccess, privateJson, type AuthEnv } from '../../_lib/auth';

interface Env extends AuthEnv { MEDIA?: R2Bucket; }

type PagesContext = {
  request: Request;
  env: Env;
};

const TRIP_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
const MAX_SIZE = 5 * 1024 * 1024; // 單張圖上限 5MB

/** 允許的圖片型別 → 副檔名。只收圖片，不當通用檔案空間。 */
const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const access = await requirePrivateAccess(request, env);
  if (access instanceof Response) return access;

  const tripId = (url.searchParams.get('trip') ?? '').trim();
  if (!TRIP_ID_RE.test(tripId)) return privateJson({ error: '無效的行程 ID' }, 400);

  if (!env.MEDIA) return privateJson({ error: '圖片服務暫時無法使用' }, 503);

  const contentType = (request.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  const ext = EXT[contentType];
  if (!ext) return privateJson({ error: '只接受 PNG / JPEG / WebP / GIF 圖片' }, 415);

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) return privateJson({ error: '空的檔案' }, 400);
  if (bytes.byteLength > MAX_SIZE) {
    return privateJson({ error: `圖片超過 ${MAX_SIZE / 1024 / 1024}MB 上限` }, 413);
  }

  // key 帶使用者雜湊當前綴：讀取時就是靠這個前綴確認「這張圖是不是你的」
  const key = `u/${access.dataNamespaceId}/${tripId}/${crypto.randomUUID()}.${ext}`;
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType } });

  return privateJson({ key });
}
