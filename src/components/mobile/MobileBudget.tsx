import { useState } from 'react';
import type { Ledger } from '../../types/ledger';
import { categoryDetail, categoryOverview, type DetailItem } from '../../utils/ledger';
import { formatAmount } from '../../utils/money';
import { formatWithWeekday } from '../../utils/date';

/**
 * 手機版「預算 vs 實際」。
 *
 * 要回答的就兩個問題：當初每一項訂了多少錢、現在這一類花到哪裡了。
 * 所以分兩層——上面各分類一眼看完，點下去是那一類的逐筆明細。
 *
 * 預算不另外要人填：住宿房價、餐廳的預估費用、出發前預訂的支出，
 * 本來就是當初抓的數字，直接拿來當預算（見 categoryOverview）。
 * 沒抓過預算的類別（例如購物）只顯示花費，不顯示差額——
 * 拿 0 去算超支只會得到一個沒有意義的紅字。
 */

interface Props {
  ledger: Ledger;
}

function DiffLabel({ diff, hasBudget }: { diff: number; hasBudget: boolean }) {
  if (!hasBudget) return <span className="mv-muted">未抓預算</span>;
  if (diff > 0) return <span className="mv-over">超出 {formatAmount(diff)}</span>;
  if (diff < 0) return <span className="mv-under">省下 {formatAmount(-diff)}</span>;
  return <span className="mv-muted">剛好</span>;
}

export default function MobileBudget({ ledger }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const rows = categoryOverview(ledger);
  if (rows.length === 0) return <p className="mv-empty">還沒有任何花費或預算。</p>;

  const totalPlanned = rows.reduce((s, r) => s + r.planned, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);

  return (
    <div className="mv-bg">
      {rows.map((r) => {
        // 沒抓預算時讓長條保持滿格，才不會看起來像「進度 0」。
        const pct = r.planned > 0 ? Math.min(100, (r.actual / r.planned) * 100) : 100;
        const over = r.hasBudget && r.diff > 0;
        const isOpen = open === r.category;

        /**
         * 只有部分項目抓了預算時（例如飲食只抓了訂位的那幾餐，
         * 早餐、便利商店都沒抓），差額是拿一小塊預算去比一整類的花費，
         * 一定紅字，看了只會嚇人。把涵蓋範圍講明，數字才有意義。
         */
        const items = categoryDetail(ledger, r.category);
        const budgeted = items.filter((i) => (i.planned ?? 0) > 0).length;
        const partial = r.hasBudget && budgeted > 0 && budgeted < items.length;
        return (
          <div key={r.category} className={`mv-bg-row${isOpen ? ' open' : ''}`}>
            <button
              type="button"
              className="mv-bg-head"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : r.category)}
            >
              <span className="mv-bg-cat">{r.category}</span>
              <span className="mv-bg-nums">
                <strong>{formatAmount(r.actual)}</strong>
                <span className="mv-muted"> / {r.hasBudget ? formatAmount(r.planned) : '—'}</span>
              </span>
            </button>
            <div className="mv-budget-bar">
              <div className={`mv-budget-fill${over ? ' over' : ''}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="mv-bg-diff">
              {partial && (
                <span className="mv-muted mv-bg-partial">
                  預算只涵蓋 {budgeted}/{items.length} 筆，差額僅供參考・
                </span>
              )}
              <DiffLabel diff={r.diff} hasBudget={r.hasBudget} />
            </div>

            {isOpen && <DetailList ledger={ledger} category={r.category} items={items} />}
          </div>
        );
      })}

      <div className="mv-bg-total">
        <span>總計</span>
        <span>
          <strong>{formatAmount(totalActual)}</strong>
          <span className="mv-muted"> / {formatAmount(totalPlanned)}</span>
        </span>
      </div>
      <p className="mv-bg-note">
        預算來自住宿房價、餐廳預估費用與出發前預訂；金額皆換算台幣（匯率 {ledger.fxRate}）。
      </p>
    </div>
  );
}

/** 某一類的逐筆明細：左邊項目、右邊實際，有抓預算的在下面補一行對照。 */
function DetailList({ items }: { ledger: Ledger; category: string; items: DetailItem[] }) {
  if (items.length === 0) return <p className="mv-empty">這一類還沒有紀錄。</p>;

  return (
    <ul className="mv-bg-list">
      {items.map((it) => {
        const budget = it.planned ?? 0;
        // 預算和實際是同一個數字時（出發前就付掉的、住宿房價）不用箭頭，
        // 寫成「22,066 → 22,066」只是佔位子。
        const paired = budget > 0 && it.twd > 0 && Math.round(budget) !== Math.round(it.twd);
        const gap = paired ? it.twd - budget : 0;
        return (
          <li key={it.key} className="mv-bg-item">
            <div className="mv-bg-item-top">
              <span className="mv-bg-item-name">
                {it.date && <span className="mv-bg-item-date">{formatWithWeekday(it.date)}</span>}
                {it.title}
              </span>
              <span className="mv-bg-item-amt">
                {paired ? (
                  <>
                    <span className="mv-muted">{formatAmount(budget)} → </span>
                    {formatAmount(it.twd)}
                    <span className={gap > 0 ? 'mv-over' : 'mv-under'}>
                      {' '}
                      {gap > 0 ? '+' : '−'}
                      {formatAmount(Math.abs(gap))}
                    </span>
                  </>
                ) : budget > 0 && it.twd === 0 ? (
                  <span className="mv-muted">預算 {formatAmount(budget)}</span>
                ) : (
                  it.raw || '—'
                )}
              </span>
            </div>
            {(it.badge || it.note) && (
              <div className="mv-bg-item-sub">
                <span className="mv-muted">{[it.badge, it.note].filter(Boolean).join('・')}</span>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
