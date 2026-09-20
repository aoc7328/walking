import type { Expense, ExpenseSplit, Ledger } from '../types/ledger';
import { toTWD } from './money';

/**
 * 代買分帳的算法。
 *
 * 一筆支出（例：藥妝店刷一次 ¥22,418）底下拆成一項項商品，每項指定歸誰。
 * 明細加總常常跟刷卡金額對不上（免稅、整單折扣、湊整），差額一律
 * 按各人金額比例分攤——誰買得多誰吸收得多。
 */

/** 沒指定歸誰的明細算自己的。 */
export const SELF = '自己';

/** 一行明細的小計（單價 × 數量）。 */
export function lineTotal(s: ExpenseSplit): number {
  const qty = Number.isFinite(s.qty) && s.qty > 0 ? s.qty : 1;
  return (Number.isFinite(s.price) ? s.price : 0) * qty;
}

/** 明細加總（支出的幣別）。 */
export function splitsSubtotal(splits: ExpenseSplit[] | undefined): number {
  return (splits ?? []).reduce((s, x) => s + lineTotal(x), 0);
}

export interface PersonShare {
  person: string;
  /** 明細原價加總，還沒攤差額。 */
  subtotal: number;
  /** 實際該付：攤完差額後的金額（各人加總＝這筆支出的金額）。 */
  amount: number;
  lines: ExpenseSplit[];
}

/**
 * 把一筆支出分給各人。回傳順序照明細裡第一次出現的人。
 *
 * 差額用最大餘數法補：先各自無條件捨去，再把剩下的一塊一塊補給小數部分最大的人，
 * 這樣各人金額加總才會剛好等於支出金額，不會因為四捨五入差個一兩塊對不起來。
 * 金額一律以整數計（日圓台幣都沒有小數）。
 */
export function allocate(expense: Expense): PersonShare[] {
  const splits = expense.splits ?? [];
  if (splits.length === 0) return [];

  const order: string[] = [];
  const byPerson = new Map<string, ExpenseSplit[]>();
  for (const s of splits) {
    const p = (s.person ?? '').trim() || SELF;
    if (!byPerson.has(p)) {
      byPerson.set(p, []);
      order.push(p);
    }
    byPerson.get(p)!.push(s);
  }

  const subtotals = order.map((p) => splitsSubtotal(byPerson.get(p)));
  const sum = subtotals.reduce((a, b) => a + b, 0);
  const target = Math.round(Number.isFinite(expense.amount) ? expense.amount : 0);

  let amounts: number[];
  if (sum <= 0) {
    amounts = order.map(() => 0);
  } else {
    const raw = subtotals.map((v) => (v / sum) * target);
    amounts = raw.map((v) => Math.floor(v));
    let rest = target - amounts.reduce((a, b) => a + b, 0);
    const byFrac = raw
      .map((v, i) => ({ i, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac);
    for (let k = 0; rest > 0 && k < byFrac.length; k++, rest--) amounts[byFrac[k]!.i]! += 1;
  }

  return order.map((person, i) => ({
    person,
    subtotal: subtotals[i]!,
    amount: amounts[i]!,
    lines: byPerson.get(person)!,
  }));
}

/** 明細加總跟支出金額的差額（正＝刷的比明細多，負＝明細比刷的多）。 */
export function splitDiff(expense: Expense): number {
  return Math.round(expense.amount || 0) - splitsSubtotal(expense.splits);
}

/** 有拆明細的支出（照日期新到舊）。 */
export function splitExpenses(l: Ledger): Expense[] {
  return l.expenses
    .filter((e) => (e.splits?.length ?? 0) > 0)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

export interface PayeeTotal {
  name: string;
  /** 折成台幣的總額。 */
  twd: number;
  /** 幫他買的件數（含數量）。 */
  items: number;
  /** 已經跟他收到錢了。 */
  settled: boolean;
  /** 自己那份——不列入要收的錢。 */
  isSelf: boolean;
  entries: { expense: Expense; share: PersonShare }[];
}

/**
 * 全趟每個人要付多少（台幣）。
 * 自己那份也算出來但排在最後、不算進「還沒收」，只是讓你知道這趟自己花了多少。
 */
export function payeeTotals(l: Ledger): PayeeTotal[] {
  const settled = new Set(l.settledPayees ?? []);
  const map = new Map<string, PayeeTotal>();

  for (const expense of splitExpenses(l)) {
    for (const share of allocate(expense)) {
      const row =
        map.get(share.person) ??
        {
          name: share.person,
          twd: 0,
          items: 0,
          settled: settled.has(share.person),
          isSelf: share.person === SELF,
          entries: [],
        };
      row.twd += toTWD(share.amount, expense.currency, l.fxRate);
      row.items += share.lines.reduce((s, x) => s + (x.qty > 0 ? x.qty : 1), 0);
      row.entries.push({ expense, share });
      map.set(share.person, row);
    }
  }

  return [...map.values()].sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? 1 : -1;
    return b.twd - a.twd;
  });
}

/** 已經出現過的代買對象名字（給輸入框的建議清單用）。 */
export function knownPayees(l: Ledger): string[] {
  const names = new Set<string>();
  for (const e of l.expenses) for (const s of e.splits ?? []) {
    const p = (s.person ?? '').trim();
    if (p && p !== SELF) names.add(p);
  }
  for (const p of l.settledPayees ?? []) if (p !== SELF) names.add(p);
  return [...names].sort();
}

/**
 * 把貼上的明細文字轉成列。每行：品名、單價、數量、歸誰（後兩欄可省）。
 * 欄位用 Tab 或逗號（半形全形都行）分隔——從試算表或我整理好的清單直接貼進來就行。
 * 認不出金額的行（標題列、分隔線）自動跳過。
 */
export function parseSplitLines(text: string): { label: string; price: number; qty: number; person?: string }[] {
  const out: { label: string; price: number; qty: number; person?: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cells = line.split(/\t|[,，]/).map((c) => c.trim());
    if (cells.length < 2) continue;
    const label = cells[0]!;
    const price = Number(cells[1]!.replace(/[¥$NT,\s]/gi, ''));
    if (!label || !Number.isFinite(price)) continue;
    const qty = cells[2] ? Number(cells[2].replace(/[^\d.]/g, '')) : 1;
    const person = cells[3] || undefined;
    out.push({ label, price, qty: Number.isFinite(qty) && qty > 0 ? qty : 1, person });
  }
  return out;
}
