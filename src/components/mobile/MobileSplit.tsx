import { useState } from 'react';
import type { Ledger } from '../../types/ledger';
import { outstandingTWD, payeeTotals, purchases } from '../../utils/split';
import { formatAmount, formatMoney, toTWD } from '../../utils/money';
import { formatMonthDay } from '../../utils/date';

interface Props {
  ledger: Ledger;
  /** 點一筆代買 → 打開那一攤獨立的處理視窗。 */
  onOpenExpense: (expenseId: string) => void;
}

/**
 * 手機版「代買」總覽：一筆代買一張卡，點進去是那一攤自己的處理視窗。
 *
 * 這裡只回答「有哪幾攤、各欠多少」；配人、收款、發票都在各自的視窗裡做，
 * 不同攤之間互不干擾。
 */
export default function MobileSplit({ ledger, onOpenExpense }: Props) {
  const [showByPerson, setShowByPerson] = useState(false);
  const list = purchases(ledger);
  if (list.length === 0) return <p className="mv-empty">還沒有代買。到流水帳點一筆，選「拆帳」。</p>;

  const owed = outstandingTWD(ledger);
  const byPerson = payeeTotals(ledger);

  return (
    <div className="mv-purchases">
      <div className="mv-purchase-sum">
        <span>還沒收回來</span>
        <strong className={owed > 0 ? 'mv-over' : 'mv-under'}>{formatAmount(owed)}</strong>
      </div>

      {list.map((p) => {
        const e = p.expense;
        const cur = e.currency;
        return (
          <button
            key={e.id}
            type="button"
            className={`mv-purchase${p.allSettled ? ' settled' : ''}`}
            onClick={() => onOpenExpense(e.id)}
          >
            <div className="mv-purchase-top">
              <span className="mv-purchase-title">
                {e.date && <span className="mv-purchase-date">{formatMonthDay(e.date)}</span>}
                {e.title || '（未命名）'}
              </span>
              <span className="mv-purchase-amt">{formatMoney(e.amount, cur)}</span>
            </div>

            <div className="mv-purchase-meta">
              <span className="mv-muted">自己 {formatMoney(p.self, cur)}</span>
              {p.others.length > 0 && (
                <span className="mv-muted">　·　代買 {formatMoney(p.outstanding + p.collected, cur)}</span>
              )}
              {(e.receiptKeys?.length ?? 0) > 0 && (
                <span className="mv-muted">　·　發票 {e.receiptKeys!.length} 張</span>
              )}
              {!e.splits?.length && <span className="mv-over">　·　還沒拆</span>}
            </div>

            {p.others.length > 0 && (
              <div className="mv-purchase-people">
                {p.others.map((s) => (
                  <span key={s.person} className={`mv-purchase-chip${s.settled ? ' done' : ''}`}>
                    {s.person} {formatMoney(s.amount, cur)}{s.settled ? ' ✓' : ''}
                  </span>
                ))}
              </div>
            )}
          </button>
        );
      })}

      {byPerson.length > 0 && list.length > 1 && (
        <>
          <button type="button" className="mv-purchase-more" onClick={() => setShowByPerson((v) => !v)}>
            {showByPerson ? '收起' : '依人合計（跨所有代買）'}
          </button>
          {showByPerson && (
            <div className="mv-bg">
              {byPerson.map((t) => (
                <div key={t.name} className="mv-bg-row">
                  <div className="mv-bg-head" style={{ cursor: 'default' }}>
                    <span className="mv-bg-cat">{t.name}</span>
                    <span className="mv-bg-nums">
                      <strong>{formatAmount(t.outstanding)}</strong>
                      {Math.round(t.outstanding) !== Math.round(t.twd) && (
                        <span className="mv-muted"> / 共 {formatAmount(t.twd)}</span>
                      )}
                    </span>
                  </div>
                  <div className="mv-bg-item-sub">
                    <span className="mv-muted">
                      {t.entries
                        .map(({ expense, share }) =>
                          `${expense.title || '未命名'} ${formatMoney(toTWD(share.amount, expense.currency, ledger.fxRate), 'TWD')}${share.settled ? '（已收）' : ''}`)
                        .join('・')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <p className="mv-bg-note">
        金額換算台幣（匯率 {ledger.fxRate}）。代買別人的那份不會算進「全趟現場花費」。
      </p>
    </div>
  );
}
