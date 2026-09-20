import { useState } from 'react';
import type { Ledger } from '../../types/ledger';
import { payeeTotals } from '../../utils/split';
import { formatAmount, formatMoney } from '../../utils/money';
import { formatMonthDay } from '../../utils/date';

/**
 * 手機版「代買 · 每人要付」：只看不改。
 *
 * 現場記完一筆代買，這裡馬上看得到誰欠多少；真正把商品一項項配給誰
 * 是回家在電腦版的「代買 · 分帳」做的事（站在店門口拆 21 項不現實）。
 */
export default function MobileSplit({ ledger }: { ledger: Ledger }) {
  const [open, setOpen] = useState<string | null>(null);
  const rows = payeeTotals(ledger);
  if (rows.length === 0) return <p className="mv-empty">還沒有代買明細。</p>;

  const owed = rows.filter((r) => !r.isSelf && !r.settled).reduce((s, r) => s + r.twd, 0);

  return (
    <div className="mv-bg">
      {rows.map((r) => {
        const isOpen = open === r.name;
        return (
          <div key={r.name} className={`mv-bg-row${isOpen ? ' open' : ''}`}>
            <button
              type="button"
              className="mv-bg-head"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : r.name)}
            >
              <span className="mv-bg-cat">
                {r.name}
                {r.isSelf && <span className="mv-muted">（自己）</span>}
                {r.settled && <span className="mv-under">　已收款</span>}
              </span>
              <span className="mv-bg-nums">
                <strong>{formatAmount(r.twd)}</strong>
                <span className="mv-muted"> · {r.items} 件</span>
              </span>
            </button>

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
      <p className="mv-bg-note">
        金額換算台幣（匯率 {ledger.fxRate}）。要改配給誰、勾已收款，到電腦版的「代買 · 分帳」。
      </p>
    </div>
  );
}
