import type { Ledger, ExpenseCategory } from '../../types/ledger';
import { formatMoney, formatAmount } from '../../utils/money';
import { budgetBreakdown, cardUsage, expensesTotalTWD, categoriesOf } from '../../utils/ledger';
import { useLedgerEdit } from './useLedgerEdit';
import { TextCell, DateCell, SelectCell, DeleteCell, MoneyCells } from './EditableCells';

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
  const ed = useLedgerEdit();
  const fx = ledger.fxRate;
  const local = ledger.localCurrency;
  const catOpts = categoriesOf(ledger).map((c) => ({ value: c, label: c }));
  const locOf = (twd: number) => (fx ? Math.round(twd / fx) : 0);
  const payOpts = [{ value: '', label: '—' }, ...ledger.paymentMethods.map((p) => ({ value: p.id, label: p.name }))];
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
          <div className="led-empty-row led-pad">這趟還沒設各類別預算。到「設定」分頁可以設餐飲/購物等預算。</div>
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
              <tr><th>日期</th><th>分類</th><th>項目</th><th className="num">金額 NT$</th><th className="num">金額 {local}</th><th>支付</th><th></th></tr>
            </thead>
            <tbody>
              {during.map((e) => (
                <tr key={e.id}>
                  <td><DateCell value={e.date} onChange={(v) => ed.patchExpense(e.id, { date: v })} /></td>
                  <td><SelectCell value={e.category} onChange={(v) => ed.patchExpense(e.id, { category: v as ExpenseCategory })} options={catOpts} /></td>
                  <td><TextCell value={e.title} onChange={(v) => ed.patchExpense(e.id, { title: v })} placeholder="買了什麼" /></td>
                  <MoneyCells amount={e.amount} currency={e.currency} localCurrency={local} fxRate={fx} onChange={(amt, cur) => ed.patchExpense(e.id, { amount: amt, currency: cur })} />
                  <td><SelectCell value={e.paymentMethodId ?? ''} onChange={(v) => ed.patchExpense(e.id, { paymentMethodId: v || undefined })} options={payOpts} /></td>
                  <td><DeleteCell onClick={() => ed.delExpense(e.id)} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>小計</td>
                <td className="num">{formatAmount(duringTotal)}</td>
                <td className="num">{formatAmount(locOf(duringTotal))}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <button className="led-add-btn" onClick={() => ed.addExpense('during', local)}>＋ 新增一筆流水帳</button>
      </section>
    </div>
  );
}
