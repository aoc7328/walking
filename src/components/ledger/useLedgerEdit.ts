import { useMemo } from 'react';
import { useTripStore } from '../../stores/tripStore';
import type {
  Ledger, Accommodation, Restaurant, Expense, PaymentMethod, CategoryBudget, ExpensePhase, ExpenseCategory, ReservationDefaults,
} from '../../types/ledger';
import { uuid } from '../../utils/format';
import { toISODate } from '../../utils/date';
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

/** 所有帳本編輯動作（新增 / 改某欄 / 刪除），都透過 updateLedger 寫回（自動標 dirty）。 */
export function useLedgerEdit() {
  const updateLedger = useTripStore((s) => s.updateLedger);
  return useMemo(() => {
    const upd = (fn: (l: Ledger) => Ledger) => updateLedger(fn);
    return {
      setMeta: (patch: Partial<Pick<Ledger, 'localCurrency' | 'fxRate'>>) => upd((l) => ({ ...l, ...patch })),
      setReservation: (patch: Partial<ReservationDefaults>) => upd((l) => ({ ...l, reservation: { ...(l.reservation ?? {}), ...patch } })),

      addAccommodation: () => upd((l) => ({ ...l, accommodations: [...l.accommodations, blankAccommodation()] })),
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

      addRestaurant: (localCurrency: string) => upd((l) => ({ ...l, restaurants: [...l.restaurants, blankRestaurant(localCurrency)] })),
      patchRestaurant: (id: string, patch: Partial<Restaurant>) =>
        upd((l) => ({ ...l, restaurants: l.restaurants.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      delRestaurant: (id: string) => upd((l) => ({ ...l, restaurants: l.restaurants.filter((r) => r.id !== id) })),

      addExpense: (phase: ExpensePhase, localCurrency: string) => upd((l) => ({ ...l, expenses: [...l.expenses, blankExpense(phase, localCurrency)] })),
      patchExpense: (id: string, patch: Partial<Expense>) =>
        upd((l) => ({ ...l, expenses: l.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      delExpense: (id: string) => upd((l) => ({ ...l, expenses: l.expenses.filter((e) => e.id !== id) })),

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
