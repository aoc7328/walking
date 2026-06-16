import type { Ledger } from '../../types/ledger';
import { formatMoney, formatAmount, toTWD } from '../../utils/money';
import { budgetBreakdown, cardUsage, expensesTotalTWD } from '../../utils/ledger';

function BudgetBar({ committed, during, budget }: { committed: number; during: number; budget: number }) {
  const total = committed + during;
  const over = total > budget;
  const denom = over ? total : budget;
  const cw = denom > 0 ? (committed / denom) * 100 : 0;
  const dw = denom > 0 ? (during / denom) * 100 : 0;
  return (
    <div className="led-bar">
      <div className="led-bar-seg led-bar-committed" style={{ width: `${cw}%` }} />
      <div className={`led-bar-seg ${over ? 'led-bar-over' : 'led-bar-during'}`} style={{ width: `${dw}%` }} />
    </div>
  );
}

export default function DuringTripPage({ ledger }: { ledger: Ledger }) {
  const fx = ledger.fxRate;
  const pmName = (id?: string) => ledger.paymentMethods.find((p) => p.id === id)?.name ?? '';
  const budgets = budgetBreakdown(ledger);
  const cards = cardUsage(ledger).filter((c) => c.spent > 0 || c.limit !== undefined);
  const during = [...ledger.expenses.filter((e) => e.phase === 'during')].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const duringTotal = expensesTotalTWD(ledger, 'during');

  return (
    <div className="led-page-cols">
      {/* 預算三段條 */}
      <section className="led-block">
        <div className="led-block-head"><h3>變動預算 · 還剩多少</h3>
          <span className="led-muted led-legend">
            <i className="led-dot led-dot-committed" />已預訂　<i className="led-dot led-dot-during" />現場已花　<i className="led-dot led-dot-rest" />剩餘
          </span>
        </div>
        {budgets.length === 0 ? (
          <div className="led-empty-row led-pad">這趟還沒設各類別預算（住宿/餐廳的已知花費仍會進「消費分析」）。</div>
        ) : (
          <div className="led-budgets">
            {budgets.map((b) => (
              <div key={b.category} className="led-budget-row">
                <div className="led-budget-top">
                  <span className="led-strong">{b.category} · 預算 {formatAmount(b.budget)}</span>
                  <span className="led-muted">
                    已訂 {formatAmount(b.committed)} · 現場 {formatAmount(b.during)} ·{' '}
                    {b.remaining >= 0 ? <>剩 <b className="led-ok">{formatAmount(b.remaining)}</b></> : <>超支 <b className="led-over-text">{formatAmount(-b.remaining)}</b></>}
                  </span>
                </div>
                <BudgetBar committed={b.committed} during={b.during} budget={b.budget} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 卡片額度 */}
      <section className="led-block">
        <div className="led-block-head"><h3>支付方式 · 已刷多少</h3></div>
        {cards.length === 0 ? (
          <div className="led-empty-row led-pad">尚無支付紀錄</div>
        ) : (
          <div className="led-cards-grid">
            {cards.map((c) => (
              <div key={c.id} className="led-cardbox">
                <div className="led-cardbox-top">
                  <span className="led-strong">{c.name}</span>
                  {c.limit !== undefined && c.remaining !== undefined && (
                    <span className={c.remaining < c.limit * 0.1 ? 'led-over-text' : 'led-muted'}>剩 {formatAmount(c.remaining)}</span>
                  )}
                </div>
                {c.limit !== undefined ? (
                  <>
                    <div className="led-bar led-bar-thin">
                      <div className={`led-bar-seg ${c.spent > c.limit ? 'led-bar-over' : 'led-bar-during'}`} style={{ width: `${Math.min(100, (c.spent / c.limit) * 100)}%` }} />
                    </div>
                    <div className="led-muted">{formatAmount(c.spent)} / 上限 {formatAmount(c.limit)}</div>
                  </>
                ) : (
                  <div className="led-cardbox-amt">{formatMoney(c.spent, 'TWD')}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 流水帳 */}
      <section className="led-block">
        <div className="led-block-head"><h3>流水帳　<span className="led-muted">{during.length} 筆</span></h3>
          <span className="led-muted">合計 <b className="led-strong">{formatMoney(duringTotal, 'TWD')}</b></span>
        </div>
        <div className="led-tb-wrap">
          <table className="led-tb">
            <thead>
              <tr><th>日期</th><th>分類</th><th>項目</th><th className="num">原幣</th><th className="num">台幣</th><th>支付</th></tr>
            </thead>
            <tbody>
              {during.length === 0 ? (
                <tr><td colSpan={6} className="led-empty-row">尚無流水帳</td></tr>
              ) : during.map((e) => (
                <tr key={e.id}>
                  <td>{e.date ? e.date.slice(5).replace('-', '/') : ''}</td>
                  <td>{e.category}</td>
                  <td className="led-strong">{e.title}</td>
                  <td className="num">{e.currency === 'TWD' ? <span className="led-muted">—</span> : formatMoney(e.amount, e.currency)}</td>
                  <td className="num led-strong">{formatMoney(toTWD(e.amount, e.currency, fx), 'TWD')}</td>
                  <td>{pmName(e.paymentMethodId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
