import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import QRCode from 'qrcode';
import type { Trip, DayPlan, ItineraryItem, Leg } from '../types/trip';
import type { TransportMode } from '../types/place';

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

interface ShareDayV2 {
  c?: string;
  i: ShareItemV2[];
  l: ShareLeg[];
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
  t: string;
  s: number;
  h?: 1;
  no?: string[];
}

export interface ShareDay {
  c?: string;
  i: ShareItem[];
  l: ShareLeg[];
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

  function getOrAddPlaceIdx(place: ItineraryItem['place']): number {
    const key = place.placeId || `${place.name}|${place.coordinates.lat.toFixed(5)}|${place.coordinates.lng.toFixed(5)}`;
    const existing = placeIndex.get(key);
    if (existing !== undefined) return existing;
    const entry: SharePlace = {
      n: place.name,
      a: place.address,
      la: Number(place.coordinates.lat.toFixed(6)),
      lo: Number(place.coordinates.lng.toFixed(6)),
    };
    if (place.placeId) entry.p = place.placeId;
    if (place.iconEmoji) entry.e = place.iconEmoji;
    const idx = places.length;
    places.push(entry);
    placeIndex.set(key, idx);
    return idx;
  }

  const days: ShareDayV2[] = trip.days.map((d: DayPlan) => {
    const items: ShareItemV2[] = d.items.map((it) => {
      const out: ShareItemV2 = {
        x: getOrAddPlaceIdx(it.place),
        t: it.arrivalTime,
        s: it.stayMinutes,
      };
      if (it.isHotel) out.h = 1;
      if (it.notes && it.notes.length > 0) out.no = it.notes;
      return out;
    });
    const out: ShareDayV2 = {
      i: items,
      l: d.legs.map(shrinkLeg),
    };
    if (d.city) out.c = d.city;
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

export function buildShareUrl(trip: Trip): string {
  const payload = buildSharePayloadV2(trip);
  const json = JSON.stringify(payload);
  const encoded = compressToEncodedURIComponent(json);
  const base = window.location.origin + window.location.pathname;
  return `${base}#view=${encoded}`;
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
            t: it.t,
            s: it.s,
            h: it.h,
            no: it.no,
          };
        }),
        l: d.l,
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

export function decodeShareFromHash(): ShareTrip | null {
  const hash = window.location.hash;
  const m = hash.match(/#view=(.+)/);
  if (!m) return null;
  try {
    const json = decompressFromEncodedURIComponent(m[1]!);
    if (!json) return null;
    const parsed = JSON.parse(json);
    if (!parsed || (parsed.v !== 1 && parsed.v !== 2)) return null;
    return flatten(parsed as SharePayload);
  } catch {
    return null;
  }
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
