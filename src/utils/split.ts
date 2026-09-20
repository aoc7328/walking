import type { Expense, ExpenseSplit, Ledger } from '../types/ledger';
import { toTWD } from './money';

/**
 * 代買分帳的算法。
 *
 * 一筆支出（例：藥妝店刷一次 ¥22,418）底下拆成一項項商品，每項指定歸誰。
 * 明細加總常常跟刷卡金額對不上（免稅、整單折扣、湊整），差額一律
 * 按各人金額比例分攤——誰買得多誰吸收得多。
 *
 * 每一筆代買是獨立的一攤：自己的收款狀態、發票照片都掛在那筆支出上，
 * 不跟別攤混在一起。
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

/** 這筆有沒有在做代買分帳（有明細或有發票照片就算）。 */
export function isPurchase(e: Expense): boolean {
  return (e.splits?.length ?? 0) > 0 || (e.receiptKeys?.length ?? 0) > 0;
}

/**
 * 這筆支出裡「自己的開銷」（支出幣別）。沒拆明細就是全額。
 *
 * 消費分析、預算、每日小計一律用這個而不是 amount——幫別人買的錢一定會收回來，
 * 算進自己的花費只會讓「這趟花多少」失真。
 * （刷卡額度是唯一例外，卡真的被刷了全額，見 cardUsage。）
 */
export function selfAmount(e: Expense): number {
  if (!e.splits?.length) return e.amount;
  return allocate(e).find((s) => s.person === SELF)?.amount ?? 0;
}

/** 這筆支出裡要跟別人收回來的金額（支出幣別）。 */
export function owedAmount(e: Expense): number {
  if (!e.splits?.length) return 0;
  return allocate(e).reduce((a, s) => a + (s.person === SELF ? 0 : s.amount), 0);
}

/** 自己的開銷，換成台幣。 */
export function selfTWD(e: Expense, fxRate: number): number {
  return toTWD(selfAmount(e), e.currency, fxRate);
}

export interface PurchaseShare extends PersonShare {
  /** 這攤已經跟他收到錢了。 */
  settled: boolean;
}

/** 一筆代買：自己那份、各人該付多少、收了沒。 */
export interface Purchase {
  expense: Expense;
  /** 含自己。 */
  shares: PurchaseShare[];
  /** 不含自己——要跟人收錢的就是這些。 */
  others: PurchaseShare[];
  /** 自己那份（支出幣別）。 */
  self: number;
  /** 還沒收回來的（支出幣別）。 */
  outstanding: number;
  /** 已經收到的。 */
  collected: number;
  /** 別人的都收齊了（沒有人要收也算齊）。 */
  allSettled: boolean;
}

export function purchaseOf(expense: Expense): Purchase {
  const settled = new Set(expense.settledPersons ?? []);
  const shares: PurchaseShare[] = allocate(expense).map((s) => ({
    ...s,
    settled: s.person !== SELF && settled.has(s.person),
  }));
  const others = shares.filter((s) => s.person !== SELF);
  return {
    expense,
    shares,
    others,
    self: shares.find((s) => s.person === SELF)?.amount ?? (expense.splits?.length ? 0 : expense.amount),
    outstanding: others.reduce((a, s) => a + (s.settled ? 0 : s.amount), 0),
    collected: others.reduce((a, s) => a + (s.settled ? s.amount : 0), 0),
    allSettled: others.every((s) => s.settled),
  };
}

/** 所有代買（日期新到舊）。 */
export function purchases(l: Ledger): Purchase[] {
  return l.expenses
    .filter(isPurchase)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .map(purchaseOf);
}

/** 全趟還沒收回來的錢（台幣）。 */
export function outstandingTWD(l: Ledger): number {
  return purchases(l).reduce((s, p) => s + toTWD(p.outstanding, p.expense.currency, l.fxRate), 0);
}

export interface PayeeTotal {
  name: string;
  /** 這個人全趟合計（台幣）。 */
  twd: number;
  /** 其中還沒收的（台幣）。 */
  outstanding: number;
  /** 幫他買的件數。 */
  items: number;
  entries: { expense: Expense; share: PurchaseShare }[];
}

/**
 * 依「人」跨筆彙總——最後要跟某個人收錢時看這個。
 * 自己那份不列入（那不是要收的錢）。
 */
export function payeeTotals(l: Ledger): PayeeTotal[] {
  const map = new Map<string, PayeeTotal>();

  for (const p of purchases(l)) {
    for (const share of p.others) {
      const row = map.get(share.person) ?? { name: share.person, twd: 0, outstanding: 0, items: 0, entries: [] };
      const twd = toTWD(share.amount, p.expense.currency, l.fxRate);
      row.twd += twd;
      if (!share.settled) row.outstanding += twd;
      row.items += share.lines.reduce((s, x) => s + (x.qty > 0 ? x.qty : 1), 0);
      row.entries.push({ expense: p.expense, share });
      map.set(share.person, row);
    }
  }

  return [...map.values()].sort((a, b) => b.outstanding - a.outstanding || b.twd - a.twd);
}

/** 已經出現過的代買對象名字（給輸入框的建議清單用）。 */
export function knownPayees(l: Ledger): string[] {
  const names = new Set<string>();
  for (const e of l.expenses) {
    for (const s of e.splits ?? []) {
      const p = (s.person ?? '').trim();
      if (p && p !== SELF) names.add(p);
    }
    for (const p of e.settledPersons ?? []) if (p !== SELF) names.add(p);
  }
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
