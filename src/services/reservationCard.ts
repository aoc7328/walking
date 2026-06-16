import type { Ledger, Restaurant } from '../types/ledger';
import { weekdayLabel } from '../utils/date';

type Lang = 'ja' | 'en' | 'zh';

interface Labels {
  heading: string; name: string; datetime: string; channel: string;
  ref: string; booker: string; party: string; notes: string; unit: string;
}

const LABELS: Record<Lang, Labels> = {
  ja: { heading: 'ご予約確認', name: '店名', datetime: '日時', channel: '予約サイト', ref: '予約番号', booker: '予約者', party: '人数', notes: '備考', unit: '名' },
  en: { heading: 'Reservation', name: 'Restaurant', datetime: 'Date / Time', channel: 'Booked via', ref: 'Confirmation No.', booker: 'Name', party: 'Party', notes: 'Notes', unit: 'pax' },
  zh: { heading: '訂位卡', name: '餐廳', datetime: '日期時間', channel: '預約管道', ref: '預約編號', booker: '訂位人', party: '人數', notes: '備註', unit: '位' },
};

/** 目的地貨幣 → 卡片語言（依目的地自動切換）。 */
function langForCurrency(currency: string): Lang {
  if (currency === 'JPY') return 'ja';
  if (currency === 'TWD' || currency === 'CNY' || currency === 'HKD') return 'zh';
  return 'en';
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

function row(label: string, value: string): string {
  if (!value) return '';
  return `<tr><td class="k">${esc(label)}</td><td class="v">${esc(value)}</td></tr>`;
}

/** 開新視窗印出一張餐廳預訂牌，標籤依目的地語言自動切換。 */
export function printReservationCard(r: Restaurant, ledger: Ledger): void {
  const lang = (ledger.language as Lang) ?? langForCurrency(ledger.localCurrency);
  const L = LABELS[lang] ?? LABELS.en;
  const res = ledger.reservation ?? {};
  const dt = `${r.date}${r.date ? `（${weekdayLabel(r.date)}）` : ''}${r.time ? ` ${r.time}` : ''}`;
  const booker = r.bookingName ?? res.bookingName ?? '';
  const party = r.partySize ?? res.partySize;
  const partyStr = party !== undefined ? `${party} ${L.unit}` : '';
  const notes = [r.note, res.dietaryNote].filter(Boolean).join('　/　');

  const body = [
    row(L.name, r.name + (r.cuisine ? `（${r.cuisine}）` : '')),
    row(L.datetime, dt),
    row(L.channel, r.channel ?? ''),
    row(L.ref, r.bookingRef ?? ''),
    row(L.booker, booker),
    row(L.party, partyStr),
    row(L.notes, notes),
  ].join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.name)}</title>
<style>
  body { font-family: 'Noto Sans JP','Noto Sans TC',-apple-system,sans-serif; margin: 0; padding: 24px; color: #1a1a1a; }
  .card { max-width: 420px; margin: 0 auto; border: 1.5px solid #2C4A3D; border-radius: 12px; padding: 22px 26px; }
  h1 { font-size: 17px; letter-spacing: 2px; color: #2C4A3D; margin: 0 0 16px; padding-bottom: 12px; border-bottom: 1px solid #d8d8d8; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 7px 0; vertical-align: top; font-size: 15px; }
  td.k { color: #777; width: 90px; white-space: nowrap; }
  td.v { font-weight: 600; }
  @media print { body { padding: 0; } .card { border: none; } }
</style></head><body><div class="card"><h1>${esc(L.heading)}</h1><table>${body}</table></div>
<script>window.onload=function(){setTimeout(function(){window.print();},150);};</script></body></html>`;

  const w = window.open('', '_blank', 'width=480,height=640');
  if (!w) { window.alert('瀏覽器擋掉了彈出視窗，請允許彈出視窗後再試。'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
