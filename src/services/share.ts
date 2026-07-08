import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import QRCode from 'qrcode';
import type { Trip, DayPlan, ItineraryItem, Leg } from '../types/trip';
import type { TransportMode } from '../types/place';
import { printableDayNote } from '../utils/dayNote';

/**
 * v2：把所有不重複地點抽到頂層 `p` 陣列（去重），items 只存 placeIdx 索引。
 * 大幅縮小重複地點佔的空間（例如「Edit Hanmer Springs」出現 4 次只存 1 份）。
 *
 * v1 結構保留向下相容（decode 兩種版本都吃）。
 */

interface SharePlace {
  n: string; // name
  a: string; // address
  la: number; // lat
  lo: number; // lng
  p?: string; // placeId
  e?: string; // iconEmoji
  ph?: string; // phoneNumber（給分享頁面長按複製 / 點擊撥號用）
}

interface ShareItemV2 {
  x: number; // 索引到 sharepayload.p
  t: string; // 抵達時間 HH:MM
  s: number; // 停留分鐘
  h?: 1; // isHotel === true 才存
  no?: string[]; // notes
}

interface ShareLeg {
  m?: TransportMode;
  t?: number;
}

/** 以日為單位的備註（DayPlan.note）：e=圖示 emoji（可無）、t=文字。 */
interface ShareDayNote {
  e?: string;
  t: string;
}

interface ShareDayV2 {
  c?: string;
  i: ShareItemV2[];
  l: ShareLeg[];
  nt?: ShareDayNote;
}

interface SharePayloadV2 {
  v: 2;
  n: string;
  s: string;
  p: SharePlace[];
  d: ShareDayV2[];
}

// v1 結構（向下相容）
interface ShareItemV1 {
  n: string;
  a: string;
  la: number;
  lo: number;
  p?: string;
  t: string;
  s: number;
  h?: 1;
  no?: string[];
}

interface ShareDayV1 {
  c?: string;
  i: ShareItemV1[];
  l: ShareLeg[];
}

interface SharePayloadV1 {
  v: 1;
  n: string;
  s: string;
  d: ShareDayV1[];
}

export type SharePayload = SharePayloadV1 | SharePayloadV2;

/**
 * 對外暴露給 TripViewer 用的「展平後」資料結構。
 * 不管是 v1 還是 v2，decode 完都會給這個 shape，viewer 不需要處理版本差異。
 */
export type { ShareLeg };

export interface ShareItem {
  n: string;
  a: string;
  la: number;
  lo: number;
  p?: string;
  e?: string;
  ph?: string;
  t: string;
  s: number;
  h?: 1;
  no?: string[];
}

export interface ShareDay {
  c?: string;
  i: ShareItem[];
  l: ShareLeg[];
  nt?: ShareDayNote;
}

export interface ShareTrip {
  n: string;
  s: string;
  d: ShareDay[];
}

function shrinkLeg(l: Leg): ShareLeg {
  const out: ShareLeg = {};
  if (l.mode !== 'driving') out.m = l.mode;
  if (l.durationMinutes !== undefined) out.t = l.durationMinutes;
  return out;
}

function buildSharePayloadV2(trip: Trip): SharePayloadV2 {
  // 收集所有不重複地點，依 placeId 去重；若無 placeId 用 (name+lat+lng) 為 key
  const placeIndex = new Map<string, number>();
  const places: SharePlace[] = [];

  function getOrAddPlaceIdx(place: ItineraryItem['place']): number | null {
    // 防呆：座標必須是有限數，否則回 null 讓 caller 跳過這個 item
    const lat = place.coordinates?.lat;
    const lng = place.coordinates?.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.warn('[share] 跳過無效座標的地點：', place);
      return null;
    }
    const key = place.placeId || `${place.name}|${lat.toFixed(5)}|${lng.toFixed(5)}`;
    const existing = placeIndex.get(key);
    if (existing !== undefined) return existing;
    const entry: SharePlace = {
      n: place.name,
      a: place.address,
      la: Number(lat.toFixed(6)),
      lo: Number(lng.toFixed(6)),
    };
    if (place.placeId) entry.p = place.placeId;
    if (place.iconEmoji) entry.e = place.iconEmoji;
    if (place.phoneNumber) entry.ph = place.phoneNumber;
    const idx = places.length;
    places.push(entry);
    placeIndex.set(key, idx);
    return idx;
  }

  const days: ShareDayV2[] = trip.days.map((d: DayPlan) => {
    const items: ShareItemV2[] = [];
    const legs: ShareLeg[] = [];
    let prevOrigIdx = -1;
    d.items.forEach((it, origIdx) => {
      const x = getOrAddPlaceIdx(it.place);
      if (x === null) return; // 無效座標 → 跳過這個 item，不要產生爛資料
      const out: ShareItemV2 = { x, t: it.arrivalTime, s: it.stayMinutes };
      if (it.isHotel) out.h = 1;
      if (it.notes && it.notes.length > 0) out.no = it.notes;
      // 與前一個「保留下來」的站之間補一段 leg，維持 legs.length === items.length - 1。
      // 兩站原本相鄰才沿用原 leg；中間若有被跳過的站則退回預設（無預估時間），避免 leg 錯位。
      if (items.length > 0) {
        const original = prevOrigIdx === origIdx - 1 ? d.legs[origIdx - 1] : undefined;
        legs.push(shrinkLeg(original ?? { mode: 'driving' }));
      }
      items.push(out);
      prevOrigIdx = origIdx;
    });
    const out: ShareDayV2 = { i: items, l: legs };
    if (d.city) out.c = d.city;
    const note = printableDayNote(d);
    if (note) out.nt = note.iconEmoji ? { e: note.iconEmoji, t: note.text } : { t: note.text };
    return out;
  });

  return {
    v: 2,
    n: trip.name,
    s: trip.startDate,
    p: places,
    d: days,
  };
}

/**
 * 舊版「資料壓在 URL hash」的方式。保留是因為朋友手上的舊連結仍要能打開。
 * 新分享預設不再用這個，行程太大會塞不進 QR。
 */
export function buildShareUrlInline(trip: Trip): string {
  const payload = buildSharePayloadV2(trip);
  const json = JSON.stringify(payload);
  const encoded = compressToEncodedURIComponent(json);
  const base = window.location.origin + window.location.pathname;
  return `${base}#view=${encoded}`;
}

/**
 * 把行程上傳到 Cloudflare KV，回傳短 ID。
 * KV 沒設定 / 網路失敗會丟例外，由 caller 處理 fallback。
 */
export async function uploadTrip(trip: Trip, signal?: AbortSignal): Promise<{ id: string }> {
  const payload = buildSharePayloadV2(trip);
  const res = await fetch('/api/trip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    const err: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `上傳失敗（HTTP ${res.status}）`);
  }
  return res.json();
}

/** 上傳行程並回傳短分享 URL（含 #v=<id>）。失敗丟例外。 */
export async function buildShareUrlWithId(trip: Trip, signal?: AbortSignal): Promise<string> {
  const { id } = await uploadTrip(trip, signal);
  const base = window.location.origin + window.location.pathname;
  return `${base}#v=${id}`;
}

function shareCacheKey(id: string): string {
  return `walking.shareCache.${id}`;
}

function readShareCache(id: string): ShareTrip | null {
  try {
    const raw = localStorage.getItem(shareCacheKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || (parsed.v !== 1 && parsed.v !== 2)) return null;
    return flatten(parsed as SharePayload);
  } catch {
    return null;
  }
}

function writeShareCache(id: string, payload: unknown): void {
  try {
    localStorage.setItem(shareCacheKey(id), JSON.stringify(payload));
  } catch {
    // 配額滿 / 無痕，忽略
  }
}

/**
 * 從 KV 取行程（給 TripViewer 用）。
 * 策略：先嘗試網路，成功就更新 localStorage 快取；失敗（離線）退回快取。
 * 都失敗才回 null。
 */
export async function fetchTripById(id: string): Promise<ShareTrip | null> {
  try {
    const res = await fetch(`/api/trip/${encodeURIComponent(id)}`);
    if (res.ok) {
      const parsed = await res.json();
      if (parsed && (parsed.v === 1 || parsed.v === 2)) {
        writeShareCache(id, parsed);
        return flatten(parsed as SharePayload);
      }
    }
  } catch {
    // 離線或網路錯誤
  }
  // fallback: 看 localStorage 有沒有先前看過的快取
  return readShareCache(id);
}

/** 把 v1 或 v2 payload 展平成 viewer 統一用的 ShareTrip 結構 */
function flatten(payload: SharePayload): ShareTrip {
  if (payload.v === 2) {
    return {
      n: payload.n,
      s: payload.s,
      d: payload.d.map((d) => ({
        c: d.c,
        i: d.i.map((it): ShareItem => {
          const p = payload.p[it.x];
          if (!p) {
            return { n: '(未知地點)', a: '', la: 0, lo: 0, t: it.t, s: it.s, h: it.h, no: it.no };
          }
          return {
            n: p.n,
            a: p.a,
            la: p.la,
            lo: p.lo,
            p: p.p,
            e: p.e,
            ph: p.ph,
            t: it.t,
            s: it.s,
            h: it.h,
            no: it.no,
          };
        }),
        l: d.l,
        nt: d.nt,
      })),
    };
  }
  // v1
  return {
    n: payload.n,
    s: payload.s,
    d: payload.d.map((d) => ({
      c: d.c,
      i: d.i.map((it): ShareItem => ({
        n: it.n,
        a: it.a,
        la: it.la,
        lo: it.lo,
        p: it.p,
        t: it.t,
        s: it.s,
        h: it.h,
        no: it.no,
      })),
      l: d.l,
    })),
  };
}

export type ShareHashKind =
  | { type: 'inline'; trip: ShareTrip }
  | { type: 'id'; id: string }
  | null;

/**
 * 解析 URL hash：
 * - `#v=<id>` → 回傳 type='id'，caller 自己 fetchTripById
 * - `#view=<encoded>` → 立刻解壓回傳 type='inline' 的展平 trip（舊連結相容）
 */
export function readShareHash(): ShareHashKind {
  const hash = window.location.hash;
  const mid = hash.match(/#v=([a-f0-9]{6,16})/i);
  if (mid) return { type: 'id', id: mid[1]! };

  const minl = hash.match(/#view=(.+)/);
  if (minl) {
    try {
      const json = decompressFromEncodedURIComponent(minl[1]!);
      if (!json) return null;
      const parsed = JSON.parse(json);
      if (!parsed || (parsed.v !== 1 && parsed.v !== 2)) return null;
      return { type: 'inline', trip: flatten(parsed as SharePayload) };
    } catch {
      return null;
    }
  }
  return null;
}

/** @deprecated 改用 readShareHash + fetchTripById */
export function decodeShareFromHash(): ShareTrip | null {
  const r = readShareHash();
  return r && r.type === 'inline' ? r.trip : null;
}

/** QR Code Data URL（PNG）。資料過大時會拋例外，請 caller 自己接住。 */
export async function generateQRDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 360,
    margin: 2,
    errorCorrectionLevel: 'L', // L 等級容量最大；給內部用，朋友掃描器都吃得到
    color: { dark: '#2C2620', light: '#FAF7F0' },
  });
}
