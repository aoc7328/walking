import { create } from 'zustand';
import type { Trip, DayPlan, ItineraryItem, DayMark, DayNote, TodoItem } from '../types/trip';
import type { Ledger } from '../types/ledger';
import type { Place, TransportMode } from '../types/place';
import { emptyLedger } from '../utils/ledger';
import { MOCK_TRIP } from '../db/mockData';
import { uuid } from '../utils/format';
import { addDays, addMinutesToTime } from '../utils/date';
import { dayNoteOf } from '../utils/dayNote';
import { findBestInsertPosition } from '../services/routing';
import {
  recalcLegsArray, buildLegTravelCache, relinkLegs, chainAll, withAutoFill,
  reindexDays, clearStrayAutoFill, normalizeDaysForView,
} from '../utils/chain';

// 手機版等其他畫面從這裡拿（邏輯本體在 utils/chain.ts）
export { normalizeDaysForView };
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

  /** 在某一天蓋上 / 移除一個標記符號（已存在→移除，不存在→加入，並確保圖例有對應條目）。 */
  toggleDayMark: (dayId: string, mark: DayMark) => void;
  /** 設定某符號（glyph+color）在圖例裡的說明文字；圖例沒這條就新增。 */
  setMarkLabel: (glyph: string, color: string, label: string) => void;
  /** 從圖例移除某符號，並一併從所有天的 marks 拿掉。 */
  removeMark: (glyph: string, color: string) => void;

  /** 編輯帳本：以 mutator 改 ledger 並寫回（沒設過帳本會先補空的）。trip ref 變動 → 自動標 dirty。 */
  updateLedger: (mutate: (ledger: Ledger) => Ledger) => void;

  /** 這天的備註（單一，可帶圖示）：設定/更新 / 清除 / 套用到其他天。與 items 獨立，不動路線與時間鏈。 */
  setDayNote: (dayId: string, patch: Partial<DayNote>) => void;
  clearDayNote: (dayId: string) => void;
  copyDayNoteToDay: (dayId: string, destDayId: string) => void;

  /** 待辦清單（筆記提醒）：新增 / 編輯 / 刪除 / 拖曳排序。私人，不進分享/匯出。 */
  addTodo: () => void;
  patchTodo: (id: string, patch: Partial<Pick<TodoItem, 'done' | 'text' | 'note' | 'url' | 'amount'>>) => void;
  removeTodo: (id: string) => void;
  reorderTodos: (activeId: string, overId: string) => void;

  // 多 trip 管理
  createNewTrip: (name: string, startDate: string, dayCount: number) => Promise<string>;
  switchToTrip: (id: string) => Promise<void>;
  deleteTrip: (id: string) => Promise<void>;
}

export const useTripStore = create<TripStore>((set, get) => ({
  trip: null,
  isLoading: false,
  dirty: false,
  persisted: false,

  setTrip: (trip) => {
    setActiveTripId(trip.id);
    set({
      trip: { ...trip, days: normalizeDaysForView(trip.days) },
      persisted: true,
      dirty: false,
    });
  },
  reset: () => {
    setActiveTripId(MOCK_TRIP.id);
    set({
      trip: {
        ...MOCK_TRIP,
        days: normalizeDaysForView(MOCK_TRIP.days),
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
        // 一律加在當天「最後一站」之後，不再用地理位置自動插中間
        //（那會打亂使用者原本排好的順序與時間）。
        const insertIndex = d.items.length;
        const previous = d.items[insertIndex - 1];
        // 交通時間還沒跟 Google 拿到，先接在前站離開時間；leg 回來後 chainAll 會補上
        const arrivalTime = previous
          ? addMinutesToTime(previous.arrivalTime, previous.stayMinutes)
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
        const cache = buildLegTravelCache(d.items, d.legs);
        const items = d.items.filter((it) => it.id !== itemId);
        // 刪除中間站會讓前一段接到新的下一站，需重接 legs 才不會留下舊時間
        const positional = recalcLegsArray(items, d.legs.filter((_, i) => i !== Math.min(idx, d.legs.length - 1)));
        const legs = relinkLegs(items, positional, cache);
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
        const cache = buildLegTravelCache(d.items, d.legs);
        const moving = [...d.items];
        const [moved] = moving.splice(fromIndex, 1);
        if (!moved) return d;
        moving.splice(toIndex, 0, moved);
        // 銜接站被拖離天首就是使用者刻意放的（多半是拖到天尾當回飯店），不能再被自動覆寫
        const items = clearStrayAutoFill(moving);
        // 依新順序重接 legs：同一地點對(+mode)的時間沿用，新的兩點清空待重抓
        const legs = relinkLegs(items, recalcLegsArray(items, d.legs), cache);
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
        const cache = buildLegTravelCache(d.items, d.legs);
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
        // 中插會把原本一段拆成兩段，重接 legs：未變動的沿用、被拆的兩段清空待重抓
        const positional = recalcLegsArray(items, [...d.legs, { mode: 'driving' }]);
        const legs = relinkLegs(items, positional, cache);
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
          days: chainAll(withAutoFill(reindexDays(days, state.trip.startDate))),
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
      // 原本會把舊 Day 1 的天首硬標成 autoFilled，讓它之後被新 Day 1 的最後站「更新」——
      // 但那一站是使用者真的排的地點，這樣等於默默把它換掉。改成不動它：
      // 新 Day 1 有東西之後，withAutoFill 會在舊 Day 1 前面「插入」銜接站，原站保留。
      const days = chainAll(withAutoFill(reindexDays([newDay, ...state.trip.days], newStart)));
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
      const days = chainAll(withAutoFill(reindexDays([...state.trip.days, newDay], state.trip.startDate)));
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
          days: chainAll(withAutoFill(reindexDays(days, state.trip.startDate))),
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

  toggleDayMark: (dayId, mark) =>
    set((state) => {
      if (!state.trip) return {};
      const same = (m: DayMark) => m.glyph === mark.glyph && m.color === mark.color;
      let added = false;
      const days = state.trip.days.map((d) => {
        if (d.id !== dayId) return d;
        const marks = d.marks ?? [];
        if (marks.some(same)) {
          return { ...d, marks: marks.filter((m) => !same(m)) };
        }
        added = true;
        return { ...d, marks: [...marks, { glyph: mark.glyph, color: mark.color }] };
      });
      // 新加入的符號若圖例還沒有，補一條空說明讓使用者去填
      let markLegend = state.trip.markLegend ?? [];
      if (added && !markLegend.some(same)) {
        markLegend = [...markLegend, { glyph: mark.glyph, color: mark.color, label: '' }];
      }
      return { trip: { ...state.trip, days, markLegend, updatedAt: Date.now() } };
    }),

  setMarkLabel: (glyph, color, label) =>
    set((state) => {
      if (!state.trip) return {};
      const list = state.trip.markLegend ?? [];
      const idx = list.findIndex((e) => e.glyph === glyph && e.color === color);
      const markLegend =
        idx >= 0
          ? list.map((e, i) => (i === idx ? { ...e, label } : e))
          : [...list, { glyph, color, label }];
      return { trip: { ...state.trip, markLegend, updatedAt: Date.now() } };
    }),

  removeMark: (glyph, color) =>
    set((state) => {
      if (!state.trip) return {};
      const same = (m: DayMark) => m.glyph === glyph && m.color === color;
      const markLegend = (state.trip.markLegend ?? []).filter((e) => !same(e));
      const days = state.trip.days.map((d) =>
        d.marks?.some(same) ? { ...d, marks: d.marks.filter((m) => !same(m)) } : d,
      );
      return { trip: { ...state.trip, days, markLegend, updatedAt: Date.now() } };
    }),

  updateLedger: (mutate) =>
    set((state) => {
      if (!state.trip) return {};
      const current = state.trip.ledger ?? emptyLedger();
      const ledger = mutate(current);
      return { trip: { ...state.trip, ledger, updatedAt: Date.now() } };
    }),

  // 這天的備註：只改該天的 note，不碰 items/legs，因此不需 chainAll/withAutoFill。
  // 讀取用 dayNoteOf 兼容舊版 cards[]；一經編輯/套用就寫成單一 note 並清掉 legacy cards。
  setDayNote: (dayId, patch) =>
    set((state) => {
      if (!state.trip) return {};
      const days = state.trip.days.map((d) => {
        if (d.id !== dayId) return d;
        const base = dayNoteOf(d) ?? { text: '' };
        const next = { ...d, note: { ...base, ...patch } };
        delete next.cards; // 遷移掉舊版多卡片
        return next;
      });
      return { trip: { ...state.trip, days, updatedAt: Date.now() } };
    }),

  clearDayNote: (dayId) =>
    set((state) => {
      if (!state.trip) return {};
      const days = state.trip.days.map((d) => {
        if (d.id !== dayId) return d;
        const next = { ...d };
        delete next.note;
        delete next.cards;
        return next;
      });
      return { trip: { ...state.trip, days, updatedAt: Date.now() } };
    }),

  copyDayNoteToDay: (dayId, destDayId) =>
    set((state) => {
      if (!state.trip) return {};
      const src = dayNoteOf(state.trip.days.find((d) => d.id === dayId));
      if (!src) return {};
      const days = state.trip.days.map((d) => {
        if (d.id !== destDayId) return d;
        const next = { ...d, note: { ...src } };
        delete next.cards;
        return next;
      });
      return { trip: { ...state.trip, days, updatedAt: Date.now() } };
    }),

  // 待辦清單：只改 trip.todos，不碰 days/items。
  addTodo: () =>
    set((state) => {
      if (!state.trip) return {};
      const todos: TodoItem[] = [...(state.trip.todos ?? []), { id: uuid(), done: false, text: '' }];
      return { trip: { ...state.trip, todos, updatedAt: Date.now() } };
    }),

  patchTodo: (id, patch) =>
    set((state) => {
      if (!state.trip) return {};
      const todos = (state.trip.todos ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t));
      return { trip: { ...state.trip, todos, updatedAt: Date.now() } };
    }),

  removeTodo: (id) =>
    set((state) => {
      if (!state.trip) return {};
      const todos = (state.trip.todos ?? []).filter((t) => t.id !== id);
      return { trip: { ...state.trip, todos, updatedAt: Date.now() } };
    }),

  reorderTodos: (activeId, overId) =>
    set((state) => {
      if (!state.trip) return {};
      const todos = [...(state.trip.todos ?? [])];
      const from = todos.findIndex((t) => t.id === activeId);
      const to = todos.findIndex((t) => t.id === overId);
      if (from < 0 || to < 0 || from === to) return {};
      const [moved] = todos.splice(from, 1);
      todos.splice(to, 0, moved!);
      return { trip: { ...state.trip, todos, updatedAt: Date.now() } };
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
        trip: { ...target, days: normalizeDaysForView(target.days) },
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
          trip: { ...remaining[0]!, days: normalizeDaysForView(remaining[0]!.days) },
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
