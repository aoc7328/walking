import { create } from 'zustand';
import type { Trip, DayPlan, ItineraryItem, Leg } from '../types/trip';
import type { Place, TransportMode } from '../types/place';
import { MOCK_TRIP } from '../db/mockData';
import { uuid } from '../utils/format';
import { addDays, addMinutesToTime } from '../utils/date';
import { findBestInsertPosition } from '../services/routing';
import {
  setActiveTripId,
  persistTripImmediate,
  deleteTripFromDB,
  listAllTrips,
  loadTripById,
} from '../db/repository';
import { fetchLegDuration } from './../services/directions';

interface TripStore {
  trip: Trip | null;
  isLoading: boolean;
  /** 有未儲存到 KV 的編輯（由 subscribe 自動偵測，按儲存後歸 false） */
  dirty: boolean;
  /** 目前這筆 trip 是否已是 KV 既有行程（從下拉選單／啟動載入／新建進來 = true；
   *  mock 預設範例 = false）。決定按儲存是「覆蓋」還是「另存新行程」。 */
  persisted: boolean;
  setTrip: (trip: Trip) => void;
  reset: () => void;

  /** 把目前 trip 覆蓋寫回 KV（給「儲存」按鈕用，persisted 時） */
  saveTrip: () => Promise<void>;
  /** 用目前 trip 的內容另存成一筆新行程（新 id + 指定名稱），寫入 KV 並切成 current */
  saveAsNewTrip: (name: string) => Promise<string>;

  renameTrip: (name: string) => void;
  changeStartDate: (newStartDate: string) => void;

  addItemToDay: (dayId: string, place: Place, opts?: { isHotel?: boolean }) => string | null;
  removeItem: (dayId: string, itemId: string) => void;
  updateItem: (dayId: string, itemId: string, patch: Partial<Pick<ItineraryItem, 'arrivalTime' | 'stayMinutes' | 'notes' | 'arrivalManual'>>) => void;
  reorderItems: (dayId: string, fromIndex: number, toIndex: number) => void;
  copyItemToDay: (srcDayId: string, itemId: string, destDayId: string) => void;
  setLegMode: (dayId: string, legIndex: number, mode: TransportMode) => void;
  setLegDuration: (dayId: string, legIndex: number, minutes: number) => void;

  reorderDays: (fromIndex: number, toIndex: number) => void;
  addDayBefore: () => void;
  addDayAfter: () => void;
  removeDay: (dayId: string) => void;

  // 重新跟 Google 拿當日各段交通時間
  refreshLegsForDay: (dayId: string) => Promise<void>;

  toggleFavorite: (place: Place) => void;
  isFavorited: (placeId: string) => boolean;

  /** 設定某地點的 emoji 圖示（同 placeId 的所有 item 與收藏同步更新；傳 undefined 清除） */
  setPlaceIcon: (placeId: string, emoji: string | undefined) => void;

  // 多 trip 管理
  createNewTrip: (name: string, startDate: string, dayCount: number) => Promise<string>;
  switchToTrip: (id: string) => Promise<void>;
  deleteTrip: (id: string) => Promise<void>;
}

function recalcLegsArray(items: ItineraryItem[], legs: Leg[]): Leg[] {
  const targetLen = Math.max(0, items.length - 1);
  if (legs.length === targetLen) return legs;
  if (legs.length < targetLen) {
    const padded = [...legs];
    while (padded.length < targetLen) padded.push({ mode: 'driving' });
    return padded;
  }
  return legs.slice(0, targetLen);
}

/**
 * 重算當日時間鏈：非手動鎖定（arrivalManual !== true）的項目，
 * 抵達時間 = 前一站抵達 + 前一站停留 + 對應 leg 的 durationMinutes。
 */
function recomputeChain(day: DayPlan): DayPlan {
  if (day.items.length === 0) return day;
  const items = [...day.items];
  for (let i = 1; i < items.length; i++) {
    const item = items[i]!;
    if (item.arrivalManual) continue;
    const prev = items[i - 1]!;
    const leg = day.legs[i - 1];
    const travel = leg?.durationMinutes ?? 0;
    const newArrival = addMinutesToTime(prev.arrivalTime, prev.stayMinutes + travel);
    if (newArrival !== item.arrivalTime) {
      items[i] = { ...item, arrivalTime: newArrival };
    }
  }
  return { ...day, items };
}

function chainAll(days: DayPlan[]): DayPlan[] {
  return days.map(recomputeChain);
}

function reindexDays(days: DayPlan[], startDate: string): DayPlan[] {
  return days.map((d, idx) => ({
    ...d,
    dayIndex: idx + 1,
    date: addDays(startDate, idx),
  }));
}

/**
 * 把每個空白的日子（items.length === 0）自動填入前一天的最後一站，
 * 並標記為 autoFilled，預設 09:00 抵達、停留 30 分。Day 1 不處理。
 *
 * 連續空白天會「逐天接續」：Day N 接 Day N-1 的最後一站。因為前一天填好後
 * next[i-1] 就帶有那個 item，下一輪自然接得上，一路傳遞下去
 * （例如連續住同一間飯店好幾天，每天開頭都會是那間飯店）。
 *
 * 純函數，可重複套用（idempotent）：autoFilled 的天若已對上前一天最後一站，
 * 下一次跑就跳過，不會重複增加地點。
 */
function withAutoFill(days: DayPlan[]): DayPlan[] {
  if (days.length <= 1) return days;
  const next: DayPlan[] = [];
  for (let i = 0; i < days.length; i++) {
    const d = days[i]!;
    const prev = next[i - 1];

    if (!prev || prev.items.length === 0) {
      next.push(d);
      continue;
    }

    const prevLast = prev.items[prev.items.length - 1]!;

    // 情況 1：空白天 → 填入前一天最後一站當銜接點（標 autoFilled）
    if (d.items.length === 0) {
      const seed: ItineraryItem = {
        id: uuid(),
        place: prevLast.place,
        arrivalTime: '09:00',
        stayMinutes: 30,
        isHotel: false,
        autoFilled: true,
        notes: prevLast.notes ? [...prevLast.notes] : undefined,
      };
      next.push({ ...d, items: [seed], legs: [] });
      continue;
    }

    // 情況 2：天首是 autoFilled 但地點已經和前一天的最後一站對不上 → 同步更新
    const firstItem = d.items[0]!;
    if (firstItem.autoFilled && firstItem.place.placeId !== prevLast.place.placeId) {
      const updated: ItineraryItem = {
        ...firstItem,
        place: prevLast.place,
        notes: prevLast.notes ? [...prevLast.notes] : firstItem.notes,
      };
      next.push({ ...d, items: [updated, ...d.items.slice(1)] });
      continue;
    }

    next.push(d);
  }
  return next;
}

export const useTripStore = create<TripStore>((set, get) => ({
  trip: null,
  isLoading: false,
  dirty: false,
  persisted: false,

  setTrip: (trip) => {
    setActiveTripId(trip.id);
    set({
      trip: { ...trip, days: chainAll(withAutoFill(trip.days)) },
      persisted: true,
      dirty: false,
    });
  },
  reset: () => {
    setActiveTripId(MOCK_TRIP.id);
    set({
      trip: {
        ...MOCK_TRIP,
        days: chainAll(withAutoFill(MOCK_TRIP.days)),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      persisted: false,
      dirty: false,
    });
  },

  saveTrip: async () => {
    const trip = get().trip;
    if (!trip) return;
    await persistTripImmediate(trip);
    set({ dirty: false, persisted: true });
  },

  saveAsNewTrip: async (name) => {
    const current = get().trip;
    if (!current) throw new Error('沒有可儲存的行程');
    const id = uuid();
    const newTrip: Trip = {
      ...current,
      id,
      name: name.trim() || current.name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await persistTripImmediate(newTrip);
    setActiveTripId(id);
    set({ trip: newTrip, persisted: true, dirty: false });
    return id;
  },

  renameTrip: (name) =>
    set((state) => (state.trip ? { trip: { ...state.trip, name, updatedAt: Date.now() } } : {})),

  changeStartDate: (newStartDate) =>
    set((state) => {
      if (!state.trip) return {};
      const days = reindexDays(state.trip.days, newStartDate);
      return { trip: { ...state.trip, startDate: newStartDate, days, updatedAt: Date.now() } };
    }),

  addItemToDay: (dayId, place, opts) => {
    const isHotel = opts?.isHotel ?? place.types.includes('lodging');
    let newId: string | null = null;
    set((state) => {
      if (!state.trip) return {};
      const days = state.trip.days.map((d) => {
        if (d.id !== dayId) return d;
        const insertIndex = findBestInsertPosition(place, d, 'driving');
        const previous = d.items[insertIndex - 1];
        const arrivalTime = previous
          ? addMinutesToTime(previous.arrivalTime, previous.stayMinutes + 30)
          : '09:00';
        const newItem: ItineraryItem = {
          id: uuid(),
          place,
          arrivalTime,
          stayMinutes: isHotel ? 30 : 60,
          isHotel,
        };
        newId = newItem.id;
        const items = [...d.items];
        items.splice(insertIndex, 0, newItem);
        const legs = recalcLegsArray(items, [...d.legs, { mode: 'driving' }]);
        return { ...d, items, legs };
      });
      return { trip: { ...state.trip, days: chainAll(withAutoFill(days)), updatedAt: Date.now() } };
    });
    return newId;
  },

  removeItem: (dayId, itemId) =>
    set((state) => {
      if (!state.trip) return {};
      const days = state.trip.days.map((d) => {
        if (d.id !== dayId) return d;
        const idx = d.items.findIndex((it) => it.id === itemId);
        if (idx < 0) return d;
        const items = d.items.filter((it) => it.id !== itemId);
        const legs = recalcLegsArray(items, d.legs.filter((_, i) => i !== Math.min(idx, d.legs.length - 1)));
        return { ...d, items, legs };
      });
      return { trip: { ...state.trip, days: chainAll(withAutoFill(days)), updatedAt: Date.now() } };
    }),

  updateItem: (dayId, itemId, patch) =>
    set((state) => {
      if (!state.trip) return {};
      const days = state.trip.days.map((d) => {
        if (d.id !== dayId) return d;
        const items = d.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it));
        return { ...d, items };
      });
      return { trip: { ...state.trip, days: chainAll(days), updatedAt: Date.now() } };
    }),

  reorderItems: (dayId, fromIndex, toIndex) =>
    set((state) => {
      if (!state.trip) return {};
      const days = state.trip.days.map((d) => {
        if (d.id !== dayId) return d;
        const items = [...d.items];
        const [moved] = items.splice(fromIndex, 1);
        if (!moved) return d;
        items.splice(toIndex, 0, moved);
        const legs = recalcLegsArray(items, d.legs);
        return { ...d, items, legs };
      });
      return { trip: { ...state.trip, days: chainAll(withAutoFill(days)), updatedAt: Date.now() } };
    }),

  copyItemToDay: (srcDayId, itemId, destDayId) =>
    set((state) => {
      if (!state.trip) return {};
      const srcDay = state.trip.days.find((d) => d.id === srcDayId);
      const srcItem = srcDay?.items.find((it) => it.id === itemId);
      if (!srcItem) return {};
      const days = state.trip.days.map((d) => {
        if (d.id !== destDayId) return d;
        const insertIndex = findBestInsertPosition(srcItem.place, d, 'driving');
        const newItem: ItineraryItem = {
          ...srcItem,
          id: uuid(),
          notes: srcItem.notes ? [...srcItem.notes] : undefined,
          autoFilled: false,
          arrivalManual: false,
        };
        const items = [...d.items];
        items.splice(insertIndex, 0, newItem);
        const legs = recalcLegsArray(items, [...d.legs, { mode: 'driving' }]);
        return { ...d, items, legs };
      });
      return { trip: { ...state.trip, days: chainAll(withAutoFill(days)), updatedAt: Date.now() } };
    }),

  setLegMode: (dayId, legIndex, mode) =>
    set((state) => {
      if (!state.trip) return {};
      const days = state.trip.days.map((d) => {
        if (d.id !== dayId) return d;
        // 切換模式時把舊的時間清掉，由 refreshLegsForDay 重新取
        const legs = d.legs.map((l, i) =>
          i === legIndex ? { ...l, mode, durationMinutes: undefined, distanceMeters: undefined } : l,
        );
        return { ...d, legs };
      });
      return { trip: { ...state.trip, days: chainAll(days), updatedAt: Date.now() } };
    }),

  setLegDuration: (dayId, legIndex, minutes) =>
    set((state) => {
      if (!state.trip) return {};
      const days = state.trip.days.map((d) => {
        if (d.id !== dayId) return d;
        const legs = d.legs.map((l, i) => (i === legIndex ? { ...l, durationMinutes: minutes } : l));
        return { ...d, legs };
      });
      return { trip: { ...state.trip, days: chainAll(days), updatedAt: Date.now() } };
    }),

  reorderDays: (fromIndex, toIndex) =>
    set((state) => {
      if (!state.trip) return {};
      const days = [...state.trip.days];
      const [moved] = days.splice(fromIndex, 1);
      if (!moved) return {};
      days.splice(toIndex, 0, moved);
      return {
        trip: {
          ...state.trip,
          days: withAutoFill(reindexDays(days, state.trip.startDate)),
          updatedAt: Date.now(),
        },
      };
    }),

  addDayBefore: () =>
    set((state) => {
      if (!state.trip) return {};
      const newDay: DayPlan = {
        id: uuid(),
        dayIndex: 1,
        date: addDays(state.trip.startDate, -1),
        items: [],
        legs: [],
      };
      const newStart = addDays(state.trip.startDate, -1);
      // 把原本 Day 1 的天首標記成 autoFilled，這樣使用者之後在新 Day 1 加東西時，
      // Day 2 的第一站會自動同步成新 Day 1 的最後一站。
      const tagged = state.trip.days.map((d, i) => {
        if (i === 0 && d.items.length > 0 && !d.items[0]!.autoFilled) {
          return { ...d, items: [{ ...d.items[0]!, autoFilled: true }, ...d.items.slice(1)] };
        }
        return d;
      });
      const days = withAutoFill(reindexDays([newDay, ...tagged], newStart));
      return { trip: { ...state.trip, startDate: newStart, days, updatedAt: Date.now() } };
    }),

  addDayAfter: () =>
    set((state) => {
      if (!state.trip) return {};
      const newDay: DayPlan = {
        id: uuid(),
        dayIndex: state.trip.days.length + 1,
        date: addDays(state.trip.startDate, state.trip.days.length),
        items: [],
        legs: [],
      };
      const days = withAutoFill(reindexDays([...state.trip.days, newDay], state.trip.startDate));
      return { trip: { ...state.trip, days, updatedAt: Date.now() } };
    }),

  removeDay: (dayId) =>
    set((state) => {
      if (!state.trip) return {};
      if (state.trip.days.length <= 1) return {};
      const days = state.trip.days.filter((d) => d.id !== dayId);
      return {
        trip: {
          ...state.trip,
          days: withAutoFill(reindexDays(days, state.trip.startDate)),
          updatedAt: Date.now(),
        },
      };
    }),

  toggleFavorite: (place) =>
    set((state) => {
      if (!state.trip) return {};
      const exists = state.trip.favorites.find((f) => f.placeId === place.placeId);
      const favorites = exists
        ? state.trip.favorites.filter((f) => f.placeId !== place.placeId)
        : [...state.trip.favorites, place];
      return { trip: { ...state.trip, favorites, updatedAt: Date.now() } };
    }),

  isFavorited: (placeId) => {
    const trip = get().trip;
    return !!trip?.favorites.find((f) => f.placeId === placeId);
  },

  setPlaceIcon: (placeId, emoji) =>
    set((state) => {
      if (!state.trip) return {};
      const updatePlace = (p: Place): Place =>
        p.placeId === placeId ? { ...p, iconEmoji: emoji } : p;
      const days = state.trip.days.map((d) => ({
        ...d,
        items: d.items.map((it) =>
          it.place.placeId === placeId ? { ...it, place: updatePlace(it.place) } : it,
        ),
      }));
      const favorites = state.trip.favorites.map(updatePlace);
      return { trip: { ...state.trip, days, favorites, updatedAt: Date.now() } };
    }),

  refreshLegsForDay: async (dayId) => {
    const trip = get().trip;
    if (!trip) return;
    const day = trip.days.find((d) => d.id === dayId);
    if (!day || day.items.length < 2) return;

    // 一個個 leg 跟 Google 拿
    let changed = false;
    const updatedLegs = await Promise.all(
      day.legs.map(async (leg, idx) => {
        const origin = day.items[idx]?.place.coordinates;
        const dest = day.items[idx + 1]?.place.coordinates;
        if (!origin || !dest) return leg;
        if (leg.durationMinutes !== undefined && leg.distanceMeters !== undefined) {
          // 已經有資料，跳過（換 mode 時會被清掉，所以這條等於只在首次取）
          return leg;
        }
        const result = await fetchLegDuration(origin, dest, leg.mode);
        if (!result) return leg;
        changed = true;
        return {
          ...leg,
          durationMinutes: result.durationMinutes,
          distanceMeters: result.distanceMeters,
        };
      }),
    );
    if (!changed) return;

    set((state) => {
      if (!state.trip) return {};
      const days = state.trip.days.map((d) => (d.id === dayId ? { ...d, legs: updatedLegs } : d));
      return { trip: { ...state.trip, days: chainAll(days), updatedAt: Date.now() } };
    });
  },

  createNewTrip: async (name, startDate, dayCount) => {
    const current = get().trip;
    if (current) {
      try {
        await persistTripImmediate(current);
      } catch {
        // ignore
      }
    }
    const id = uuid();
    const newTrip: Trip = {
      id,
      name: name.trim() || '新行程',
      startDate,
      days: Array.from({ length: Math.max(1, dayCount) }, (_, i) => ({
        id: uuid(),
        dayIndex: i + 1,
        date: addDays(startDate, i),
        items: [],
        legs: [],
      })),
      favorites: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await persistTripImmediate(newTrip);
    setActiveTripId(id);
    set({ trip: newTrip, persisted: true, dirty: false });
    return id;
  },

  switchToTrip: async (id) => {
    // 切換前「不」自動存——改成手動儲存制，避免每次切換都寫 KV。
    // 未儲存變動的提醒由 UI 層（TripSwitcher）負責。
    const target = await loadTripById(id);
    if (target) {
      setActiveTripId(id);
      set({
        trip: { ...target, days: withAutoFill(target.days) },
        persisted: true,
        dirty: false,
      });
    }
  },

  deleteTrip: async (id) => {
    const current = get().trip;
    await deleteTripFromDB(id);
    if (current && current.id === id) {
      // 刪的是當前 trip，自動切到剩餘最近的；都沒了就 reset 到 mock
      const remaining = await listAllTrips();
      if (remaining.length > 0) {
        setActiveTripId(remaining[0]!.id);
        set({
          trip: { ...remaining[0]!, days: withAutoFill(remaining[0]!.days) },
          persisted: true,
          dirty: false,
        });
      } else {
        get().reset();
      }
    }
  },
}));

/**
 * 自動把「使用者編輯」標成 dirty。
 * 判斷規則：trip.id 不變、但 trip 物件 reference 變了 → 是同一筆行程的內容被改動。
 * （載入 / 切換 / 新建 / 刪除都會換 id 或從 null 起始，不會誤判成 dirty。）
 * 編輯型 action 因此完全不用各自設 dirty。
 */
useTripStore.subscribe((state, prev) => {
  const cur = state.trip;
  const old = prev.trip;
  if (cur && old && cur.id === old.id && cur !== old && !state.dirty) {
    useTripStore.setState({ dirty: true });
  }
});
