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

/** 匯出餐廳預訂清單成 CSV（給秘書用 Excel/Google 表單打開、訂位）。 */
export function exportRestaurantsCSV(ledger: Ledger, tripName: string): void {
  const headers = [
    '日期', '週幾', '時段', '店名', '種類', '預約狀態',
    '訂位人', '人數', '主訂者', '聯絡方式', '預約管道', '預約編號',
    '預估(台幣)', '實際開銷', '幣別', '支付方式', '備註',
  ];
  const pmName = (id?: string) => ledger.paymentMethods.find((p) => p.id === id)?.name ?? '';
  const rows = ledger.restaurants.map((r) => [
    r.date,
    r.date ? weekdayLabel(r.date) : '',
    r.time ?? '',
    r.name,
    r.cuisine,
    RESERVATION_LABEL[r.status],
    r.bookingName ?? '',
    r.partySize ?? '',
    r.leadGuest ?? '',
    r.contact ?? '',
    r.channel ?? '',
    r.bookingRef ?? '',
    r.estimated ?? '',
    r.amount ?? '',
    r.currency ?? '',
    pmName(r.paymentMethodId),
    r.note ?? '',
  ]);
  const csv = [headers, ...rows].map((line) => line.map(csvCell).join(',')).join('\r\n');
  triggerDownload(`${tripName}-餐廳預訂.csv`, csv, 'text/csv');
}
