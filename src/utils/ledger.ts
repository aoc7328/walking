import type { Ledger, ExpenseCategory, AnalysisBucket, ReservationStatus, Accommodation, ReservationDefaults } from '../types/ledger';
import type { Trip } from '../types/trip';
import { toTWD } from './money';
import { addDays, formatMonthDay, weekdayLabel } from './date';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = ['交通', '住宿', '飲食', '購物', '其他'];

/**
 * 餐廳訂位全域預設（沒特別設定就自動帶上這組，秘書 CSV / 訂位牌都吃得到）。
 * 逐欄位當 fallback（見 getLedger）：使用者在設定改了或清空，都以他填的為準。
 */
export const DEFAULT_RESERVATION: ReservationDefaults = {
  bookingName: '張先生',
  partySize: 2,
  contact: '0911-195-855',
  email: 'aoc7328@gmail.com',
};

/** 這份帳本實際用到的類別：預設五類 ∪ 使用者自訂 ∪ 資料中已出現的，保序去重。 */
export function categoriesOf(l: Ledger): string[] {
  const base = l.categories && l.categories.length ? l.categories : EXPENSE_CATEGORIES;
  const seen = new Set<string>(base);
  const out = [...base];
  for (const e of l.expenses) if (e.category && !seen.has(e.category)) { seen.add(e.category); out.push(e.category); }
  return out;
}

/** 空帳本（任何沒設過帳本的 trip 讀寫時的 fallback）。預設日本，可改。 */
export function emptyLedger(): Ledger {
  return {
    localCurrency: 'JPY',
    fxRate: 0.21,
    reservation: { ...DEFAULT_RESERVATION },
    budgets: [],
    paymentMethods: [],
    channels: [],
    accommodations: [],
    restaurants: [],
    expenses: [],
  };
}

/**
 * 永遠拿得到一份 ledger（沒設過就給空的）。
 * 順便把餐廳訂位預設逐欄位補上：舊帳本沒填的欄位自動帶 DEFAULT_RESERVATION，
 * 使用者填過/清空過的欄位一律以他的為準（只是顯示層合併，不寫回持久化）。
 */
export function getLedger(trip: Trip | null | undefined): Ledger {
  const l = trip?.ledger ?? emptyLedger();
  return { ...l, reservation: { ...DEFAULT_RESERVATION, ...(l.reservation ?? {}) } };
}

/** 類別 → 歸併塊：飲食→food、購物→shopping、其餘(交通/住宿/其他)→fixed。 */
export function categoryToBucket(category: ExpenseCategory): AnalysisBucket {
  if (category === '飲食') return 'food';
  if (category === '購物') return 'shopping';
  return 'fixed';
}

export const BUCKET_LABEL: Record<AnalysisBucket, string> = {
  fixed: '固定成本',
  food: '吃飯',
  shopping: '購物',
};

/** 五類別固定配色；自訂類別用調色盤依名稱決定（穩定、不隨機）。 */
const FIXED_CATEGORY_COLOR: Record<string, string> = {
  交通: '#5B4B7F', 住宿: '#378ADD', 飲食: '#EF9F27', 購物: '#1D9E75', 其他: '#888780',
};
const CATEGORY_PALETTE = ['#D4537E', '#0F6E56', '#BA7517', '#534AB7', '#A32D2D', '#185FA5', '#639922'];
export function categoryColor(cat: string): string {
  if (FIXED_CATEGORY_COLOR[cat]) return FIXED_CATEGORY_COLOR[cat]!;
  let h = 0;
  for (const ch of cat) h = (h + ch.charCodeAt(0)) % CATEGORY_PALETTE.length;
  return CATEGORY_PALETTE[h]!;
}

/** 常見旅行目的地 → 幣別 + 預訂牌語言（ja/en/zh，其餘語言以 en 呈現）。 */
export interface Destination { name: string; currency: string; language: string }
export const DESTINATIONS: Destination[] = [
  { name: '日本', currency: 'JPY', language: 'ja' },
  { name: '韓國', currency: 'KRW', language: 'en' },
  { name: '台灣', currency: 'TWD', language: 'zh' },
  { name: '香港', currency: 'HKD', language: 'zh' },
  { name: '中國', currency: 'CNY', language: 'zh' },
  { name: '泰國', currency: 'THB', language: 'en' },
  { name: '新加坡', currency: 'SGD', language: 'en' },
  { name: '越南', currency: 'VND', language: 'en' },
  { name: '紐西蘭', currency: 'NZD', language: 'en' },
  { name: '澳洲', currency: 'AUD', language: 'en' },
  { name: '美國', currency: 'USD', language: 'en' },
  { name: '加拿大', currency: 'CAD', language: 'en' },
  { name: '英國', currency: 'GBP', language: 'en' },
  { name: '歐洲（歐元區）', currency: 'EUR', language: 'en' },
];

export const RESERVATION_LABEL: Record<ReservationStatus, string> = {
  reserved: '已預約',
  none: '未預約',
  walkin: '不需預約',
  impromptu: '臨時',
  cancelled: '已取消',
};

/** 住宿日期區間顯示：「2/9（日）→ 2/11（二）· 2 晚」；沒填入住日就只顯示晚數。 */
export function formatStayRange(checkIn: string | undefined, nights: number): string {
  if (!checkIn) return `${nights} 晚`;
  const out = addDays(checkIn, nights);
  return `${formatMonthDay(checkIn)}（${weekdayLabel(checkIn)}）→ ${formatMonthDay(out)}（${weekdayLabel(out)}）· ${nights} 晚`;
}

/** 住宿每晚單價（總價 / 晚數）。 */
export function pricePerNight(a: Accommodation): number {
  return a.nights > 0 ? a.price / a.nights : a.price;
}

/** 住宿總價（台幣）。 */
export function accommodationTotalTWD(l: Ledger): number {
  return l.accommodations.reduce((s, a) => s + toTWD(a.price, a.currency, l.fxRate), 0);
}

/** 餐廳預訂的預估 / 實際合計（台幣）。 */
export function restaurantTotalsTWD(l: Ledger): { estimated: number; actual: number } {
  return l.restaurants.reduce(
    (s, r) => ({
      estimated: s.estimated + (r.estimated ? toTWD(r.estimated, r.estimatedCurrency ?? 'TWD', l.fxRate) : 0),
      actual: s.actual + (r.amount ? toTWD(r.amount, r.currency ?? 'TWD', l.fxRate) : 0),
    }),
    { estimated: 0, actual: 0 },
  );
}

/** 某 phase 的通用支出合計（台幣）。 */
export function expensesTotalTWD(l: Ledger, phase: 'pre' | 'during'): number {
  return l.expenses
    .filter((e) => e.phase === phase)
    .reduce((s, e) => s + toTWD(e.amount, e.currency, l.fxRate), 0);
}

type CatSplit = Record<string, { pre: number; during: number; planned: number }>;

/**
 * 各類別金額（台幣），三條線：
 * - pre     出發前「實際」已花：住宿房價、餐廳實際開銷、pre 的通用支出
 * - during  出發後流水帳
 * - planned 出發前「已知/已訂」：給預估欄與預算的「已知/已訂」用
 *
 * planned 跟 pre 的差別只在餐廳：餐廳優先取「預估費用」，沒填才退回實際開銷。
 * 這樣才對得起設定頁寫的「已知/已訂自動帶入（機票・租車・已訂餐廳…）」——
 * 出發前訂好餐廳、只填了預估金額的情況，本來整筆都不會被算進去。
 *
 * 動態類別：用到才建鍵。
 */
export function categorySplit(l: Ledger): CatSplit {
  const out: CatSplit = {};
  const bucket = (c: string) => (out[c] ??= { pre: 0, during: 0, planned: 0 });

  for (const a of l.accommodations) {
    const twd = toTWD(a.price, a.currency, l.fxRate);
    const b = bucket('住宿');
    b.pre += twd;
    b.planned += twd;
  }

  for (const r of l.restaurants) {
    const actual = r.amount ? toTWD(r.amount, r.currency ?? 'TWD', l.fxRate) : 0;
    const estimated = r.estimated ? toTWD(r.estimated, r.estimatedCurrency ?? 'TWD', l.fxRate) : 0;
    const b = bucket('飲食');
    b.pre += actual;
    // 已取消的訂位不列入計畫（真的付了取消費才用實際數字）
    b.planned += r.status === 'cancelled' ? actual : estimated || actual;
  }

  for (const e of l.expenses) {
    const twd = toTWD(e.amount, e.currency, l.fxRate);
    const b = bucket(e.category);
    b[e.phase] += twd;
    if (e.phase === 'pre') b.planned += twd;
  }

  return out;
}

const EMPTY_SPLIT = { pre: 0, during: 0, planned: 0 };

export interface CategoryTotal {
  category: ExpenseCategory;
  pre: number;
  during: number;
  total: number;
  pct: number;
}

/** 各類別實際佔比（總額為分母）。 */
export function categoryTotals(l: Ledger): { rows: CategoryTotal[]; grand: number } {
  const split = categorySplit(l);
  const rows0 = categoriesOf(l).map((category) => {
    const { pre, during } = split[category] ?? EMPTY_SPLIT;
    return { category, pre, during, total: pre + during, pct: 0 };
  });
  const grand = rows0.reduce((s, r) => s + r.total, 0);
  const rows = rows0.map((r) => ({ ...r, pct: grand > 0 ? (r.total / grand) * 100 : 0 }));
  return { rows, grand };
}

export interface BudgetRow {
  category: ExpenseCategory;
  extra: number; // 使用者額外抓的零星預估
  budget: number; // 有效總預算 = committed + extra
  committed: number; // 出發前已知/已訂（planned，自動算入）
  during: number; // 現場已花
  remaining: number; // 剩餘可花 = extra − during（可為負＝超支）
}

/**
 * 各設定預算類別的拆解。
 * 已知/已付(committed) 由系統自動算進來；budget.amount 只是額外零星預估(extra)。
 * 有效總預算 = committed + extra；剩餘 = extra − during。
 */
export function budgetBreakdown(l: Ledger): BudgetRow[] {
  const split = categorySplit(l);
  return l.budgets.map((b) => {
    const s = split[b.category] ?? EMPTY_SPLIT;
    return { category: b.category, extra: b.amount, budget: s.planned + b.amount, committed: s.planned, during: s.during, remaining: b.amount - s.during };
  });
}

export interface CardUsage {
  id: string;
  name: string;
  limit?: number;
  spent: number;
  remaining?: number;
}

/** 每個支付方式累計已刷（台幣）；住宿、餐廳、所有支出都算進對應卡。 */
export function cardUsage(l: Ledger): CardUsage[] {
  const spent = new Map<string, number>();
  const add = (id: string | undefined, twd: number) => {
    if (!id) return;
    spent.set(id, (spent.get(id) ?? 0) + twd);
  };
  for (const a of l.accommodations) add(a.paymentMethodId, toTWD(a.price, a.currency, l.fxRate));
  for (const r of l.restaurants) if (r.amount) add(r.paymentMethodId, toTWD(r.amount, r.currency ?? 'TWD', l.fxRate));
  for (const e of l.expenses) add(e.paymentMethodId, toTWD(e.amount, e.currency, l.fxRate));
  return l.paymentMethods.map((p) => {
    const s = spent.get(p.id) ?? 0;
    return { id: p.id, name: p.name, limit: p.limit, spent: s, remaining: p.limit === undefined ? undefined : p.limit - s };
  });
}

/** 全帳本實際總額（台幣）。 */
export function actualGrandTotal(l: Ledger): number {
  return categoryTotals(l).grand;
}

export interface PlanActualRow { category: ExpenseCategory; estimate: number; actual: number; diff: number }

/**
 * 各類別「預估 vs 實際」。
 * 預估 = 已知/已訂(planned) + 額外預估(budget extra)；實際 = 出發前實際(pre) + 流水帳(during)。
 * 差距 = 實際 − 預估。餐廳只填預估、還沒去吃的情況：預估有數字、實際為 0，差距顯示結餘。
 */
export function planVsActual(l: Ledger): { rows: PlanActualRow[]; estTotal: number; actTotal: number; diff: number } {
  const split = categorySplit(l);
  const budMap = new Map(l.budgets.map((b) => [b.category, b.amount]));
  const rows = categoriesOf(l).map((category) => {
    const s = split[category] ?? EMPTY_SPLIT;
    const extra = budMap.get(category) ?? 0;
    const estimate = s.planned + extra;
    const actual = s.pre + s.during;
    return { category, estimate, actual, diff: actual - estimate };
  });
  const estTotal = rows.reduce((a, r) => a + r.estimate, 0);
  const actTotal = rows.reduce((a, r) => a + r.actual, 0);
  return { rows, estTotal, actTotal, diff: actTotal - estTotal };
}

export interface PivotResult {
  methods: { id: string; name: string }[];
  rows: { category: string; cells: number[]; total: number }[];
  colTotals: number[];
  grand: number;
}

/** 樞紐表：類別（列）× 支付方式（欄），值為台幣花費。自動去掉全空的支付方式欄。 */
export function pivotCategoryPayment(l: Ledger): PivotResult {
  const NONE = '__none__';
  const allMethods = [...l.paymentMethods.map((p) => ({ id: p.id, name: p.name })), { id: NONE, name: '未指定' }];
  const idx = new Map(allMethods.map((m, i) => [m.id, i]));
  const catMap = new Map<string, number[]>();
  const add = (cat: string, pmId: string | undefined, twd: number) => {
    if (!twd) return;
    if (!catMap.has(cat)) catMap.set(cat, new Array(allMethods.length).fill(0));
    const i = idx.get(pmId && idx.has(pmId) ? pmId : NONE)!;
    catMap.get(cat)![i] += twd;
  };
  for (const a of l.accommodations) add('住宿', a.paymentMethodId, toTWD(a.price, a.currency, l.fxRate));
  for (const r of l.restaurants) if (r.amount) add('飲食', r.paymentMethodId, toTWD(r.amount, r.currency ?? 'TWD', l.fxRate));
  for (const e of l.expenses) add(e.category, e.paymentMethodId, toTWD(e.amount, e.currency, l.fxRate));

  const rows0 = categoriesOf(l).filter((c) => catMap.has(c)).map((category) => ({ category, cells: catMap.get(category)! }));
  const colTotalsAll = allMethods.map((_, i) => rows0.reduce((s, r) => s + r.cells[i]!, 0));
  const keep = allMethods.map((_, i) => i).filter((i) => colTotalsAll[i]! > 0);
  const methods = keep.map((i) => allMethods[i]!);
  const rows = rows0.map((r) => {
    const cells = keep.map((i) => r.cells[i]!);
    return { category: r.category, cells, total: cells.reduce((a, b) => a + b, 0) };
  });
  const colTotals = keep.map((i) => colTotalsAll[i]!);
  return { methods, rows, colTotals, grand: colTotals.reduce((a, b) => a + b, 0) };
}

/** 出發後流水帳依日期加總（台幣），日期升冪。 */
export function dailySpending(l: Ledger): { date: string; twd: number }[] {
  const map = new Map<string, number>();
  for (const e of l.expenses) {
    if (e.phase !== 'during' || !e.date) continue;
    map.set(e.date, (map.get(e.date) ?? 0) + toTWD(e.amount, e.currency, l.fxRate));
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, twd]) => ({ date, twd }));
}

/** 最大單筆開銷（住宿/餐廳/支出全部一起比，台幣）。 */
export function largestExpense(l: Ledger): { label: string; twd: number } | null {
  let best: { label: string; twd: number } | null = null;
  const consider = (label: string, twd: number) => { if (twd > 0 && (!best || twd > best.twd)) best = { label, twd }; };
  for (const a of l.accommodations) consider(a.name || '住宿', toTWD(a.price, a.currency, l.fxRate));
  for (const r of l.restaurants) if (r.amount) consider(r.name || '餐廳', toTWD(r.amount, r.currency ?? 'TWD', l.fxRate));
  for (const e of l.expenses) consider(e.title || e.category, toTWD(e.amount, e.currency, l.fxRate));
  return best;
}

export interface HotelStay {
  placeId?: string;
  name: string;
  area?: string;
  checkIn: string;
  nights: number;
}

/**
 * 從行程表抽出住宿段：每天取「最後一個被標為飯店(isHotel)的地點」當當晚住宿，
 * 連續幾天住同一間就合併成一段（入住日=第一天、晚數=連住天數）。
 */
export function extractStaysFromTrip(trip: Trip): HotelStay[] {
  const stays: HotelStay[] = [];
  let prev: HotelStay | null = null;
  for (const day of trip.days) {
    let hotel: { placeId: string; name: string } | null = null;
    for (let i = day.items.length - 1; i >= 0; i--) {
      const it = day.items[i]!;
      if (it.isHotel) { hotel = { placeId: it.place.placeId, name: it.place.name }; break; }
    }
    if (!hotel) { prev = null; continue; }
    if (prev && ((hotel.placeId && prev.placeId === hotel.placeId) || prev.name === hotel.name)) {
      prev.nights += 1;
    } else {
      const s: HotelStay = { placeId: hotel.placeId, name: hotel.name, area: day.city, checkIn: day.date, nights: 1 };
      stays.push(s);
      prev = s;
    }
  }
  return stays;
}
