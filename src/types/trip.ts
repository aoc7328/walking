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

export interface DayPlan {
  id: string;
  dayIndex: number;
  date: string;
  city?: string;
  items: ItineraryItem[];
  legs: Leg[];
}

export interface Trip {
  id: string;
  name: string;
  startDate: string;
  days: DayPlan[];
  favorites: Place[];
  createdAt: number;
  updatedAt: number;
}
