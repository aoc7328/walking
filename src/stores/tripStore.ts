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

/** 自動儲存的狀態。 */
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface TripStore {
  trip: Trip | null;
  isLoading: boolean;
  /** 有還沒寫進 KV 的編輯（由 subscribe 自動偵測，存成功後歸 false） */
  dirty: boolean;
  /** 自動儲存的狀態，給畫面顯示「儲存中／已儲存／存不進去」。 */
  saveState: SaveState;
  /** 最近一次成功寫入 KV 的時間。 */
  lastSavedAt: number | null;
  /** 最近一次儲存失敗的原因（成功後清掉）。 */
  saveError: string | null;
  /** 目前這筆 trip 是否已是 KV 既有行程（從下拉選單／啟動載入／新建進來 = true；
   *  mock 預設範例 = false）。決定按儲存是「覆蓋」還是「另存新行程」。 */
  persisted: boolean;
  setTrip: (trip: Trip) => void;
  reset: () => void;

  /** 把目前 trip 覆蓋寫回 KV（給「儲存」按鈕用，persisted 時） */
  saveTrip: () => Promise<void>;
  /** 存失敗後手動重試（畫面上點那顆「未同步」用）。 */
  retrySave: () => void;
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

/**
 * 這趟裡同一個地點（同 placeId）已經設過的圖示。
 * 圖示是「地點」的屬性，不是「某一天那張卡」的：飯店住三晚會出現三次以上，設一次要全部一樣。
 * setPlaceIcon 負責把既有的全部更新；這支負責讓「之後再新加進來的」也接上——
 * 從搜尋加的 place 是 Google 回來的新物件，本身不會帶圖示。
 */
function findPlaceIcon(trip: Trip, placeId: string): string | undefined {
  if (!placeId) return undefined;
  for (const d of trip.days) {
    for (const it of d.items) {
      if (it.place.placeId === placeId && it.place.iconEmoji) return it.place.iconEmoji;
    }
  }
  return trip.favorites.find((f) => f.placeId === placeId && f.iconEmoji)?.iconEmoji;
}

export const useTripStore = create<TripStore>((set, get) => ({
  trip: null,
  isLoading: false,
  dirty: false,
  persisted: false,
  saveState: 'idle',
  lastSavedAt: null,
  saveError: null,

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

  retrySave: () => {
    retryIndex = 0;
    void runAutosave(true);
  },

  saveTrip: async () => {
    const trip = get().trip;
    if (!trip) return;
    cancelAutosave();
    await persistTripImmediate(trip);
    set({ dirty: false, persisted: true, saveState: 'saved', lastSavedAt: Date.now(), saveError: null });
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
      // 同一地點之前設過圖示就直接沿用，不管這張是先加還是後加，看起來都要一樣
      const inherited = place.iconEmoji ? undefined : findPlaceIcon(state.trip, place.placeId);
      const placeToAdd: Place = inherited ? { ...place, iconEmoji: inherited } : place;
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
          place: placeToAdd,
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
 * ── 自動儲存 ──────────────────────────────────────────────────────
 *
 * 不再需要按「儲存」。任何編輯都會在停手 0.8 秒後寫回 KV；一直改個不停的話
 * 最多 5 秒也一定會存一次（不然拖拉排一整天可能一次都沒存到）。
 *
 * 為什麼還是要防抖而不是每次變動都寫：整份 trip 是一次 PUT，這趟 17 天的
 * 行程就有 330KB，而「在備註欄打一個字」也算一次變動。在國外用飯店 Wi-Fi
 * 每個按鍵送 330KB 會塞爆上行頻寬，跟寫入額度無關（帳號是 Cloudflare Pro）。
 *
 * 失敗（出國沒訊號最常見）不會把變更丟掉：dirty 保持 true、狀態轉成 error，
 * 依 5s → 15s → 30s → 60s 退避重試，網路一恢復（online 事件）立刻再試一次，
 * 畫面上也會顯示「未同步」讓使用者知道。關分頁時 AppShell 還有 keepalive 兜底。
 *
 * mock 範例行程（persisted === false）刻意不自動存：它沒有可覆寫的目標，
 * 一定要使用者先取名另存，否則會在 KV 裡默默長出一堆沒人要的範例行程。
 */
const AUTOSAVE_DEBOUNCE_MS = 800;
const AUTOSAVE_MAX_WAIT_MS = 5000;
const RETRY_DELAYS_MS = [5000, 15000, 30000, 60000];

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let firstDirtyAt = 0;
let retryIndex = 0;
let inFlight = false;
/** 最近一次「已經寫進去」的 trip 物件，用來擋掉內容沒變的重複寫入。 */
let lastSavedTrip: Trip | null = null;

function cancelAutosave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  firstDirtyAt = 0;
  retryIndex = 0;
}

function scheduleAutosave(delayMs?: number): void {
  if (saveTimer) clearTimeout(saveTimer);
  let delay = delayMs;
  if (delay === undefined) {
    // 一直在改就不要無限延後：超過上限就立刻存
    const waited = firstDirtyAt ? Date.now() - firstDirtyAt : 0;
    delay = waited >= AUTOSAVE_MAX_WAIT_MS ? 0 : AUTOSAVE_DEBOUNCE_MS;
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void runAutosave();
  }, delay);
}

async function runAutosave(manual = false): Promise<void> {
  const { trip, persisted, dirty } = useTripStore.getState();
  if (!trip || !persisted) return;
  if (!dirty && !manual) return;
  // 內容沒變就不要重複寫（每個編輯 action 都會產生新物件，reference 比對就夠）
  if (trip === lastSavedTrip && !manual) {
    useTripStore.setState({ dirty: false, saveState: 'saved' });
    return;
  }
  if (inFlight) {
    scheduleAutosave(AUTOSAVE_DEBOUNCE_MS);
    return;
  }

  inFlight = true;
  useTripStore.setState({ saveState: 'saving' });
  const snapshot = trip;
  try {
    await persistTripImmediate(snapshot);
    lastSavedTrip = snapshot;
    firstDirtyAt = 0;
    retryIndex = 0;
    // 存的期間又改了 → 那些變更還沒進去，維持 dirty 並排下一次
    const changedDuringSave = useTripStore.getState().trip !== snapshot;
    useTripStore.setState({
      dirty: changedDuringSave,
      saveState: 'saved',
      lastSavedAt: Date.now(),
      saveError: null,
    });
    if (changedDuringSave) {
      firstDirtyAt = Date.now();
      scheduleAutosave();
    }
  } catch (err) {
    // 失敗一律保留 dirty，資料還在記憶體裡，不會因為存不進去就消失
    useTripStore.setState({
      dirty: true,
      saveState: 'error',
      saveError: err instanceof Error ? err.message : String(err),
    });
    const delay = RETRY_DELAYS_MS[Math.min(retryIndex, RETRY_DELAYS_MS.length - 1)]!;
    retryIndex += 1;
    scheduleAutosave(delay);
  } finally {
    inFlight = false;
  }
}

/**
 * 偵測「使用者編輯」：trip.id 不變、但 trip 物件 reference 變了。
 * （載入 / 切換 / 新建 / 刪除都會換 id 或從 null 起始，不會誤判。）
 * 編輯型 action 因此完全不用各自處理 dirty 或儲存。
 */
useTripStore.subscribe((state, prev) => {
  const cur = state.trip;
  const old = prev.trip;
  if (!cur || !old || cur.id !== old.id || cur === old) return;
  if (!state.dirty) {
    firstDirtyAt = Date.now();
    // 這行會再觸發一次 subscribe，但那次 cur === old，上面就擋掉了
    useTripStore.setState({ dirty: true });
  }
  scheduleAutosave();
});

// 換行程 / 載入新行程：把上一筆的自動儲存排程清掉，免得存到已經不在畫面上的那份
useTripStore.subscribe((state, prev) => {
  if (state.trip?.id !== prev.trip?.id) {
    cancelAutosave();
    lastSavedTrip = state.trip ?? null;
    useTripStore.setState({ saveState: 'idle', saveError: null });
  }
});

// 網路回來就立刻補存一次，不用等退避計時器
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    const { dirty, persisted, saveState } = useTripStore.getState();
    if (dirty && persisted && saveState === 'error') {
      retryIndex = 0;
      scheduleAutosave(0);
    }
  });
}
