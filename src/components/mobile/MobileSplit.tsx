import { useState } from 'react';
import type { Ledger } from '../../types/ledger';
import { payeeTotals, splitExpenses } from '../../utils/split';
import { formatAmount, formatMoney } from '../../utils/money';
import { formatMonthDay } from '../../utils/date';

interface Props {
  ledger: Ledger;
  busy: boolean;
  mutate: (fn: (l: Ledger) => Ledger, okMsg: string) => Promise<boolean>;
  /** 點某一筆已拆的支出 → 打開那筆的「拆帳」。 */
  onOpenExpense: (expenseId: string) => void;
}

/**
 * 手機版「代買 · 每人要付」。
 *
 * 上半是每個人的合計（收到錢了就打勾），下半是已經拆過的支出，
 * 點進去可以繼續配人。要拆一筆還沒拆的，是從流水帳點那筆進去的。
 */
export default function MobileSplit({ ledger, busy, mutate, onOpenExpense }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const rows = payeeTotals(ledger);
  const expenses = splitExpenses(ledger);
  if (rows.length === 0) return <p className="mv-empty">還沒有代買明細。</p>;

  const owed = rows.filter((r) => !r.isSelf && !r.settled).reduce((s, r) => s + r.twd, 0);

  const toggleSettled = (name: string) =>
    void mutate((l) => {
      const cur = l.settledPayees ?? [];
      return { ...l, settledPayees: cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name] };
    }, '已更新收款狀態');

  return (
    <div className="mv-bg">
      {rows.map((r) => {
        const isOpen = open === r.name;
        return (
          <div key={r.name} className={`mv-bg-row${isOpen ? ' open' : ''}`}>
            <button type="button" className="mv-bg-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.name)}>
              <span className="mv-bg-cat">
                {r.name}
                {r.isSelf && <span className="mv-muted">（自己）</span>}
              </span>
              <span className="mv-bg-nums">
                <strong>{formatAmount(r.twd)}</strong>
                <span className="mv-muted"> · {r.items} 件</span>
              </span>
            </button>

            {!r.isSelf && (
              <label className="mv-split-settle">
                <input type="checkbox" checked={r.settled} disabled={busy} onChange={() => toggleSettled(r.name)} />
                {r.settled ? '已經收到錢了' : '還沒收到錢'}
              </label>
            )}

            {isOpen && (
              <ul className="mv-bg-list">
                {r.entries.map(({ expense, share }) => (
                  <li key={expense.id} className="mv-bg-item">
                    <div className="mv-bg-item-top">
                      <span className="mv-bg-item-name">
                        {expense.date && <span className="mv-bg-item-date">{formatMonthDay(expense.date)}</span>}
                        {expense.title || '（未命名）'}
                      </span>
                      <span className="mv-bg-item-amt">{formatMoney(share.amount, expense.currency)}</span>
                    </div>
                    <div className="mv-bg-item-sub">
                      <span className="mv-muted">
                        {share.lines.map((s) => `${s.label || '未命名'}${s.qty > 1 ? ` ×${s.qty}` : ''}`).join('・')}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      <div className="mv-bg-total">
        <span>還沒收</span>
        <span><strong>{formatAmount(owed)}</strong></span>
      </div>

      {expenses.length > 0 && (
        <>
          <div className="mv-split-reopen-label mv-muted">繼續配人</div>
          <div className="mv-split-tools">
            {expenses.map((e) => (
              <button key={e.id} className="mv-btn mv-btn-small" onClick={() => onOpenExpense(e.id)} disabled={busy}>
                {e.title || '（未命名）'}　{e.splits!.length} 項
              </button>
            ))}
          </div>
        </>
      )}

      <p className="mv-bg-note">
        金額換算台幣（匯率 {ledger.fxRate}）。要拆一筆還沒拆的，到下面流水帳點那一筆，選「拆帳」。
      </p>
    </div>
  );
}
