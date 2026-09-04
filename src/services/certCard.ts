import type { CertKind, CertRequest, Ledger } from '../types/ledger';
import { addDays, parseDate } from '../utils/date';
import { translateLines, type TranslateTarget } from './translate';

/**
 * 證明文件申請牌：颱風打亂行程後，跟飯店／航空／船公司要理賠用證明的那張牌。
 *
 * 語言不通時的解法是「不要開口，直接給對方看畫面」，所以：
 * - 請求文一律用下面手寫的固定句型，**不經機器翻譯**。現場沒訊號也一定顯示得出來，
 *   而且句子的禮貌程度與用詞（宿泊証明書／遅延証明書／欠航証明書）是對方認得的正式名稱。
 * - 只有使用者自己打的「補充」是自由文字，才走 translate.ts；翻不到就原樣顯示中文。
 * - 牌底附中文對照，讓自己知道正在請對方做什麼。
 *
 * 電腦版列印與手機版全螢幕出示共用 buildCertCard()，兩邊內容必然一致。
 */

type Lang = 'ja' | 'en' | 'zh';

interface CertLabels {
  heading: string;
  /** 開場白：先講「我不會你們的語言」，對方才知道為什麼被塞一支手機。 */
  intro: string;
  docName: Record<CertKind, string>;
  body: Record<CertKind, string[]>;
  fields: { target: string; service: string; date: string; ref: string; name: string; party: string; note: string };
  /** 兩人以上同行時附加的一句：證明上要把同行者的姓名一起列出來。 */
  multiName: (n: number) => string;
  thanks: string;
  unit: string;
}

const LABELS: Record<Lang, CertLabels> = {
  ja: {
    heading: '証明書発行のお願い',
    intro: '日本語が話せません。お手数ですが、この画面をお読みください。',
    docName: {
      stay: '宿泊証明書',
      delay: '遅延証明書',
      cancel: '欠航（運休）証明書',
      other: '証明書',
    },
    body: {
      stay: [
        '台風の影響で旅程が変更になりました。',
        '海外旅行保険の請求に必要なため、下記の宿泊について「宿泊証明書」（施設名・宿泊者名・宿泊日が記載されたもの）を発行していただけますでしょうか。',
        '書面が難しい場合は、メールでの送付でも構いません。',
      ],
      delay: [
        '台風の影響で、下記の便が遅延しました。',
        '海外旅行保険の請求に必要なため、「遅延証明書」（便名・出発予定時刻・実際の出発時刻・遅延理由が記載されたもの）を発行していただけますでしょうか。',
        'この場で受け取れない場合は、後日メールで送っていただく方法を教えてください。',
      ],
      cancel: [
        '台風の影響で、下記の便が欠航になりました。',
        '海外旅行保険の請求に必要なため、「欠航証明書」（便名・運航予定日・欠航理由が記載されたもの）を発行していただけますでしょうか。',
        'あわせて、乗車券・乗船券・航空券の払い戻し方法も教えていただけますと助かります。',
      ],
      other: [
        '台風の影響で旅程が変更になりました。',
        '海外旅行保険の請求に必要なため、下記の件について証明書を発行していただけますでしょうか。',
      ],
    },
    fields: { target: '施設・会社名', service: '便名・航路', date: '日付', ref: '予約番号', name: '氏名', party: '人数', note: '補足' },
    multiName: (n) => `証明書には、同行者を含む${n}名分の氏名をご記載いただけますでしょうか。`,
    thanks: 'お手数をおかけしますが、よろしくお願いいたします。',
    unit: '名',
  },
  en: {
    heading: 'Request for a Certificate',
    intro: "I'm sorry — I don't speak the local language. Could you please read this screen?",
    docName: {
      stay: 'Certificate of Stay',
      delay: 'Delay Certificate',
      cancel: 'Cancellation Certificate',
      other: 'Certificate',
    },
    body: {
      stay: [
        'Our trip was disrupted by the typhoon.',
        'For our travel insurance claim, could you please issue a certificate of stay showing the property name, guest name and the dates of stay?',
        'If a printed copy is difficult, sending it by email is also fine.',
      ],
      delay: [
        'The service below was delayed because of the typhoon.',
        'For our travel insurance claim, could you please issue a delay certificate showing the flight number, the scheduled departure time, the actual departure time and the reason for the delay?',
        'If it cannot be issued here, please tell me how to receive it by email.',
      ],
      cancel: [
        'The service below was cancelled because of the typhoon.',
        'For our travel insurance claim, could you please issue a cancellation certificate showing the service name, the scheduled date and the reason for the cancellation?',
        'Could you also tell me how to request a refund for the ticket?',
      ],
      other: [
        'Our trip was disrupted by the typhoon.',
        'For our travel insurance claim, could you please issue a certificate for the item below?',
      ],
    },
    fields: { target: 'Hotel / Company', service: 'Flight / Route', date: 'Date', ref: 'Booking No.', name: 'Name', party: 'Party', note: 'Note' },
    multiName: (n) => `Please include the names of all ${n} travellers on the certificate.`,
    thanks: 'Thank you very much for your help.',
    unit: 'pax',
  },
  zh: {
    heading: '證明文件申請',
    intro: '不好意思，想麻煩您看一下這個畫面。',
    docName: {
      stay: '住宿證明',
      delay: '延誤證明',
      cancel: '取消（停駛）證明',
      other: '證明文件',
    },
    body: {
      stay: [
        '本次行程受颱風影響而變更。',
        '因為要申請旅遊保險理賠，能否請您開立住宿證明（載明住宿地點名稱、住宿人姓名與住宿日期）？',
        '如果不方便列印，用 Email 寄給我也可以。',
      ],
      delay: [
        '下列班次因颱風影響而延誤。',
        '因為要申請旅遊保險理賠，能否請您開立延誤證明（載明班次、原定出發時刻、實際出發時刻與延誤原因）？',
        '如果現場沒辦法開立，也請告訴我之後可以怎麼用 Email 索取。',
      ],
      cancel: [
        '下列班次因颱風影響而取消。',
        '因為要申請旅遊保險理賠，能否請您開立取消證明（載明班次、原定航行日期與取消原因）？',
        '另外也想請教票券的退費方式。',
      ],
      other: [
        '本次行程受颱風影響而變更。',
        '因為要申請旅遊保險理賠，能否請您就下列事項開立證明文件？',
      ],
    },
    fields: { target: '住宿／公司', service: '班次／航線', date: '日期', ref: '訂位編號', name: '姓名', party: '人數', note: '補充' },
    multiName: (n) => `證明上請一併載明 ${n} 位同行者的姓名。`,
    thanks: '麻煩您了，非常感謝。',
    unit: '位',
  },
};

/** 中文對照用（自己看的那一面）。 */
const ZH_KIND: Record<CertKind, string> = {
  stay: '住宿證明',
  delay: '延誤證明',
  cancel: '取消／停駛證明',
  other: '證明文件',
};

export const CERT_KIND_LABEL: Record<CertKind, string> = {
  stay: '住宿證明',
  delay: '延誤證明（班機・列車）',
  cancel: '取消證明（停駛・欠航）',
  other: '其他證明',
};

/** 下拉選單用（順序＝這趟最常用到的順序）。 */
export const CERT_KIND_OPTIONS: { value: CertKind; label: string }[] = [
  { value: 'stay', label: CERT_KIND_LABEL.stay },
  { value: 'delay', label: CERT_KIND_LABEL.delay },
  { value: 'cancel', label: CERT_KIND_LABEL.cancel },
  { value: 'other', label: CERT_KIND_LABEL.other },
];

const WEEKDAYS: Record<Lang, string[]> = {
  ja: ['日', '月', '火', '水', '木', '金', '土'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  zh: ['日', '一', '二', '三', '四', '五', '六'],
};

function langForCurrency(currency: string): Lang {
  if (currency === 'JPY') return 'ja';
  if (currency === 'TWD' || currency === 'CNY' || currency === 'HKD') return 'zh';
  return 'en';
}

export function certLang(ledger: Ledger): Lang {
  const l = ledger.language;
  if (l === 'ja' || l === 'en' || l === 'zh') return l;
  return langForCurrency(ledger.localCurrency);
}

/** 目的地語言就是中文時不必翻譯（也沒有可翻的目標）。 */
export function certTranslateTarget(lang: Lang): TranslateTarget | null {
  return lang === 'ja' ? 'ja' : lang === 'en' ? 'en' : null;
}

function withWeekday(iso: string, lang: Lang): string {
  const wd = WEEKDAYS[lang][parseDate(iso).getDay()];
  return wd ? `${iso}（${wd}）` : iso;
}

export interface CertCardRow {
  label: string;
  value: string;
  multiline?: boolean;
}

export interface CertCardData {
  lang: Lang;
  heading: string;
  intro: string;
  /** 要對方開哪一種文件（大字，牌面重點）。 */
  docName: string;
  body: string[];
  rows: CertCardRow[];
  thanks: string;
  /** 牌底的中文對照，給自己確認正在請對方做什麼。 */
  zhSummary: string;
  /** 「補充」在 rows 裡的索引；沒有補充時為 -1（翻譯完要換掉這一列）。 */
  noteRowIndex: number;
}

/**
 * 產一張證明申請牌。**同步**——請求文全是固定句型，不等網路。
 *
 * 使用者自己打的補充（中文）先原樣放進去，呼叫端要的話再用 translateCertNote()
 * 非同步換成當地語言。這樣沒訊號時牌照樣完整，有訊號時只是更好懂。
 */
export function buildCertCard(cert: CertRequest, ledger: Ledger): CertCardData {
  const lang = certLang(ledger);
  const L = LABELS[lang];
  const res = ledger.reservation ?? {};

  let dateStr = '';
  if (cert.kind === 'stay' && cert.date) {
    const end = cert.endDate || addDays(cert.date, 1);
    dateStr = `${withWeekday(cert.date, lang)} 〜 ${withWeekday(end, lang)}`;
  } else if (cert.date) {
    dateStr = withWeekday(cert.date, lang);
  }

  const name = (cert.guestName || res.bookingName || '').trim();
  const party = cert.partySize ?? res.partySize;
  const note = (cert.note ?? '').trim();

  const rows: CertCardRow[] = [
    { label: L.fields.target, value: cert.target.trim() },
    { label: L.fields.service, value: (cert.serviceNo ?? '').trim() },
    { label: L.fields.date, value: dateStr },
    { label: L.fields.ref, value: (cert.refNo ?? '').trim() },
    { label: L.fields.name, value: name },
    { label: L.fields.party, value: party !== undefined ? `${party} ${L.unit}` : '' },
  ].filter((r) => r.value);

  let noteRowIndex = -1;
  if (note) {
    noteRowIndex = rows.length;
    rows.push({ label: L.fields.note, value: note, multiline: true });
  }

  const zhWhen = cert.date
    ? cert.kind === 'stay'
      ? `${cert.date} 〜 ${cert.endDate || addDays(cert.date, 1)}`
      : cert.date
    : '';
  const zhSummary = `你正在請對方開立「${ZH_KIND[cert.kind]}」${cert.target.trim() ? `／${cert.target.trim()}` : ''}${zhWhen ? `／${zhWhen}` : ''}`;

  // 兩個人一起去、證明卻只開一個人的名字，另一位就請不了款——所以人數 >1 就自動加這句
  const body = party !== undefined && party > 1 ? [...L.body[cert.kind], L.multiName(party)] : L.body[cert.kind];

  return {
    lang,
    heading: L.heading,
    intro: L.intro,
    docName: L.docName[cert.kind],
    body,
    rows,
    thanks: L.thanks,
    zhSummary,
    noteRowIndex,
  };
}

/** 把補充翻成當地語言；沒目標語言、沒網路或翻失敗都回原文。 */
export async function translateCertNote(note: string, lang: Lang): Promise<string> {
  const target = certTranslateTarget(lang);
  if (!target || !note.trim()) return note;
  return translateLines(note, target);
}

// ── 電腦版：開新視窗出示 / 列印 ──────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

/** 一張牌的 HTML。noteId 讓翻譯回來後可以就地換掉那一格。 */
function cardHtml(card: CertCardData, noteId: string): string {
  const rows = card.rows
    .map((r, i) => {
      const idAttr = i === card.noteRowIndex ? ` id="${noteId}"` : '';
      const val = esc(r.value).replace(/\n/g, '<br>');
      return `<tr><td class="k">${esc(r.label)}</td><td class="v${r.multiline ? ' multi' : ''}"${idAttr}>${val}</td></tr>`;
    })
    .join('');
  const body = card.body.map((p) => `<p>${esc(p)}</p>`).join('');
  return `<div class="card">
  <div class="intro">${esc(card.intro)}</div>
  <h1>${esc(card.heading)}</h1>
  <div class="doc">${esc(card.docName)}</div>
  <div class="body">${body}</div>
  <table>${rows}</table>
  <div class="thanks">${esc(card.thanks)}</div>
  <div class="zh">${esc(card.zhSummary)}</div>
</div>`;
}

const CARD_CSS = `
  body { font-family: 'Noto Sans JP','Noto Sans TC','Hiragino Sans','Microsoft JhengHei',-apple-system,sans-serif;
    margin: 0; padding: 24px; color: #1a1a1a; background: #f2f0ec; }
  .bar { max-width: 560px; margin: 0 auto 16px; display: flex; gap: 10px; align-items: center; }
  .bar button { min-height: 38px; padding: 0 18px; border: 1px solid #2C4A3D; border-radius: 999px;
    background: #2C4A3D; color: #fff; font-size: 14px; cursor: pointer; font-family: inherit; }
  .bar span { font-size: 12.5px; color: #7a7268; }
  .card { max-width: 560px; margin: 0 auto 20px; background: #fff; border: 1.5px solid #2C4A3D;
    border-radius: 12px; padding: 24px 28px 22px; page-break-inside: avoid; break-inside: avoid; }
  .intro { font-size: 14px; line-height: 1.7; color: #6b6459; padding-bottom: 12px; margin-bottom: 14px;
    border-bottom: 1px dashed #d8d4cc; }
  h1 { font-size: 15px; letter-spacing: 2px; color: #2C4A3D; margin: 0 0 6px; font-weight: 600; }
  .doc { font-size: 27px; font-weight: 700; letter-spacing: 1px; margin-bottom: 14px; }
  .body p { margin: 0 0 9px; font-size: 15.5px; line-height: 1.8; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; border-top: 1px solid #e2ded6; }
  td { padding: 9px 0; vertical-align: top; font-size: 16px; border-bottom: 1px solid #f0ede7; }
  td.k { color: #7a7268; width: 116px; white-space: nowrap; font-size: 13.5px; padding-top: 12px; }
  td.v { font-weight: 600; word-break: break-word; }
  td.v.multi { font-weight: 500; font-size: 15px; white-space: pre-wrap; }
  .thanks { margin-top: 16px; font-size: 14.5px; line-height: 1.7; color: #3a352e; }
  .zh { margin-top: 16px; padding-top: 12px; border-top: 1px dashed #d8d4cc; font-size: 12.5px; color: #9a9187; }
  @page { size: A4 portrait; margin: 14mm; }
  @media print {
    body { background: #fff; padding: 0; }
    .bar { display: none; }
    .card { border: 1px solid #999; margin: 0 0 10mm; max-width: none; }
  }
`;

function shell(title: string, inner: string): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><style>${CARD_CSS}</style></head><body>${inner}</body></html>`;
}

/**
 * 開一個視窗出示／列印證明申請牌。
 *
 * 先同步寫入完整內容（沒網路也看得到），再把「補充」丟去翻譯，翻好了就地換掉那一格——
 * 不讓翻譯 API 擋住整張牌的顯示。
 */
export function openCertCards(
  certs: CertRequest[],
  ledger: Ledger,
  opts: { print?: boolean; tripName?: string } = {},
): void {
  if (certs.length === 0) {
    window.alert('還沒有可出示的手牌，請先在下方新增。');
    return;
  }
  const w = window.open('', '_blank', 'width=640,height=860');
  if (!w) {
    window.alert('瀏覽器擋掉了彈出視窗，請允許彈出視窗後再試。');
    return;
  }

  const cards = certs.map((c) => buildCertCard(c, ledger));
  const title = `${cards[0]!.docName}${opts.tripName ? ` - ${opts.tripName}` : ''}`;
  const bar = `<div class="bar"><button onclick="window.print()">🖨 列印</button>
<span>把畫面（或印出來的紙）直接拿給櫃台看就好，不用開口。</span></div>`;
  const inner = bar + cards.map((c, i) => cardHtml(c, `note-${i}`)).join('');

  w.document.open();
  w.document.write(shell(title, inner));
  w.document.close();

  // 補充欄的翻譯：翻好才換，翻不到就維持原本的中文
  cards.forEach((card, i) => {
    if (card.noteRowIndex < 0) return;
    const original = card.rows[card.noteRowIndex]!.value;
    void translateCertNote(original, card.lang).then((translated) => {
      if (translated === original) return;
      try {
        if (w.closed) return;
        const cell = w.document.getElementById(`note-${i}`);
        if (cell) cell.textContent = translated;
      } catch {
        /* 視窗被關掉就算了 */
      }
    });
  });

  if (opts.print) {
    // 內容是同步寫進去的，稍等一下讓瀏覽器排版完再叫列印
    w.setTimeout(() => {
      try {
        w.print();
      } catch {
        /* 使用者可以自己按上面的列印鈕 */
      }
    }, 300);
  }
}
