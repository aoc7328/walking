import Anthropic from '@anthropic-ai/sdk';
import type { Env } from '../lib/env';
import { json } from '../lib/http';
import { requireUser } from '../lib/session';

/**
 * 發票自動判讀：把上傳的收據照片交給 Claude，回傳一項項的明細。
 *
 * 為什麼值得做：使用者掃了發票之後還要自己一行行打日文品名，那是整個代買分帳
 * 最勸退的一步。人工校正還是留著，但預設應該是「AI 先填好、人只改錯的」。
 *
 * 這支只回傳結果，不直接寫進行程——要讓使用者看過、改過再套用。
 */

/** 單張圖上限；跟 asset 上傳一致。 */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** 一次最多讀幾張（長收據會分開拍）。 */
const MAX_IMAGES = 6;

const SYSTEM = `你在讀一張消費收據的照片，要把上面的商品明細抄成結構化資料。

規則：
- 只抄商品行。小計、合計、稅額、找零、信用卡資訊都不是商品行。
- 購物袋費（レジ袋代之類）算一個商品行。
- price 填「實際會付的單價」：有折扣就填折扣後的單價，不是原價。
- 同一個商品在收據上分行列出時，合併成一行並把 qty 相加。
- label 照收據上的字抄，不要翻譯、不要自己補字。
- 看不清楚的字用 ? 代替，不要猜一個像的商品名。
- 所有 price × qty 的總和應該等於使用者提供的刷卡金額。如果對不上，
  照你實際看到的抄，不要為了湊數字去改，也不要捏造不存在的行。`;

interface ScanLine {
  label: string;
  price: number;
  qty: number;
}

const SCHEMA = {
  type: 'object' as const,
  properties: {
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: '商品名稱，照收據原文' },
          price: { type: 'number', description: '折扣後的單價' },
          qty: { type: 'integer', description: '數量' },
        },
        required: ['label', 'price', 'qty'],
        additionalProperties: false,
      },
    },
    storeName: { type: 'string', description: '店名，讀不到就空字串' },
    unreadable: { type: 'boolean', description: '照片糊到沒把握時設 true' },
  },
  required: ['lines', 'storeName', 'unreadable'],
  additionalProperties: false,
};

const MEDIA_TYPES: Record<string, 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/**
 * POST /api/receipt-scan
 * body: { keys: string[], amount: number, currency: string }
 *
 * keys 是已經上傳到 R2 的發票照片（必須屬於這個使用者）。
 * amount 是這筆支出實際刷掉的金額——拿來對帳用，這是這支 API 最有價值的地方：
 * 明細加總對得上就代表判讀正確，對不上就把差額講出來讓人去看。
 */
export async function scan(request: Request, env: Env): Promise<Response> {
  const userId = await requireUser(request, env);
  if (userId instanceof Response) return userId;
  if (!env.ANTHROPIC_API_KEY) return json({ error: '發票判讀服務尚未設定' }, 503);

  let body: { keys?: unknown; amount?: unknown; currency?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: '不是合法的 JSON' }, 400);
  }

  const keys = Array.isArray(body.keys) ? body.keys.filter((k): k is string => typeof k === 'string') : [];
  const amount = typeof body.amount === 'number' && Number.isFinite(body.amount) ? Math.round(body.amount) : 0;
  const currency = typeof body.currency === 'string' ? body.currency : 'JPY';

  if (keys.length === 0) return json({ error: '沒有指定發票照片' }, 400);
  if (keys.length > MAX_IMAGES) return json({ error: `一次最多讀 ${MAX_IMAGES} 張` }, 400);
  // key 前綴必須是自己的——不然任何人都能拿別人的 key 來讀別人的收據
  if (keys.some((k) => !k.startsWith(`u/${userId}/`))) return json({ error: '無效的圖片位址' }, 400);

  const images: { media_type: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; data: string }[] = [];
  for (const key of keys) {
    const obj = await env.MEDIA.get(key);
    if (!obj) return json({ error: `找不到圖片：${key}` }, 404);
    if (obj.size > MAX_IMAGE_BYTES) return json({ error: '圖片太大' }, 413);
    const ext = key.split('.').pop()?.toLowerCase() ?? '';
    const mediaType = MEDIA_TYPES[ext];
    if (!mediaType) return json({ error: '不支援的圖片格式' }, 415);
    const buf = new Uint8Array(await new Response(obj.body).arrayBuffer());
    images.push({ media_type: mediaType, data: bytesToBase64(buf) });
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const model = env.OCR_MODEL || 'claude-opus-5';

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            ...images.map((img) => ({
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: img.media_type, data: img.data },
            })),
            {
              type: 'text' as const,
              text:
                images.length > 1
                  ? `這 ${images.length} 張是同一張收據分開拍的，由上到下接續，請合併成一份明細。這筆實際付了 ${amount} ${currency}。`
                  : `這筆實際付了 ${amount} ${currency}。`,
            },
          ],
        },
      ],
    });

    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return json({ error: '判讀沒有回傳內容' }, 502);

    const parsed = JSON.parse(text.text) as { lines?: ScanLine[]; storeName?: string; unreadable?: boolean };
    const lines = (parsed.lines ?? []).filter(
      (l) => l && typeof l.label === 'string' && Number.isFinite(l.price) && Number.isFinite(l.qty),
    );

    const subtotal = lines.reduce((s, l) => s + Math.round(l.price) * Math.max(1, Math.round(l.qty)), 0);
    const diff = amount - subtotal;

    return json({
      lines: lines.map((l) => ({ label: l.label, price: Math.round(l.price), qty: Math.max(1, Math.round(l.qty)) })),
      storeName: parsed.storeName ?? '',
      unreadable: parsed.unreadable === true,
      subtotal,
      amount,
      diff,
      /**
       * 對帳結果。明細加總等於刷卡金額 → 幾乎可以確定判讀正確，直接套用；
       * 對不上 → 前端用既有的橘色差額提示要使用者看一眼。
       */
      reconciled: amount > 0 && diff === 0,
      model,
      usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: '判讀服務忙碌中，稍後再試' }, 429);
    if (err instanceof Anthropic.APIError) return json({ error: `判讀失敗（${err.status}）` }, 502);
    return json({ error: '判讀失敗' }, 502);
  }
}
