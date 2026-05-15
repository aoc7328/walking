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
} from '../db/repository';
import { db } from '../db/schema';

interface TripStore {
  trip: Trip | null;
  isLoading: boolean;
  setTrip: (trip: Trip) => void;
  reset: () => void;

  renameTrip: (name: string) => void;
  changeStartDate: (newStartDate: string) => void;

  addItemToDay: (dayId: string, place: Place, opts?: { isHotel?: boolean }) => string | null;
  removeItem: (dayId: string, itemId: string) => void;
  updateItem: (dayId: string, itemId: string, patch: Partial<Pick<ItineraryItem, 'arrivalTime' | 'stayMinutes' | 'notes'>>) => void;
  reorderItems: (dayId: string, fromIndex: number, toIndex: number) => void;
  setLegMode: (dayId: string, legIndex: number, mode: TransportMode) => void;
  setLegDuration: (dayId: string, legIndex: number, minutes: number) => void;

  reorderDays: (fromIndex: number, toIndex: number) => void;
  addDayBefore: () => void;
  addDayAfter: () => void;
  removeDay: (dayId: string) => void;

  toggleFavorite: (place: Place) => void;
  isFavorited: (placeId: string) => boolean;

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

function reindexDays(days: DayPlan[], startDate: string): DayPlan[] {
  return days.map((d, idx) => ({
    ...d,
    dayIndex: idx + 1,
    date: addDays(startDate, idx),
  }));
}

/**
 * 把每個空白的日子（items.length === 0）自動填入前一天的最後一站，
 * 並標記為飯店（isHotel），預設 09:00 抵達、停留 30 分。Day 1 不處理。
 *
 * 純函數，可重複套用（idempotent）：填好的日子下一次跑就會跳過。
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

    // 情況 1：空白天 → 填入前一天的最後一站，標記為 autoFilled
    if (d.items.length === 0) {
      const seed: ItineraryItem = {
        id: uuid(),
        place: prevLast.place,
        arrivalTime: '09:00',
        stayMinutes: 30,
        isHotel: true,
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

  setTrip: (trip) => {
    setActiveTripId(trip.id);
    set({ trip: { ...trip, days: withAutoFill(trip.days) } });
  },
  reset: () => {
    setActiveTripId(MOCK_TRIP.id);
    set({
      trip: {
        ...MOCK_TRIP,
        days: withAutoFill(MOCK_TRIP.days),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });
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
      return { trip: { ...state.trip, days: withAutoFill(days), updatedAt: Date.now() } };
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
      return { trip: { ...state.trip, days: withAutoFill(days), updatedAt: Date.now() } };
    }),

  updateItem: (dayId, itemId, patch) =>
    set((state) => {
      if (!state.trip) return {};
      const days = state.trip.days.map((d) => {
        if (d.id !== dayId) return d;
        const items = d.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it));
        return { ...d, items };
      });
      return { trip: { ...state.trip, days, updatedAt: Date.now() } };
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
      return { trip: { ...state.trip, days: withAutoFill(days), updatedAt: Date.now() } };
    }),

  setLegMode: (dayId, legIndex, mode) =>
    set((state) => {
      if (!state.trip) return {};
      const days = state.trip.days.map((d) => {
        if (d.id !== dayId) return d;
        const legs = d.legs.map((l, i) => (i === legIndex ? { ...l, mode } : l));
        return { ...d, legs };
      });
      return { trip: { ...state.trip, days, updatedAt: Date.now() } };
    }),

  setLegDuration: (dayId, legIndex, minutes) =>
    set((state) => {
      if (!state.trip) return {};
      const days = state.trip.days.map((d) => {
        if (d.id !== dayId) return d;
        const legs = d.legs.map((l, i) => (i === legIndex ? { ...l, durationMinutes: minutes } : l));
        return { ...d, legs };
      });
      return { trip: { ...state.trip, days, updatedAt: Date.now() } };
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
    set({ trip: newTrip });
    return id;
  },

  switchToTrip: async (id) => {
    const current = get().trip;
    if (current && current.id !== id) {
      try {
        await persistTripImmediate(current);
      } catch {
        // ignore
      }
    }
    const target = await db.trips.get(id);
    if (target) {
      setActiveTripId(id);
      set({ trip: { ...target, days: withAutoFill(target.days) } });
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
        set({ trip: { ...remaining[0]!, days: withAutoFill(remaining[0]!.days) } });
      } else {
        get().reset();
      }
    }
  },
}));
