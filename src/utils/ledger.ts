import type { Ledger, ExpenseCategory, AnalysisBucket } from '../types/ledger';
import type { Trip } from '../types/trip';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = ['交通', '住宿', '餐飲', '購物', '其他'];

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

/** 類別 → 分析三大塊：餐飲→food、購物→shopping、其餘→fixed。 */
export function categoryToBucket(category: ExpenseCategory): AnalysisBucket {
  if (category === '餐飲') return 'food';
  if (category === '購物') return 'shopping';
  return 'fixed';
}

export const BUCKET_LABEL: Record<AnalysisBucket, string> = {
  fixed: '固定成本',
  food: '吃飯',
  shopping: '購物',
};
