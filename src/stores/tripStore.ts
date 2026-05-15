import { create } from 'zustand';
import type { Trip, DayPlan, ItineraryItem, Leg } from '../types/trip';
import type { Place, TransportMode } from '../types/place';
import { MOCK_TRIP } from '../db/mockData';
import { uuid } from '../utils/format';
import { addDays, addMinutesToTime } from '../utils/date';
import { findBestInsertPosition } from '../services/routing';

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

  toggleFavorite: (place: Place) => void;
  isFavorited: (placeId: string) => boolean;
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
    if (d.items.length === 0 && prev && prev.items.length > 0) {
      const last = prev.items[prev.items.length - 1]!;
      const seed: ItineraryItem = {
        id: uuid(),
        place: last.place,
        arrivalTime: '09:00',
        stayMinutes: 30,
        isHotel: true,
        notes: last.notes ? [...last.notes] : undefined,
      };
      next.push({ ...d, items: [seed], legs: [] });
    } else {
      next.push(d);
    }
  }
  return next;
}

export const useTripStore = create<TripStore>((set, get) => ({
  trip: null,
  isLoading: false,

  setTrip: (trip) => set({ trip: { ...trip, days: withAutoFill(trip.days) } }),
  reset: () =>
    set({
      trip: {
        ...MOCK_TRIP,
        days: withAutoFill(MOCK_TRIP.days),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    }),

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
      return { trip: { ...state.trip, days, updatedAt: Date.now() } };
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
      return { trip: { ...state.trip, days, updatedAt: Date.now() } };
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
      const days = withAutoFill(reindexDays([newDay, ...state.trip.days], newStart));
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
}));
