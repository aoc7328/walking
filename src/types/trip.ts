import type { Place, TransportMode } from './place';
import type { Ledger } from './ledger';

export interface ItineraryItem {
  id: string;
  place: Place;
  arrivalTime: string;
  stayMinutes: number;
  notes?: string[];
  isHotel: boolean;
  /**
   * true 代表這個項目是由 withAutoFill 自動產生的，
   * 之後前一天的最後一站變動時，會自動同步成新值。
   * 使用者手動加入的項目不會有這個旗標，因此不會被覆蓋。
   */
  autoFilled?: boolean;
  /**
   * true 代表抵達時間是使用者手動鎖定的，
   * 時間鏈重算（前一站變動）時不會被覆寫。
   * false / undefined：抵達時間由前一站 + 停留 + 交通時間 自動算出。
   */
  arrivalManual?: boolean;
}

export interface Leg {
  mode: TransportMode;
  durationMinutes?: number;
  distanceMeters?: number;
}

/**
 * 蓋在某一天日期卡右上角的標記符號。
 * 「形狀字符 + 顏色」的組合即是它的語意身份——
 * 同一個（黃色五角星）不論蓋在哪一天，都對應到圖例裡的同一條說明。
 */
export interface DayMark {
  glyph: string;
  color: string;
}

/** 圖例：把某個符號（形狀+顏色）對應到一段使用者自填的說明文字。 */
export interface MarkLegendEntry {
  glyph: string;
  color: string;
  label: string;
}

/**
 * 這天的備註（單一）：無時間、無地點、不進路線/地圖/時間鏈的隨手文字，可帶一個圖示。
 * 給「整天放空、想去再說」這類 long stay / 慢活日用——一天一則就夠。
 * 刻意跟 ItineraryItem 分開存（DayPlan.note），才不會被捲進點對點路線與時間計算。
 */
export interface DayNote {
  /** 備註圖示 emoji（可無）。 */
  iconEmoji?: string;
  /** 備註內文（自由文字；UI 上文字方塊會自動長高完整顯示）。 */
  text: string;
}

/** @deprecated 舊版「多張小卡片」。保留僅供讀取遷移成單一 note（見 utils/dayNote.ts）。 */
export interface NoteCard {
  id: string;
  iconEmoji?: string;
  text: string;
}

export interface DayPlan {
  id: string;
  dayIndex: number;
  date: string;
  city?: string;
  items: ItineraryItem[];
  legs: Leg[];
  /** 這天被蓋上的標記符號（顯示在日期卡右上角）。 */
  marks?: DayMark[];
  /** 這天的備註（單一，可帶圖示；與 items 完全獨立，不進路線/地圖/時間鏈）。取代舊的 cards[]。 */
  note?: DayNote;
  /** @deprecated 舊版多卡片；保留僅供讀取遷移，新程式一律用 note（見 utils/dayNote.ts）。 */
  cards?: NoteCard[];
}

/** 出發前待辦提醒（私人，刻意不進分享連結／匯出）：核取方塊 + 項目 + 備註 + 網址 + 預估金額。 */
export interface TodoItem {
  id: string;
  done: boolean;
  /** 項目（例：eSIM 還沒買）。 */
  text: string;
  /** 備註（可無）。 */
  note?: string;
  /** 相關網址（可點開；純記錄）。 */
  url?: string;
  /** 預估金額（純記錄，不計入任何預算）。 */
  amount?: number;
}

export interface Trip {
  id: string;
  name: string;
  startDate: string;
  days: DayPlan[];
  favorites: Place[];
  /** 待辦清單（筆記提醒；跟 trip 一起存，但不分享/不下載）。 */
  todos?: TodoItem[];
  /** 標記符號的說明（圖例）。每個符號用 glyph+color 當鍵。 */
  markLegend?: MarkLegendEntry[];
  /** 旅遊帳本（出發前預訂/出發後流水帳/預算/消費分析）。舊行程為 undefined，讀寫時 fallback 空帳本。 */
  ledger?: Ledger;
  createdAt: number;
  updatedAt: number;
}
