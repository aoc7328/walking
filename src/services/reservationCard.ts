import type { Ledger, Restaurant } from '../types/ledger';
import { parseDate } from '../utils/date';

type Lang = 'ja' | 'en' | 'zh';

interface Labels {
  heading: string; name: string; datetime: string; channel: string;
  ref: string; booker: string; party: string; contact: string; notes: string; unit: string;
}

const LABELS: Record<Lang, Labels> = {
  ja: { heading: 'ご予約確認', name: '店名', datetime: '日時', channel: '予約方法', ref: '予約番号', booker: '予約者', party: '人数', contact: '連絡先', notes: '備考（食事・言語）', unit: '名' },
  en: { heading: 'Reservation', name: 'Restaurant', datetime: 'Date / Time', channel: 'Booked via', ref: 'Confirmation No.', booker: 'Name', party: 'Party', contact: 'Contact', notes: 'Notes (diet / language)', unit: 'pax' },
  zh: { heading: '訂位卡', name: '餐廳', datetime: '日期時間', channel: '預約管道', ref: '預約編號', booker: '訂位人', party: '人數', contact: '聯絡方式', notes: '備註（飲食・語言）', unit: '位' },
};

const WEEKDAYS: Record<Lang, string[]> = {
  ja: ['日', '月', '火', '水', '木', '金', '土'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  zh: ['日', '一', '二', '三', '四', '五', '六'],
};

/** 常見預約管道的目的地語言對照（品質比機器翻譯穩）。 */
const CHANNEL_MAP: Record<'ja' | 'en', Record<string, string>> = {
  ja: { 秘書: '電話予約（代行）', 白金秘書: '電話予約（コンシェルジュ）', 電話: '電話予約', TabeLog: '食べログ', 食べログ: '食べログ' },
  en: { 秘書: 'Phone (via agent)', 白金秘書: 'Phone (concierge)', 電話: 'Phone', TabeLog: 'Tabelog' },
};

function langForCurrency(currency: string): Lang {
  if (currency === 'JPY') return 'ja';
  if (currency === 'TWD' || currency === 'CNY' || currency === 'HKD') return 'zh';
  return 'en';
}

const cache = new Map<string, string>();

/** 用 MyMemory 免費翻譯（zh-TW → 目的地語言）。失敗或警示就回原文。 */
async function mm(text: string, target: 'ja' | 'en'): Promise<string> {
  const t = text.trim();
  if (!t) return '';
  const key = `${target}:${t}`;
  if (cache.has(key)) return cache.get(key)!;
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(t)}&langpair=${encodeURIComponent('zh-TW|' + target)}`;
    const res = await fetch(url);
    const data = await res.json();
    const out = data?.responseData?.translatedText;
    const ok = typeof out === 'string' && out && !/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(out);
    const result = ok ? out : text;
    cache.set(key, result);
    return result;
  } catch {
    return text;
  }
}

/** 多行文字逐行翻譯，保留換行。 */
async function mmLines(text: string, target: 'ja' | 'en'): Promise<string> {
  const lines = text.split('\n');
  const out = await Promise.all(lines.map((l) => (l.trim() ? mm(l, target) : Promise.resolve(''))));
  return out.join('\n');
}

async function translateChannel(ch: string, target: 'ja' | 'en' | null): Promise<string> {
  if (!ch) return '';
  if (!target) return ch;
  return CHANNEL_MAP[target][ch] ?? mm(ch, target);
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

function row(label: string, value: string): string {
  if (!value) return '';
  return `<tr><td class="k">${esc(label)}</td><td class="v">${esc(value)}</td></tr>`;
}
function rowMultiline(label: string, value: string): string {
  if (!value) return '';
  return `<tr><td class="k">${esc(label)}</td><td class="v">${esc(value).replace(/\n/g, '<br>')}</td></tr>`;
}

function shell(L: Labels, inner: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(L.heading)}</title>
<style>
  body { font-family: 'Noto Sans JP','Noto Sans TC',-apple-system,sans-serif; margin: 0; padding: 24px; color: #1a1a1a; }
  .card { max-width: 440px; margin: 0 auto; border: 1.5px solid #2C4A3D; border-radius: 12px; padding: 22px 26px; }
  h1 { font-size: 17px; letter-spacing: 2px; color: #2C4A3D; margin: 0 0 16px; padding-bottom: 12px; border-bottom: 1px solid #d8d8d8; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 7px 0; vertical-align: top; font-size: 15px; }
  td.k { color: #777; width: 96px; white-space: nowrap; }
  td.v { font-weight: 600; }
  .loading { text-align: center; color: #888; padding: 40px 0; }
  @media print { body { padding: 0; } .card { border: none; } }
</style></head><body>${inner}</body></html>`;
}

async function buildHtml(r: Restaurant, ledger: Ledger, L: Labels, lang: Lang): Promise<string> {
  const res = ledger.reservation ?? {};
  const target: 'ja' | 'en' | null = lang === 'ja' ? 'ja' : lang === 'en' ? 'en' : null;
  const tr = (text: string) => (target ? mm(text, target) : Promise.resolve(text));

  const wd = r.date ? `（${WEEKDAYS[lang][parseDate(r.date).getDay()] ?? ''}）` : '';
  const dt = `${r.date ?? ''}${wd}${r.time ? ` ${r.time}` : ''}`;
  const cuisine = r.cuisine ? await tr(r.cuisine) : '';
  const channel = await translateChannel(r.channel ?? '', target);
  const dietaryRaw = (res.dietaryNote ?? '').trim();
  const dietary = dietaryRaw ? (target ? await mmLines(dietaryRaw, target) : dietaryRaw) : '';

  const booker = r.bookingName || res.bookingName || '';  // 專有名詞，不翻
  const contact = r.contact || res.contact || '';
  const party = r.partySize ?? res.partySize;
  const partyStr = party !== undefined ? `${party} ${L.unit}` : '';

  const body = [
    row(L.name, r.name + (cuisine ? `（${cuisine}）` : '')),
    row(L.datetime, dt),
    row(L.booker, booker),
    row(L.party, partyStr),
    row(L.contact, contact),
    row(L.channel, channel),
    row(L.ref, r.bookingRef ?? ''),
    rowMultiline(L.notes, dietary),
  ].join('');

  return shell(L, `<div class="card"><h1>${esc(L.heading)}</h1><table>${body}</table></div>
<script>setTimeout(function(){window.print();},250);</script>`);
}

/** 開新視窗印出餐廳預訂牌，整張轉成目的地語言（先開視窗顯示「翻譯中」，翻好再寫入）。 */
export function printReservationCard(r: Restaurant, ledger: Ledger): void {
  const lang = (ledger.language as Lang) ?? langForCurrency(ledger.localCurrency);
  const L = LABELS[lang] ?? LABELS.en;
  const w = window.open('', '_blank', 'width=480,height=680');
  if (!w) { window.alert('瀏覽器擋掉了彈出視窗，請允許彈出視窗後再試。'); return; }
  w.document.open();
  w.document.write(shell(L, '<div class="loading">翻訳中… / 翻譯中…</div>'));
  w.document.close();
  buildHtml(r, ledger, L, lang).then((html) => {
    try {
      if (w.closed) return;
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch { /* 視窗被關掉就算了 */ }
  });
}
