/**
 * 旅遊帳本：掛在 Trip 底下，跟著行程一起存進 KV。
 * 私密——不會進公開分享連結（share.ts 是逐欄位手挑組 payload，不碰 ledger）。
 *
 * 兩條正交軸：phase(出發前/後) × category(交通/住宿/餐飲/購物/其他)。
 * 分析三大塊由 category 決定，不由 phase：餐飲→food、購物→shopping、其餘→fixed。
 */

/** 類別字串。預設五類(交通/住宿/飲食/購物/其他)，但使用者可在設定新增自訂類別。 */
export type ExpenseCategory = string;
export type ExpensePhase = 'pre' | 'during';

/** 消費分析的歸併塊（headline）。五類別實際佔比另算。 */
export type AnalysisBucket = 'fixed' | 'food' | 'shopping';

export type PaymentKind = 'card' | 'cash' | 'mobile';

export interface PaymentMethod {
  id: string;
  /** 'A 卡 · 國泰 CUBE' / '現金' / 'PayPay' */
  name: string;
  kind: PaymentKind;
  /** 刷卡上限（台幣）；只有 kind==='card' 有意義，undefined = 不限。 */
  limit?: number;
  /** 備註：這張卡在這個國家的優惠/回饋方式等。 */
  note?: string;
}

/**
 * 各類別預算（台幣）。amount = 「額外變動預估」：已知/已付的項目(機票/租車/已訂餐廳)
 * 由系統自動算進來，這裡只填你要再加上的零星預估(地鐵、超市等)。
 * 有效總預算 = 該類別已知花費(committed) + amount。
 */
export interface CategoryBudget {
  category: ExpenseCategory;
  amount: number;
}

/** 餐廳預約狀態：已預約 / 未預約 / 不需預約(現場) / 臨時想去 / 已取消。 */
export type ReservationStatus = 'reserved' | 'none' | 'walkin' | 'impromptu' | 'cancelled';

/** 住宿訂房（出發前專用厚表）。語意上 category 固定為「住宿」。 */
export interface Accommodation {
  id: string;
  paid: boolean;
  /** 對應行程裡飯店地點的 placeId（從行程帶入時設，之後重帶可對齊不重複）。 */
  placeId?: string;
  /** 區域，例如「福岡天神」「別府」。 */
  area?: string;
  name: string;
  /** 入住日 YYYY-MM-DD（退房日 = checkIn + nights）。規劃中可留空、只填晚數。 */
  checkIn?: string;
  nights: number;
  /** 整段住宿總價（不是每晚；每晚 = price / nights）。 */
  price: number;
  /** 價格幣別（台灣訂多為 TWD，當地訂可能為當地幣）。 */
  currency: string;
  /** 附餐：'早餐' / '早餐、晚餐' / 空＝無。 */
  meals?: string;
  /** 訂購平台 Agoda / Booking.com / hotels.com / 官網… */
  platform: string;
  /** 刷卡日期或付款狀態註記（'已付款' / '現場付款' / 日期）。 */
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
  /** 預估費用。 */
  estimated?: number;
  /** 預估費用的幣別（台幣或當地）。 */
  estimatedCurrency?: string;
  /** 實際開銷。 */
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

/** 餐廳訂位的全域預設（同行成員固定，不必每餐重填）。 */
export interface ReservationDefaults {
  bookingName?: string;
  leadGuest?: string;
  partySize?: number;
  /** 聯絡電話。 */
  contact?: string;
  /** 聯絡 Email（訂位確認信、給秘書 CSV / 訂位牌帶上）。 */
  email?: string;
  /** 飲食習慣與語言需求（過敏、素食、不會日文…），訂位牌與 CSV 會帶上。 */
  dietaryNote?: string;
}

export interface Ledger {
  /** 旅行目的地國家名稱（選了會自動帶幣別與語言）。 */
  destination?: string;
  /** 目的地語言代碼（'ja' / 'en' / 'zh'…），給預訂牌等產生內容用。 */
  language?: string;
  /** 目的地當地貨幣代碼，例如 'JPY' / 'NZD'。跟著專案走。 */
  localCurrency: string;
  /** 1 單位當地貨幣 = fxRate 台幣（全趟一個匯率）。 */
  fxRate: number;
  /** 餐廳訂位全域預設（訂位人/主訂者/人數/聯絡）。 */
  reservation?: ReservationDefaults;
  /** 自訂類別清單（含預設五類）。未設時用預設五類。 */
  categories?: string[];
  /** 表格欄寬與隱藏欄設定。 */
  view?: LedgerView;
  budgets: CategoryBudget[];
  paymentMethods: PaymentMethod[];
  /** 可自訂的預約管道選項（餐廳用）。 */
  channels: string[];
  accommodations: Accommodation[];
  restaurants: Restaurant[];
  expenses: Expense[];
}

/** 表格檢視設定（欄寬、隱藏欄）；存在 ledger 裡，按「儲存」才寫雲端。 */
export interface LedgerView {
  /** tableId → 欄 key → 寬度(px)。 */
  colWidths?: Record<string, Record<string, number>>;
  /** tableId → 被隱藏的欄 key 陣列。 */
  hiddenCols?: Record<string, string[]>;
}

/** 本位幣（分析、預算、卡片額度一律以此為基準）。 */
export const HOME_CURRENCY = 'TWD';
