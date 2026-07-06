import type { Ledger } from '../types/ledger';
import { RESERVATION_LABEL } from '../utils/ledger';
import { weekdayLabel } from '../utils/date';

/** 把一格內容轉成安全的 CSV 欄位（含逗號/引號/換行就用引號包起來）。 */
function csvCell(value: string | number | undefined | null): string {
  const s = value === undefined || value === null ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function triggerDownload(filename: string, content: string, mime: string): void {
  const blob = new Blob(['﻿' + content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type RestaurantCsvMode = 'all' | 'secretary';

/**
 * 匯出餐廳預訂清單成 CSV。
 * - 'all'：完整欄位（含預估/實際金額、支付方式），給自己對帳。
 * - 'secretary'：只給秘書訂位需要的欄位（不含金額/支付），加上飲食/語言需求。
 */
export function exportRestaurantsCSV(ledger: Ledger, tripName: string, mode: RestaurantCsvMode = 'all'): void {
  const pmName = (id?: string) => ledger.paymentMethods.find((p) => p.id === id)?.name ?? '';
  const res = ledger.reservation ?? {};
  const bookingName = (r: Ledger['restaurants'][number]) => r.bookingName ?? res.bookingName ?? '';
  const partySize = (r: Ledger['restaurants'][number]) => r.partySize ?? res.partySize ?? '';
  const contact = (r: Ledger['restaurants'][number]) => r.contact ?? res.contact ?? '';

  if (mode === 'secretary') {
    const headers = ['日期', '週幾', '時段', '店名', '種類', '預約狀態', '訂位人', '人數', '聯絡方式', 'Email', '預約管道', '預約編號', '備註', '飲食 / 語言需求'];
    const rows = ledger.restaurants.map((r) => [
      r.date, r.date ? weekdayLabel(r.date) : '', r.time ?? '', r.name, r.cuisine,
      RESERVATION_LABEL[r.status], bookingName(r), partySize(r), contact(r), res.email ?? '',
      r.channel ?? '', r.bookingRef ?? '', r.note ?? '', res.dietaryNote ?? '',
    ]);
    const csv = [headers, ...rows].map((line) => line.map(csvCell).join(',')).join('\r\n');
    triggerDownload(`${tripName}-餐廳預訂-給秘書.csv`, csv, 'text/csv');
    return;
  }

  const headers = [
    '日期', '週幾', '時段', '店名', '種類', '預約狀態',
    '訂位人', '人數', '聯絡方式', 'Email', '預約管道', '預約編號',
    '預估(台幣)', '實際開銷', '幣別', '支付方式', '備註',
  ];
  const rows = ledger.restaurants.map((r) => [
    r.date, r.date ? weekdayLabel(r.date) : '', r.time ?? '', r.name, r.cuisine, RESERVATION_LABEL[r.status],
    bookingName(r), partySize(r), contact(r), res.email ?? '',
    r.channel ?? '', r.bookingRef ?? '',
    r.estimated ?? '', r.amount ?? '', r.currency ?? '', pmName(r.paymentMethodId), r.note ?? '',
  ]);
  const csv = [headers, ...rows].map((line) => line.map(csvCell).join(',')).join('\r\n');
  triggerDownload(`${tripName}-餐廳預訂.csv`, csv, 'text/csv');
}
