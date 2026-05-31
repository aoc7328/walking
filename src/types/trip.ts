import type { Place, TransportMode } from './place';

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

export interface DayPlan {
  id: string;
  dayIndex: number;
  date: string;
  city?: string;
  items: ItineraryItem[];
  legs: Leg[];
  /** 這天被蓋上的標記符號（顯示在日期卡右上角）。 */
  marks?: DayMark[];
}

export interface Trip {
  id: string;
  name: string;
  startDate: string;
  days: DayPlan[];
  favorites: Place[];
  /** 標記符號的說明（圖例）。每個符號用 glyph+color 當鍵。 */
  markLegend?: MarkLegendEntry[];
  createdAt: number;
  updatedAt: number;
}
