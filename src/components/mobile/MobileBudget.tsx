import { useMemo } from 'react';
import type { Trip } from '../../types/trip';
import type { Ledger } from '../../types/ledger';
import { getLedger, planVsActual, categorySplit, cardUsage, categoriesOf, categoryColor } from '../../utils/ledger';
import { formatAmount, formatMoney, fromTWD } from '../../utils/money';
import { toISODate, diffDays, addDays } from '../../utils/date';
import { readPending } from '../../utils/mobilePending';

/**
 * 手機版「預算」：出門在外只想知道三件事——總共可以花多少、已經花掉多少、還剩多少。
 *
 * 刻意跟記帳分頁分開：記帳是「輸入」，這頁是「回頭看」，混在一起會讓記一筆變得很難按。
 * 純唯讀，數字全部由既有的 utils 算，跟電腦版消費分析同一套邏輯。
 *
 * 還沒同步到雲端的記帳（pending）一定要算進來，否則剛記完帳數字不會動，
 * 看起來像沒記到。
 */

interface Props {
  trip: Trip;
}

/** 一條進度條。超出預算就轉成警示色，並且長度封頂在 100%。 */
function Bar({ pct, over }: { pct: number; over: boolean }) {
  return (
    <div className="mv-budget-bar">
      <div className={`mv-budget-fill${over ? ' over' : ''}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

export default function MobileBudget({ trip }: Props) {
  const base = getLedger(trip);
  const pending = readPending(trip.id);

  /** 把待送的記帳併進帳本，之後所有計算都用這一份。 */
  const ledger: Ledger = useMemo(
    () => (pending.length ? { ...base, expenses: [...base.expenses, ...pending] } : base),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trip, pending.length],
  );

  const fx = ledger.fxRate;
  const local = ledger.localCurrency;
  const pa = planVsActual(ledger);
  const split = categorySplit(ledger);
  const cards = cardUsage(ledger);

  const budget = pa.estTotal;
  const spent = pa.actTotal;
  const left = budget - spent;
  const usedPct = budget > 0 ? (spent / budget) * 100 : 0;
  const over = left < 0;

  // 出發前已付掉的（機票/住宿/已訂餐廳）與出發後現場花的，分開看比較有感
  let preTotal = 0;
  let duringTotal = 0;
  for (const cat of categoriesOf(ledger)) {
    const s = split[cat];
    if (!s) continue;
    preTotal += s.pre;
    duringTotal += s.during;
  }

  // 天數：行程第一天到最後一天，今天走到哪
  const today = toISODate(new Date());
  const start = trip.startDate;
  const end = addDays(trip.startDate, Math.max(0, trip.days.length - 1));
  const totalDays = Math.max(1, trip.days.length);
  const dayNo = today < start ? 0 : today > end ? totalDays : diffDays(start, today) + 1;
  const daysLeft = Math.max(0, totalDays - dayNo);
  const started = dayNo > 0;
  const perDaySoFar = started && dayNo > 0 ? duringTotal / dayNo : 0;
  // 現場還能花多少：剩餘總預算攤到剩下的日子（含今天算已經在用，所以用 daysLeft + 1 會太寬鬆）
  const perDayLeft = daysLeft > 0 ? left / daysLeft : 0;

  const rows = pa.rows.filter((r) => r.estimate > 0 || r.actual > 0);

  return (
    <div className="mv-budget-page">
      {pending.length > 0 && (
        <div className="mv-budget-note">下面的數字已包含 {pending.length} 筆還沒同步到雲端的記帳</div>
      )}

      {/* 總覽 */}
      <div className="mv-budget-hero">
        <div className="mv-budget-hero-label">{over ? '已超出預算' : '還可以花'}</div>
        <div className={`mv-budget-hero-num${over ? ' over' : ''}`}>
          {over ? '−' : ''}
          {formatMoney(Math.abs(left), 'TWD')}
        </div>
        <div className="mv-budget-hero-sub">
          ≈ {formatAmount(Math.round(fromTWD(Math.abs(left), fx)))} {local}
        </div>
        <Bar pct={usedPct} over={over} />
        <div className="mv-budget-hero-foot">
          <span>
            已花 <b>{formatAmount(spent)}</b>
          </span>
          <span>
            總預算 <b>{formatAmount(budget)}</b>
          </span>
          <span>{budget > 0 ? `${Math.round(usedPct)}%` : '—'}</span>
        </div>
      </div>

      {/* 花在哪個階段 */}
      <div className="mv-budget-grid">
        <div className="mv-budget-cell">
          <span className="mv-budget-cell-label">出發前已付</span>
          <span className="mv-budget-cell-num">{formatAmount(preTotal)}</span>
          <span className="mv-budget-cell-sub">機票・住宿・已訂餐廳</span>
        </div>
        <div className="mv-budget-cell">
          <span className="mv-budget-cell-label">現場花費</span>
          <span className="mv-budget-cell-num">{formatAmount(duringTotal)}</span>
          <span className="mv-budget-cell-sub">≈ {formatAmount(Math.round(fromTWD(duringTotal, fx)))} {local}</span>
        </div>
      </div>

      {/* 每天 */}
      <div className="mv-budget-grid">
        <div className="mv-budget-cell">
          <span className="mv-budget-cell-label">{started ? `第 ${dayNo} / ${totalDays} 天` : `還沒出發 · 共 ${totalDays} 天`}</span>
          <span className="mv-budget-cell-num">{started ? formatAmount(Math.round(perDaySoFar)) : '—'}</span>
          <span className="mv-budget-cell-sub">現場平均每天</span>
        </div>
        <div className="mv-budget-cell">
          <span className="mv-budget-cell-label">剩 {daysLeft} 天</span>
          <span className={`mv-budget-cell-num${perDayLeft < 0 ? ' over' : ''}`}>
            {daysLeft > 0 ? formatAmount(Math.round(perDayLeft)) : '—'}
          </span>
          <span className="mv-budget-cell-sub">每天還能花</span>
        </div>
      </div>

      {/* 各類別 */}
      <div className="mv-section-head">各類別</div>
      {rows.length === 0 && <div className="mv-empty">還沒有預算或花費資料</div>}
      {rows.map((r) => {
        const catOver = r.diff > 0;
        const pct = r.estimate > 0 ? (r.actual / r.estimate) * 100 : r.actual > 0 ? 100 : 0;
        return (
          <div key={r.category} className="mv-budget">
            <div className="mv-budget-top">
              <span>
                <i className="mv-budget-dot" style={{ background: categoryColor(r.category) }} />
                {r.category}
              </span>
              <span className={catOver ? 'mv-over' : 'mv-muted'}>
                {catOver ? `超支 ${formatAmount(r.diff)}` : `剩 ${formatAmount(-r.diff)}`}
              </span>
            </div>
            <Bar pct={pct} over={catOver} />
            <div className="mv-budget-line">
              已花 {formatAmount(r.actual)}　/　預算 {formatAmount(r.estimate)}
            </div>
          </div>
        );
      })}

      {/* 各張卡刷了多少——刷卡上限在國外最容易踩到 */}
      {cards.some((c) => c.spent > 0 || c.limit !== undefined) && (
        <>
          <div className="mv-section-head">支付方式</div>
          {cards.map((c) => {
            const cardOver = c.remaining !== undefined && c.remaining < 0;
            const pct = c.limit ? (c.spent / c.limit) * 100 : 0;
            return (
              <div key={c.id} className="mv-budget">
                <div className="mv-budget-top">
                  <span>{c.name || '（未命名）'}</span>
                  <span className={cardOver ? 'mv-over' : 'mv-muted'}>
                    {c.limit === undefined
                      ? formatAmount(c.spent)
                      : cardOver
                        ? `超出額度 ${formatAmount(-c.remaining!)}`
                        : `剩 ${formatAmount(c.remaining!)}`}
                  </span>
                </div>
                {c.limit !== undefined && <Bar pct={pct} over={cardOver} />}
                {c.limit !== undefined && (
                  <div className="mv-budget-line">
                    已刷 {formatAmount(c.spent)}　/　上限 {formatAmount(c.limit)}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      <div className="mv-budget-foot">
        金額一律換算成台幣（1 {local} = {fx} TWD）。預算＝出發前已知/已訂 ＋ 你在電腦版設的額外預估。
      </div>
    </div>
  );
}
