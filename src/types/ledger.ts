/**
 * 旅遊帳本：掛在 Trip 底下，跟著行程一起存進 KV。
 * 私密——不會進公開分享連結（share.ts 是逐欄位手挑組 payload，不碰 ledger）。
 *
 * 兩條正交軸：phase(出發前/後) × category(交通/住宿/餐飲/購物/其他)。
 * 分析三大塊由 category 決定，不由 phase：餐飲→food、購物→shopping、其餘→fixed。
 */

export type ExpenseCategory = '交通' | '住宿' | '餐飲' | '購物' | '其他';
export type ExpensePhase = 'pre' | 'during';

/** 消費分析的三大塊。 */
export type AnalysisBucket = 'fixed' | 'food' | 'shopping';

export type PaymentKind = 'card' | 'cash' | 'mobile';

export interface PaymentMethod {
  id: string;
  /** 'A 卡 · 國泰 CUBE' / '現金' / 'PayPay' */
  name: string;
  kind: PaymentKind;
  /** 刷卡上限（台幣）；只有 kind==='card' 有意義，undefined = 不限。 */
  limit?: number;
}

/** 各類別預算天花板（台幣）。pre + during 同類別共用一個池子一起扣。 */
export interface CategoryBudget {
  category: ExpenseCategory;
  amount: number;
}

/** 餐廳預約狀態：已預約 / 沒預約 / 不用預約 / 臨時想去（候補）。 */
export type ReservationStatus = 'reserved' | 'none' | 'walkin' | 'maybe';

/** 住宿訂房（出發前專用厚表）。語意上 category 固定為「住宿」。 */
export interface Accommodation {
  id: string;
  paid: boolean;
  area: string;
  name: string;
  /** 入住日 YYYY-MM-DD（退房日 = checkIn + nights）。 */
  checkIn: string;
  nights: number;
  pricePerNight: number;
  /** 每晚價格的幣別（台灣訂可能刷 TWD，當地訂可能刷當地）。 */
  currency: string;
  breakfast: boolean;
  /** 訂購平台 Agoda / Booking / 官網… */
  platform: string;
  chargeDate?: string;
  paymentMethodId?: string;
  note?: string;
}

/** 餐廳預訂（出發前專用厚表，可匯出 CSV/PDF 給秘書）。語意上 category 固定為「餐飲」。 */
export interface Restaurant {
  id: string;
  /** 日期 YYYY-MM-DD（週幾由 date 推算）。 */
  date: string;
  /** 預定時間 HH:MM。 */
  time?: string;
  name: string;
  /** 種類：壽喜燒 / 壽司 / 鐵板燒…自由填。 */
  cuisine: string;
  status: ReservationStatus;

  // 訂位資訊（給秘書去訂位用）
  bookingName?: string;
  partySize?: number;
  leadGuest?: string;
  contact?: string;
  channel?: string;
  bookingRef?: string;

  // 帳務（可事先填，台灣訂位時有時就先刷了）
  amount?: number;
  currency?: string;
  paid: boolean;
  paymentMethodId?: string;

  /** 備註：過敏原 / 不會日文等先交代事項。 */
  note?: string;
}

/** 通用支出：交通/簽證/保險/eSIM 等固定項(pre) + 出發後流水帳(during)。 */
export interface Expense {
  id: string;
  phase: ExpensePhase;
  category: ExpenseCategory;
  title: string;
  /** 日期 YYYY-MM-DD（流水帳必填，出發前可空）。 */
  date?: string;
  amount: number;
  /** 輸入幣別（TWD 或當地，另一邊自動換算）。 */
  currency: string;
  paid: boolean;
  paymentMethodId?: string;
  note?: string;
}

export interface Ledger {
  /** 目的地當地貨幣代碼，例如 'JPY' / 'NZD'。跟著專案走。 */
  localCurrency: string;
  /** 1 單位當地貨幣 = fxRate 台幣（全趟一個匯率）。 */
  fxRate: number;
  budgets: CategoryBudget[];
  paymentMethods: PaymentMethod[];
  /** 可自訂的預約管道選項（餐廳用）。 */
  channels: string[];
  accommodations: Accommodation[];
  restaurants: Restaurant[];
  expenses: Expense[];
}

/** 本位幣（分析、預算、卡片額度一律以此為基準）。 */
export const HOME_CURRENCY = 'TWD';
