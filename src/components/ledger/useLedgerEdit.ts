import { useMemo } from 'react';
import { useTripStore } from '../../stores/tripStore';
import type {
  Ledger, Accommodation, Restaurant, Expense, PaymentMethod, CategoryBudget, ExpensePhase, ExpenseCategory, ReservationDefaults, VjwEntry, Ticket, CertKind, CertRequest,
} from '../../types/ledger';
import { uuid } from '../../utils/format';
import { toISODate, addDays } from '../../utils/date';
import { EXPENSE_CATEGORIES, type HotelStay } from '../../utils/ledger';

function todayISO(): string {
  return toISODate(new Date());
}

function blankAccommodation(): Accommodation {
  return { id: uuid(), paid: false, area: '', name: '', checkIn: todayISO(), nights: 1, price: 0, currency: 'TWD', meals: '', platform: '', chargeDate: '' };
}
function blankRestaurant(localCurrency: string): Restaurant {
  return { id: uuid(), date: todayISO(), time: '', name: '', cuisine: '', status: 'reserved', paid: false, currency: localCurrency };
}
function blankExpense(phase: ExpensePhase, localCurrency: string): Expense {
  return {
    id: uuid(), phase, category: phase === 'during' ? '飲食' : '其他', title: '',
    date: phase === 'during' ? todayISO() : undefined,
    amount: 0, currency: phase === 'during' ? localCurrency : 'TWD', paid: phase === 'pre',
  };
}

/** 依 id 把陣列中的 activeId 移到 overId 的位置（回傳新陣列；無變動回原陣列）。 */
function moveById<T extends { id: string }>(arr: T[], activeId: string, overId: string): T[] {
  const from = arr.findIndex((x) => x.id === activeId);
  const to = arr.findIndex((x) => x.id === overId);
  if (from < 0 || to < 0 || from === to) return arr;
  const next = [...arr];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/** 所有帳本編輯動作（新增 / 改某欄 / 刪除），都透過 updateLedger 寫回（自動標 dirty）。 */
export function useLedgerEdit() {
  const updateLedger = useTripStore((s) => s.updateLedger);
  return useMemo(() => {
    const upd = (fn: (l: Ledger) => Ledger) => updateLedger(fn);
    return {
      setMeta: (patch: Partial<Pick<Ledger, 'localCurrency' | 'fxRate'>>) => upd((l) => ({ ...l, ...patch })),
      setDestination: (name: string, currency: string, language: string) =>
        upd((l) => ({ ...l, destination: name, localCurrency: currency, language })),

      setColWidth: (tableId: string, key: string, width: number) =>
        upd((l) => {
          const v = l.view ?? {};
          const cw = { ...(v.colWidths ?? {}) };
          cw[tableId] = { ...(cw[tableId] ?? {}), [key]: width };
          return { ...l, view: { ...v, colWidths: cw } };
        }),
      toggleCol: (tableId: string, key: string) =>
        upd((l) => {
          const v = l.view ?? {};
          const hc = { ...(v.hiddenCols ?? {}) };
          const cur = new Set(hc[tableId] ?? []);
          if (cur.has(key)) cur.delete(key); else cur.add(key);
          hc[tableId] = [...cur];
          return { ...l, view: { ...v, hiddenCols: hc } };
        }),
      setHiddenCols: (tableId: string, keys: string[]) =>
        upd((l) => {
          const v = l.view ?? {};
          const hc = { ...(v.hiddenCols ?? {}) };
          hc[tableId] = keys;
          return { ...l, view: { ...v, hiddenCols: hc } };
        }),
      setReservation: (patch: Partial<ReservationDefaults>) => upd((l) => ({ ...l, reservation: { ...(l.reservation ?? {}), ...patch } })),

      /** Visit Japan Web 入境 QR（一人一張）。imageKey 是已上傳到 R2 的物件 key。 */
      addVjwEntry: (imageKey: string) => upd((l) => ({ ...l, vjw: [...(l.vjw ?? []), { id: uuid(), imageKey } as VjwEntry] })),
      patchVjwEntry: (id: string, patch: Partial<Pick<VjwEntry, 'nameZh' | 'nameEn'>>) =>
        upd((l) => ({ ...l, vjw: (l.vjw ?? []).map((v) => (v.id === id ? { ...v, ...patch } : v)) })),
      delVjwEntry: (id: string) => upd((l) => ({ ...l, vjw: (l.vjw ?? []).filter((v) => v.id !== id) })),

      /** 票券 / 訂位截圖（圖已上傳 R2，這裡只記 key）。 */
      addTicket: (t: { title: string; imageKey: string; date?: string; note?: string }) =>
        upd((l) => ({ ...l, tickets: [...(l.tickets ?? []), { id: uuid(), ...t }] })),
      patchTicket: (id: string, patch: Partial<Omit<Ticket, 'id'>>) =>
        upd((l) => ({ ...l, tickets: (l.tickets ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      delTicket: (id: string) => upd((l) => ({ ...l, tickets: (l.tickets ?? []).filter((t) => t.id !== id) })),

      /** 證明文件申請牌（颱風延誤/取消/住宿證明）。 */
      addCert: (kind: CertKind) =>
        upd((l) => ({ ...l, certs: [...(l.certs ?? []), { id: uuid(), kind, target: '', date: todayISO() } as CertRequest] })),
      patchCert: (id: string, patch: Partial<Omit<CertRequest, 'id'>>) =>
        upd((l) => ({ ...l, certs: (l.certs ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      delCert: (id: string) => upd((l) => ({ ...l, certs: (l.certs ?? []).filter((c) => c.id !== id) })),
      /**
       * 把住宿清單一次帶成住宿證明牌——每一間飯店都要一張，手打太累也容易漏。
       * 已經有同名同入住日的牌就跳過（可重複按，不會長出重複的牌）。
       */
      importStayCerts: () =>
        upd((l) => {
          const certs = [...(l.certs ?? [])];
          for (const a of l.accommodations) {
            const target = a.name.trim();
            if (!target) continue;
            const date = a.checkIn;
            const exists = certs.some(
              (c) => c.kind === 'stay' && c.target.trim() === target && (c.date ?? '') === (date ?? ''),
            );
            if (exists) continue;
            certs.push({
              id: uuid(),
              kind: 'stay',
              target,
              date,
              endDate: date ? addDays(date, Math.max(1, a.nights)) : undefined,
              guestName: l.reservation?.bookingName,
              partySize: l.reservation?.partySize,
            });
          }
          return { ...l, certs };
        }),

      /**
       * 新增住宿：有前一筆就沿用不常變的欄位當參考——
       * 入住日自動接在前一筆退房日（= 前一筆入住日 + 晚數，至少算 1 晚），
       * 平台 / 信用卡 / 幣別直接帶入前一筆；飯店名・區域・價格・附餐等留空自己填。
       */
      addAccommodation: () => upd((l) => {
        const prev = l.accommodations[l.accommodations.length - 1];
        const base = blankAccommodation();
        const next: Accommodation = prev
          ? {
              ...base,
              checkIn: prev.checkIn ? addDays(prev.checkIn, Math.max(1, prev.nights)) : base.checkIn,
              currency: prev.currency,
              platform: prev.platform,
              paymentMethodId: prev.paymentMethodId,
            }
          : base;
        return { ...l, accommodations: [...l.accommodations, next] };
      }),
      /** 從行程帶入住宿段：同 placeId 或同名→更新入住日/晚數；找不到→新增一列。 */
      importStays: (stays: HotelStay[]) => upd((l) => {
        const accs = [...l.accommodations];
        for (const s of stays) {
          const idx = accs.findIndex((a) => (a.placeId && s.placeId && a.placeId === s.placeId) || (!!a.name && a.name.trim() === s.name.trim()));
          if (idx >= 0) {
            accs[idx] = { ...accs[idx]!, placeId: s.placeId ?? accs[idx]!.placeId, checkIn: s.checkIn, nights: s.nights, area: accs[idx]!.area || s.area };
          } else {
            accs.push({ id: uuid(), paid: false, placeId: s.placeId, area: s.area, name: s.name, checkIn: s.checkIn, nights: s.nights, price: 0, currency: 'TWD', platform: '' });
          }
        }
        return { ...l, accommodations: accs };
      }),
      patchAccommodation: (id: string, patch: Partial<Accommodation>) =>
        upd((l) => ({ ...l, accommodations: l.accommodations.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      delAccommodation: (id: string) => upd((l) => ({ ...l, accommodations: l.accommodations.filter((a) => a.id !== id) })),
      reorderAccommodations: (activeId: string, overId: string) => upd((l) => ({ ...l, accommodations: moveById(l.accommodations, activeId, overId) })),

      /** 新增餐廳：有前一筆就沿用它的日期與時間（同一天常一次訂好幾餐），其餘留空自己填。 */
      addRestaurant: (localCurrency: string) => upd((l) => {
        const prev = l.restaurants[l.restaurants.length - 1];
        const base = blankRestaurant(localCurrency);
        const next: Restaurant = prev ? { ...base, date: prev.date, time: prev.time } : base;
        return { ...l, restaurants: [...l.restaurants, next] };
      }),
      patchRestaurant: (id: string, patch: Partial<Restaurant>) =>
        upd((l) => ({ ...l, restaurants: l.restaurants.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      delRestaurant: (id: string) => upd((l) => ({ ...l, restaurants: l.restaurants.filter((r) => r.id !== id) })),
      reorderRestaurants: (activeId: string, overId: string) => upd((l) => ({ ...l, restaurants: moveById(l.restaurants, activeId, overId) })),

      addExpense: (phase: ExpensePhase, localCurrency: string) => upd((l) => ({ ...l, expenses: [...l.expenses, blankExpense(phase, localCurrency)] })),
      /** 用填好的值直接新增一筆流水帳（給上方快速輸入列用）。 */
      addDuringEntry: (data: { date: string; category: ExpenseCategory; title: string; amount: number; currency: string; paymentMethodId?: string }) =>
        upd((l) => ({ ...l, expenses: [...l.expenses, { id: uuid(), phase: 'during', paid: true, ...data, paymentMethodId: data.paymentMethodId || undefined }] })),
      patchExpense: (id: string, patch: Partial<Expense>) =>
        upd((l) => ({ ...l, expenses: l.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      delExpense: (id: string) => upd((l) => ({ ...l, expenses: l.expenses.filter((e) => e.id !== id) })),
      /** 只重排某 phase 的通用支出（固定項=pre），其餘 phase 的項目位置不動。 */
      reorderExpenses: (phase: ExpensePhase, activeId: string, overId: string) =>
        upd((l) => {
          const phaseItems = l.expenses.filter((e) => e.phase === phase);
          const moved = moveById(phaseItems, activeId, overId);
          if (moved === phaseItems) return l;
          let i = 0;
          const expenses = l.expenses.map((e) => (e.phase === phase ? moved[i++]! : e));
          return { ...l, expenses };
        }),

      addPayment: () => upd((l) => ({ ...l, paymentMethods: [...l.paymentMethods, { id: uuid(), name: '', kind: 'card' as const }] })),
      patchPayment: (id: string, patch: Partial<PaymentMethod>) =>
        upd((l) => ({ ...l, paymentMethods: l.paymentMethods.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      delPayment: (id: string) => upd((l) => ({ ...l, paymentMethods: l.paymentMethods.filter((p) => p.id !== id) })),

      addChannel: (name: string) => upd((l) => (name && !l.channels.includes(name) ? { ...l, channels: [...l.channels, name] } : l)),
      delChannel: (name: string) => upd((l) => ({ ...l, channels: l.channels.filter((c) => c !== name) })),

      addCategory: (name: string) =>
        upd((l) => {
          const cur = l.categories && l.categories.length ? l.categories : [...EXPENSE_CATEGORIES];
          return name && !cur.includes(name) ? { ...l, categories: [...cur, name] } : l;
        }),
      delCategory: (name: string) =>
        upd((l) => {
          const cur = l.categories && l.categories.length ? l.categories : [...EXPENSE_CATEGORIES];
          return { ...l, categories: cur.filter((c) => c !== name), budgets: l.budgets.filter((b) => b.category !== name) };
        }),

      setBudget: (category: ExpenseCategory, amount: number) =>
        upd((l) => {
          const exists = l.budgets.some((b) => b.category === category);
          const budgets: CategoryBudget[] = exists
            ? l.budgets.map((b) => (b.category === category ? { ...b, amount } : b))
            : [...l.budgets, { category, amount }];
          return { ...l, budgets };
        }),
    };
  }, [updateLedger]);
}
