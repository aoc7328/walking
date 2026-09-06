import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Trip } from '../../types/trip';
import type { Expense, Ledger } from '../../types/ledger';
import { loadTripById, persistTripImmediate } from '../../db/repository';
import { budgetBreakdown, categoriesOf, emptyLedger, getLedger } from '../../utils/ledger';
import { formatAmount, formatMoney, toTWD } from '../../utils/money';
import { formatWithWeekday, toISODate } from '../../utils/date';
import { uuid } from '../../utils/format';
import MobileSection from './MobileSection';

/**
 * 手機版「記帳」：現場記一筆，也隨時能按日核對、改帳。
 *
 * 寫入策略（跟電腦版的「手動存」同精神，不是每打一個字寫一次 KV）：
 * - 按一次「記一筆」／「儲存修改」＝ 一次 KV 寫入。
 * - 寫之前先跟 KV 重抓最新版行程再改，避免用手機上這份舊資料蓋掉電腦端剛存的變更。
 * - 沒訊號時先進手機裡的待送佇列（localStorage），恢復連線再按「同步」補送；
 *   附加時用 id 去重，所以重送不會變成兩筆。
 */

interface Props {
  trip: Trip;
  onTripChange: (trip: Trip) => void;
  onToast: (msg: string) => void;
}

/** 表單暫存值（金額用字串，才能讓輸入框留空）。 */
interface Draft {
  date: string;
  category: string;
  title: string;
  amount: string;
  currency: string;
  pay: string;
}

function pendingKey(tripId: string): string {
  return `walking.mobilePending.${tripId}`;
}

function readPending(tripId: string): Expense[] {
  try {
    const raw = localStorage.getItem(pendingKey(tripId));
    const arr = raw ? (JSON.parse(raw) as Expense[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writePending(tripId: string, list: Expense[]): void {
  try {
    localStorage.setItem(pendingKey(tripId), JSON.stringify(list));
  } catch {
    // ignore
  }
}

/**
 * 上一筆用的支付方式（還沒送出的優先，其次是已存雲端的流水帳，都由新到舊找）。
 *
 * 出國時整天多半刷同一張卡，每記一筆都要重選很煩。送出後表單本來就會沿用，
 * 但 App 一關掉重開就歸零——這支就是讓重開之後也接得上。
 * 只回目前還存在的支付方式，卡被刪掉就當作沒有。
 */
function lastPaymentMethodId(ledger: Ledger, pending: Expense[]): string {
  const known = new Set(ledger.paymentMethods.map((p) => p.id));
  const during = ledger.expenses.filter((e) => e.phase === 'during');
  for (const list of [pending, during]) {
    for (let i = list.length - 1; i >= 0; i--) {
      const id = list[i]?.paymentMethodId;
      if (id && known.has(id)) return id;
    }
  }
  return '';
}

function blankDraft(ledger: Ledger, cats: string[], pending: Expense[] = []): Draft {
  return {
    date: toISODate(new Date()),
    category: cats.includes('飲食') ? '飲食' : cats[0] ?? '其他',
    title: '',
    amount: '',
    currency: ledger.localCurrency,
    pay: lastPaymentMethodId(ledger, pending),
  };
}

function draftOf(e: Expense): Draft {
  return {
    date: e.date ?? toISODate(new Date()),
    category: e.category,
    title: e.title,
    amount: String(e.amount ?? ''),
    currency: e.currency,
    pay: e.paymentMethodId ?? '',
  };
}

/**
 * 金額 / 幣別 / 分類 / 項目 / 日期 / 支付 這一組欄位。
 * 新增與修改共用同一份，兩邊才不會長得不一樣。
 */
function EntryFields({
  draft,
  onChange,
  ledger,
  cats,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  ledger: Ledger;
  cats: string[];
}) {
  const local = ledger.localCurrency;
  const fx = ledger.fxRate;
  const amt = draft.amount === '' ? 0 : Number(draft.amount);
  const counterpart =
    draft.currency === 'TWD'
      ? fx
        ? `≒ ${formatMoney(amt / fx, local)}`
        : ''
      : `≒ ${formatMoney(amt * fx, 'TWD')}`;

  return (
    <>
      <div className="mv-form-amount">
        <input
          className="mv-amount-input"
          type="number"
          inputMode="decimal"
          value={draft.amount}
          onChange={(e) => onChange({ amount: e.target.value })}
          placeholder="0"
          aria-label="金額"
        />
        <div className="mv-cur-toggle">
          {local !== 'TWD' && (
            <button
              className={`mv-cur${draft.currency === local ? ' active' : ''}`}
              onClick={() => onChange({ currency: local })}
            >
              {local}
            </button>
          )}
          <button
            className={`mv-cur${draft.currency === 'TWD' ? ' active' : ''}`}
            onClick={() => onChange({ currency: 'TWD' })}
          >
            TWD
          </button>
        </div>
      </div>
      {amt > 0 && counterpart && <div className="mv-counterpart">{counterpart}</div>}

      <div className="mv-cat-row">
        {cats.map((c) => (
          <button
            key={c}
            className={`mv-cat${c === draft.category ? ' active' : ''}`}
            onClick={() => onChange({ category: c })}
          >
            {c}
          </button>
        ))}
      </div>

      <input
        className="mv-input"
        value={draft.title}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder="買了什麼（可留空）"
      />

      <div className="mv-form-row">
        <input
          className="mv-input"
          type="date"
          value={draft.date}
          onChange={(e) => onChange({ date: e.target.value })}
          aria-label="日期"
        />
        <select
          className="mv-input"
          value={draft.pay}
          onChange={(e) => onChange({ pay: e.target.value })}
          aria-label="支付方式"
        >
          <option value="">支付方式…</option>
          {ledger.paymentMethods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

export default function MobileLedger({ trip, onTripChange, onToast }: Props) {
  const ledger = getLedger(trip);
  const cats = categoriesOf(ledger);
  const fx = ledger.fxRate;

  const [pending, setPending] = useState<Expense[]>(() => readPending(trip.id));
  const [syncing, setSyncing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => blankDraft(ledger, cats, readPending(trip.id)));

  /** 正在修改的那一筆（開底部編輯抽屜）。 */
  const [editing, setEditing] = useState<{ id: string; unsent: boolean; draft: Draft } | null>(null);

  // 換行程時把待送佇列與表單換成新行程的
  useEffect(() => {
    const nextPending = readPending(trip.id);
    setPending(nextPending);
    const l = getLedger(trip);
    setDraft(blankDraft(l, categoriesOf(l), nextPending));
    setEditing(null);
  }, [trip.id]);

  const during = useMemo(() => ledger.expenses.filter((e) => e.phase === 'during'), [ledger.expenses]);

  /** 已存雲端 + 還沒送出的，合起來當作「流水帳」。 */
  const rows = useMemo(
    () => [
      ...pending.map((e) => ({ e, unsent: true })),
      ...during.map((e) => ({ e, unsent: false })),
    ],
    [pending, during],
  );

  const todayISO = toISODate(new Date());
  const twd = (e: Expense) => toTWD(e.amount, e.currency, fx);
  const totalAll = rows.reduce((s, r) => s + twd(r.e), 0);
  const totalToday = rows.filter((r) => r.e.date === todayISO).reduce((s, r) => s + twd(r.e), 0);

  /** 依日期分組（新的在上面），每天帶小計——這是「按日核對」的主畫面。 */
  const days = useMemo(() => {
    const map = new Map<string, { date: string; items: typeof rows; total: number }>();
    for (const r of rows) {
      const d = r.e.date ?? '';
      const g = map.get(d) ?? { date: d, items: [], total: 0 };
      g.items.push(r);
      g.total += twd(r.e);
      map.set(d, g);
    }
    return [...map.values()].sort((a, b) => (b.date || '0').localeCompare(a.date || '0'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, fx]);

  const budgets = budgetBreakdown(ledger);

  /**
   * 把待送的支出寫回雲端：重抓最新行程 → 附加（依 id 去重）→ PUT。
   * 成功回傳新的 trip，失敗丟例外。
   */
  const flush = useCallback(
    async (queue: Expense[]): Promise<Trip> => {
      const fresh = await loadTripById(trip.id);
      if (!fresh) throw new Error('無法取得雲端行程');
      const base = fresh.ledger ?? emptyLedger();
      const have = new Set(base.expenses.map((e) => e.id));
      const add = queue.filter((e) => !have.has(e.id));
      const next: Trip = {
        ...fresh,
        ledger: { ...base, expenses: [...base.expenses, ...add] },
        updatedAt: Date.now(),
      };
      await persistTripImmediate(next);
      return next;
    },
    [trip.id],
  );

  const sync = useCallback(
    async (queue: Expense[], okMsg: string) => {
      if (queue.length === 0) return;
      setSyncing(true);
      try {
        const next = await flush(queue);
        setPending([]);
        writePending(trip.id, []);
        onTripChange(next);
        onToast(okMsg);
      } catch {
        onToast('沒連上網路，已先存在手機裡（之後按「同步」補送）');
      } finally {
        setSyncing(false);
      }
    },
    [flush, onTripChange, onToast, trip.id],
  );

  /** 已經在雲端的那些：改一筆 / 刪一筆，都是「重抓最新版 → 動一筆 → 寫回」。 */
  const mutateRemote = useCallback(
    async (fn: (list: Expense[]) => Expense[], okMsg: string) => {
      setSyncing(true);
      try {
        const fresh = await loadTripById(trip.id);
        if (!fresh) throw new Error('無法取得雲端行程');
        const base = fresh.ledger ?? emptyLedger();
        const next: Trip = {
          ...fresh,
          ledger: { ...base, expenses: fn(base.expenses) },
          updatedAt: Date.now(),
        };
        await persistTripImmediate(next);
        onTripChange(next);
        onToast(okMsg);
        return true;
      } catch {
        onToast('沒連上網路，這次改不了（等有訊號再試）');
        return false;
      } finally {
        setSyncing(false);
      }
    },
    [onTripChange, onToast, trip.id],
  );

  function submit() {
    const amt = draft.amount === '' ? 0 : Number(draft.amount);
    if (!Number.isFinite(amt) || (amt === 0 && !draft.title.trim())) {
      onToast('至少填金額或項目');
      return;
    }
    const entry: Expense = {
      id: uuid(),
      phase: 'during',
      category: draft.category,
      title: draft.title.trim(),
      date: draft.date,
      amount: amt,
      currency: draft.currency,
      paid: true,
      paymentMethodId: draft.pay || undefined,
    };
    const queue = [...pending, entry];
    setPending(queue);
    writePending(trip.id, queue);
    setDraft({ ...draft, title: '', amount: '' });
    void sync(queue, `已記一筆 ${formatMoney(amt, draft.currency)}`);
  }

  async function saveEdit() {
    if (!editing) return;
    const d = editing.draft;
    const amt = d.amount === '' ? 0 : Number(d.amount);
    if (!Number.isFinite(amt)) {
      onToast('金額格式不對');
      return;
    }
    const patch = {
      category: d.category,
      title: d.title.trim(),
      date: d.date,
      amount: amt,
      currency: d.currency,
      paymentMethodId: d.pay || undefined,
    };

    if (editing.unsent) {
      // 還沒送出雲端的，直接改本地佇列，順便再試著送一次
      const queue = pending.map((e) => (e.id === editing.id ? { ...e, ...patch } : e));
      setPending(queue);
      writePending(trip.id, queue);
      setEditing(null);
      void sync(queue, '已更新');
      return;
    }
    const ok = await mutateRemote(
      (list) => list.map((e) => (e.id === editing.id ? { ...e, ...patch } : e)),
      '已更新',
    );
    if (ok) setEditing(null);
  }

  async function removeEntry() {
    if (!editing) return;
    if (!window.confirm('刪除這筆花費？')) return;
    if (editing.unsent) {
      const queue = pending.filter((e) => e.id !== editing.id);
      setPending(queue);
      writePending(trip.id, queue);
      setEditing(null);
      return;
    }
    const ok = await mutateRemote((list) => list.filter((e) => e.id !== editing.id), '已刪除');
    if (ok) setEditing(null);
  }

  const payName = (id?: string) => ledger.paymentMethods.find((p) => p.id === id)?.name ?? '';

  return (
    <div className="mv-ledger">
      <div className="mv-sum">
        <div className="mv-sum-cell">
          <span className="mv-sum-label">今天</span>
          <span className="mv-sum-value">{formatMoney(totalToday, 'TWD')}</span>
        </div>
        <div className="mv-sum-cell">
          <span className="mv-sum-label">全趟現場花費</span>
          <span className="mv-sum-value">{formatMoney(totalAll, 'TWD')}</span>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="mv-pending-bar">
          <span>{pending.length} 筆還沒存到雲端</span>
          <button
            className="mv-btn mv-btn-small"
            disabled={syncing}
            onClick={() => void sync(pending, '已補送到雲端')}
          >
            {syncing ? '同步中…' : '同步'}
          </button>
        </div>
      )}

      <MobileSection id="led-add" title="記一筆" defaultOpen>
        <div className="mv-form">
          <EntryFields
            draft={draft}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            ledger={ledger}
            cats={cats}
          />
          <button className="mv-submit" onClick={submit} disabled={syncing}>
            {syncing ? '儲存中…' : '記一筆'}
          </button>
        </div>
      </MobileSection>

      {budgets.length > 0 && (
        <MobileSection id="led-budget" title="預算" count={budgets.length}>
          <div className="mv-budgets">
            {budgets.map((b) => {
              const pct = b.extra > 0 ? Math.min(100, (b.during / b.extra) * 100) : 0;
              const over = b.remaining < 0;
              return (
                <div key={b.category} className="mv-budget">
                  <div className="mv-budget-top">
                    <span>{b.category}</span>
                    <span className={over ? 'mv-over' : 'mv-muted'}>
                      {over
                        ? `超支 ${formatAmount(-b.remaining)}`
                        : `剩 ${formatAmount(b.remaining)} / ${formatAmount(b.extra)}`}
                    </span>
                  </div>
                  <div className="mv-budget-bar">
                    <div className={`mv-budget-fill${over ? ' over' : ''}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </MobileSection>
      )}

      <div className="mv-section-head">流水帳　·　{rows.length} 筆</div>
      {rows.length === 0 && (
        <div className="mv-empty">
          還沒有任何紀錄。
          <br />
          上面「記一筆」填金額按下去就會進來。
        </div>
      )}

      {days.map((g) => (
        <MobileSection
          key={g.date || 'nodate'}
          id={`led-day-${g.date || 'nodate'}`}
          title={g.date ? formatWithWeekday(g.date) : '未指定日期'}
          count={`${g.items.length} 筆`}
          defaultOpen={g.date === todayISO}
          badge={formatMoney(g.total, 'TWD')}
        >
          {g.items.map(({ e, unsent }) => (
            <button
              key={e.id}
              className={`mv-entry${unsent ? ' unsent' : ''}`}
              onClick={() => setEditing({ id: e.id, unsent, draft: draftOf(e) })}
            >
              <div className="mv-entry-main">
                <div className="mv-entry-title">
                  <span className="mv-entry-cat">{e.category}</span>
                  {e.title || '（未命名）'}
                  {unsent && <span className="mv-unsent-tag">未同步</span>}
                </div>
                {e.paymentMethodId && <div className="mv-entry-sub">{payName(e.paymentMethodId)}</div>}
              </div>
              <div className="mv-entry-money">
                <span className="mv-entry-amt">{formatMoney(e.amount, e.currency)}</span>
                {e.currency !== 'TWD' && (
                  <span className="mv-entry-twd">{formatMoney(twd(e), 'TWD')}</span>
                )}
              </div>
              <span className="mv-entry-edit" aria-hidden>
                ✎
              </span>
            </button>
          ))}
        </MobileSection>
      ))}

      {/* 掛到 body：這個抽屜原本畫在可捲區裡，iOS Safari 會把捲動容器變成獨立的
          堆疊環境，z-index 再高也蓋不過外面的底部分頁列（分頁列會壓在刪除鈕上）。 */}
      {editing && createPortal(
        <div
          className="mv-sheet-backdrop"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) setEditing(null);
          }}
        >
          <div className="mv-sheet">
            <div className="mv-sheet-head">
              <span>修改這筆</span>
              <button className="mv-sheet-close" onClick={() => setEditing(null)} aria-label="關閉">
                ×
              </button>
            </div>
            <div className="mv-sheet-body">
              <EntryFields
                draft={editing.draft}
                onChange={(patch) =>
                  setEditing((cur) => (cur ? { ...cur, draft: { ...cur.draft, ...patch } } : cur))
                }
                ledger={ledger}
                cats={cats}
              />
            </div>
            <div className="mv-sheet-foot mv-edit-foot">
              <button className="mv-btn mv-btn-danger" onClick={() => void removeEntry()} disabled={syncing}>
                刪除
              </button>
              <button className="mv-submit mv-edit-save" onClick={() => void saveEdit()} disabled={syncing}>
                {syncing ? '儲存中…' : '儲存修改'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
