import type { Ledger, ExpenseCategory, AnalysisBucket, ReservationStatus, Accommodation } from '../types/ledger';
import type { Trip } from '../types/trip';
import { toTWD } from './money';
import { addDays, formatMonthDay, weekdayLabel } from './date';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = ['交通', '住宿', '飲食', '購物', '其他'];

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

/** 五類別在圓環/比例圖的固定配色（對齊概念草稿）。 */
export const CATEGORY_COLOR: Record<ExpenseCategory, string> = {
  交通: '#5B4B7F',
  住宿: '#378ADD',
  飲食: '#EF9F27',
  購物: '#1D9E75',
  其他: '#888780',
};

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
      estimated: s.estimated + (r.estimated ?? 0),
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
