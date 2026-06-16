import type { Ledger, ExpenseCategory, AnalysisBucket, ReservationStatus, Accommodation } from '../types/ledger';
import type { Trip } from '../types/trip';
import { toTWD } from './money';
import { addDays, formatMonthDay, weekdayLabel } from './date';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = ['交通', '住宿', '飲食', '購物', '其他'];

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
    budgets: [],
    paymentMethods: [],
    channels: [],
    accommodations: [],
    restaurants: [],
    expenses: [],
  };
}

/** 永遠拿得到一份 ledger（沒設過就給空的）。 */
export function getLedger(trip: Trip | null | undefined): Ledger {
  return trip?.ledger ?? emptyLedger();
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

type CatSplit = Record<string, { pre: number; during: number }>;

/**
 * 各類別實際花費（台幣），拆 pre（出發前已知/預訂）與 during（流水帳）。
 * 住宿表→住宿pre；餐廳實際→飲食pre（預訂的視為已承諾）；通用支出依自己的 phase/category。
 * 動態類別：用到才建鍵。
 */
export function categorySplit(l: Ledger): CatSplit {
  const out: CatSplit = {};
  const bucket = (c: string) => (out[c] ??= { pre: 0, during: 0 });
  for (const a of l.accommodations) bucket('住宿').pre += toTWD(a.price, a.currency, l.fxRate);
  for (const r of l.restaurants) if (r.amount) bucket('飲食').pre += toTWD(r.amount, r.currency ?? 'TWD', l.fxRate);
  for (const e of l.expenses) bucket(e.category)[e.phase] += toTWD(e.amount, e.currency, l.fxRate);
  return out;
}

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
    const { pre, during } = split[category] ?? { pre: 0, during: 0 };
    return { category, pre, during, total: pre + during, pct: 0 };
  });
  const grand = rows0.reduce((s, r) => s + r.total, 0);
  const rows = rows0.map((r) => ({ ...r, pct: grand > 0 ? (r.total / grand) * 100 : 0 }));
  return { rows, grand };
}

export interface BudgetRow {
  category: ExpenseCategory;
  budget: number;
  committed: number; // 出發前已預訂/已承諾（pre）
  during: number; // 現場已花
  remaining: number; // 剩餘可花（可為負＝超支）
}

/** 各設定預算的類別：已預訂 + 現場 + 剩餘（三段拆解）。 */
export function budgetBreakdown(l: Ledger): BudgetRow[] {
  const split = categorySplit(l);
  return l.budgets.map((b) => {
    const s = split[b.category] ?? { pre: 0, during: 0 };
    return { category: b.category, budget: b.amount, committed: s.pre, during: s.during, remaining: b.amount - s.pre - s.during };
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
