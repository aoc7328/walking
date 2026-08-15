import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Trip } from '../../types/trip';
import type { Expense } from '../../types/ledger';
import { loadTripById, persistTripImmediate } from '../../db/repository';
import { budgetBreakdown, categoriesOf, emptyLedger, getLedger } from '../../utils/ledger';
import { formatAmount, formatMoney, toTWD } from '../../utils/money';
import { toISODate } from '../../utils/date';
import { uuid } from '../../utils/format';

/**
 * 手機版「記流水帳」：出發後在現場一筆一筆記。
 *
 * 寫入策略（跟電腦版的「手動存」同精神，不是每打一個字寫一次 KV）：
 * - 按一次「記一筆」＝ 一次 KV 寫入。
 * - 寫之前先跟 KV 重抓最新版行程再附加，避免用手機上這份舊資料蓋掉電腦端剛存的變更。
 * - 沒訊號時先進手機裡的待送佇列（localStorage），恢復連線再按「同步」補送；
 *   附加時用 id 去重，所以重送不會變成兩筆。
 */

interface Props {
  trip: Trip;
  onTripChange: (trip: Trip) => void;
  onToast: (msg: string) => void;
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

export default function MobileLedger({ trip, onTripChange, onToast }: Props) {
  const ledger = getLedger(trip);
  const cats = categoriesOf(ledger);
  const local = ledger.localCurrency;
  const fx = ledger.fxRate;

  const [pending, setPending] = useState<Expense[]>(() => readPending(trip.id));
  const [syncing, setSyncing] = useState(false);

  const [date, setDate] = useState(() => toISODate(new Date()));
  const [category, setCategory] = useState<string>(cats.includes('飲食') ? '飲食' : cats[0] ?? '其他');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(local);
  const [pay, setPay] = useState('');

  // 換行程時把待送佇列與幣別換成新行程的
  useEffect(() => {
    setPending(readPending(trip.id));
    setCurrency(getLedger(trip).localCurrency);
  }, [trip.id]);

  const during = useMemo(
    () => ledger.expenses.filter((e) => e.phase === 'during'),
    [ledger.expenses],
  );

  /** 已存雲端 + 還沒送出的，一起顯示；日期新的在上面。 */
  const rows = useMemo(() => {
    const merged = [
      ...pending.map((e) => ({ e, unsent: true })),
      ...during.map((e) => ({ e, unsent: false })),
    ];
    return merged.sort((a, b) => (b.e.date ?? '').localeCompare(a.e.date ?? ''));
  }, [pending, during]);

  const todayISO = toISODate(new Date());
  const totalAll =
    during.reduce((s, e) => s + toTWD(e.amount, e.currency, fx), 0) +
    pending.reduce((s, e) => s + toTWD(e.amount, e.currency, fx), 0);
  const totalToday = rows
    .filter((r) => r.e.date === todayISO)
    .reduce((s, r) => s + toTWD(r.e.amount, r.e.currency, fx), 0);

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

  function submit() {
    const amt = amount === '' ? 0 : Number(amount);
    if (!Number.isFinite(amt) || (amt === 0 && !title.trim())) {
      onToast('至少填金額或項目');
      return;
    }
    const entry: Expense = {
      id: uuid(),
      phase: 'during',
      category,
      title: title.trim(),
      date,
      amount: amt,
      currency,
      paid: true,
      paymentMethodId: pay || undefined,
    };
    const queue = [...pending, entry];
    setPending(queue);
    writePending(trip.id, queue);
    setTitle('');
    setAmount('');
    void sync(queue, `已記一筆 ${formatMoney(amt, currency)}`);
  }

  async function remove(id: string, unsent: boolean) {
    if (!window.confirm('刪除這筆花費？')) return;
    if (unsent) {
      const queue = pending.filter((e) => e.id !== id);
      setPending(queue);
      writePending(trip.id, queue);
      return;
    }
    setSyncing(true);
    try {
      const fresh = await loadTripById(trip.id);
      if (!fresh) throw new Error('無法取得雲端行程');
      const base = fresh.ledger ?? emptyLedger();
      const next: Trip = {
        ...fresh,
        ledger: { ...base, expenses: base.expenses.filter((e) => e.id !== id) },
        updatedAt: Date.now(),
      };
      await persistTripImmediate(next);
      onTripChange(next);
      onToast('已刪除');
    } catch {
      onToast('刪除失敗（沒連上網路）');
    } finally {
      setSyncing(false);
    }
  }

  const amtNum = amount === '' ? 0 : Number(amount);
  const counterpart =
    currency === 'TWD'
      ? fx
        ? `≒ ${formatMoney(amtNum / fx, local)}`
        : ''
      : `≒ ${formatMoney(amtNum * fx, 'TWD')}`;
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

      <div className="mv-form">
        <div className="mv-form-amount">
          <input
            className="mv-amount-input"
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            aria-label="金額"
          />
          <div className="mv-cur-toggle">
            {local !== 'TWD' && (
              <button
                className={`mv-cur${currency === local ? ' active' : ''}`}
                onClick={() => setCurrency(local)}
              >
                {local}
              </button>
            )}
            <button
              className={`mv-cur${currency === 'TWD' ? ' active' : ''}`}
              onClick={() => setCurrency('TWD')}
            >
              TWD
            </button>
          </div>
        </div>
        {amtNum > 0 && counterpart && <div className="mv-counterpart">{counterpart}</div>}

        <div className="mv-cat-row">
          {cats.map((c) => (
            <button
              key={c}
              className={`mv-cat${c === category ? ' active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <input
          className="mv-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="買了什麼（可留空）"
        />

        <div className="mv-form-row">
          <input
            className="mv-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="日期"
          />
          <select className="mv-input" value={pay} onChange={(e) => setPay(e.target.value)} aria-label="支付方式">
            <option value="">支付方式…</option>
            {ledger.paymentMethods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <button className="mv-submit" onClick={submit} disabled={syncing}>
          {syncing ? '儲存中…' : '記一筆'}
        </button>
      </div>

      {budgets.length > 0 && (
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
      )}

      <div className="mv-entries">
        <div className="mv-entries-head">流水帳　·　{rows.length} 筆</div>
        {rows.length === 0 && <div className="mv-empty">還沒有任何紀錄，上面填金額按「記一筆」。</div>}
        {rows.map(({ e, unsent }) => (
          <div key={e.id} className={`mv-entry${unsent ? ' unsent' : ''}`}>
            <div className="mv-entry-main">
              <div className="mv-entry-title">
                <span className="mv-entry-cat">{e.category}</span>
                {e.title || '（未命名）'}
                {unsent && <span className="mv-unsent-tag">未同步</span>}
              </div>
              <div className="mv-entry-sub">
                {e.date}
                {e.paymentMethodId ? `　·　${payName(e.paymentMethodId)}` : ''}
              </div>
            </div>
            <div className="mv-entry-money">
              <span className="mv-entry-amt">{formatMoney(e.amount, e.currency)}</span>
              {e.currency !== 'TWD' && (
                <span className="mv-entry-twd">{formatMoney(toTWD(e.amount, e.currency, fx), 'TWD')}</span>
              )}
            </div>
            <button
              className="mv-entry-del"
              onClick={() => void remove(e.id, unsent)}
              aria-label="刪除這筆"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
