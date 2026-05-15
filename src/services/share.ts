import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import QRCode from 'qrcode';
import type { Trip, DayPlan, ItineraryItem, Leg } from '../types/trip';
import type { TransportMode } from '../types/place';

/**
 * 縮減版行程資料：拿掉 photoUrls、reviews、openingHours 等龐大欄位，
 * 用短欄位名以利壓縮後可放進 QR Code（QR binary 上限約 2.9KB）。
 */
interface ShareItem {
  n: string; // 地點名稱
  a: string; // 地址
  la: number; // lat
  lo: number; // lng
  p?: string; // placeId（給 Google Maps 連結用）
  t: string; // 抵達時間 HH:MM
  s: number; // 停留分鐘
  h?: 1; // isHotel === true 才存
  no?: string[]; // notes（有才存）
}

interface ShareLeg {
  m?: TransportMode; // mode（不為 driving 才存）
  t?: number; // durationMinutes
}

interface ShareDay {
  c?: string; // city
  i: ShareItem[];
  l: ShareLeg[];
}

interface SharePayload {
  v: 1;
  n: string; // trip name
  s: string; // startDate
  d: ShareDay[];
}

function shrinkItem(it: ItineraryItem): ShareItem {
  const out: ShareItem = {
    n: it.place.name,
    a: it.place.address,
    la: Number(it.place.coordinates.lat.toFixed(6)),
    lo: Number(it.place.coordinates.lng.toFixed(6)),
    t: it.arrivalTime,
    s: it.stayMinutes,
  };
  if (it.place.placeId) out.p = it.place.placeId;
  if (it.isHotel) out.h = 1;
  if (it.notes && it.notes.length > 0) out.no = it.notes;
  return out;
}

function shrinkLeg(l: Leg): ShareLeg {
  const out: ShareLeg = {};
  if (l.mode !== 'driving') out.m = l.mode;
  if (l.durationMinutes !== undefined) out.t = l.durationMinutes;
  return out;
}

function shrinkDay(d: DayPlan): ShareDay {
  const out: ShareDay = {
    i: d.items.map(shrinkItem),
    l: d.legs.map(shrinkLeg),
  };
  if (d.city) out.c = d.city;
  return out;
}

export function buildSharePayload(trip: Trip): SharePayload {
  return {
    v: 1,
    n: trip.name,
    s: trip.startDate,
    d: trip.days.map(shrinkDay),
  };
}

/** 把行程轉成可分享的完整 URL（含 hash 路由） */
export function buildShareUrl(trip: Trip): string {
  const payload = buildSharePayload(trip);
  const json = JSON.stringify(payload);
  const encoded = compressToEncodedURIComponent(json);
  const base = window.location.origin + window.location.pathname;
  return `${base}#view=${encoded}`;
}

/** 從 URL hash 還原 SharePayload，失敗回 null */
export function decodeShareFromHash(): SharePayload | null {
  const hash = window.location.hash;
  const m = hash.match(/#view=(.+)/);
  if (!m) return null;
  try {
    const json = decompressFromEncodedURIComponent(m[1]!);
    if (!json) return null;
    const parsed = JSON.parse(json);
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.d)) return null;
    return parsed as SharePayload;
  } catch {
    return null;
  }
}

/** 產生 QR Code Data URL（PNG），用於 <img> 顯示與下載 */
export async function generateQRDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 360,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#2C2620', light: '#FAF7F0' },
  });
}

export type { SharePayload, ShareDay, ShareItem, ShareLeg };
