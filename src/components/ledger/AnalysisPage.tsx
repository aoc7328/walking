import type { Ledger } from '../../types/ledger';
import { formatMoney, formatAmount } from '../../utils/money';
import { categoryTotals, CATEGORY_COLOR, restaurantTotalsTWD, budgetBreakdown } from '../../utils/ledger';

const R = 70;
const C = 2 * Math.PI * R;

export default function AnalysisPage({ ledger }: { ledger: Ledger }) {
  const { rows, grand } = categoryTotals(ledger);
  const preTotal = rows.reduce((s, r) => s + r.pre, 0);
  const duringTotal = rows.reduce((s, r) => s + r.during, 0);
  const rst = restaurantTotalsTWD(ledger);
  const budgets = budgetBreakdown(ledger);

  let offset = 0;
  const segs = rows
    .filter((r) => r.total > 0)
    .map((r) => {
      const len = (r.total / grand) * C;
      const seg = { color: CATEGORY_COLOR[r.category], dash: len, off: -offset };
      offset += len;
      return seg;
    });

  return (
    <div className="led-page-cols">
      <section className="led-block">
        <div className="led-stat-row">
          <div className="led-stat"><div className="led-stat-label">實際總額</div><div className="led-stat-val">{formatMoney(grand, 'TWD')}</div></div>
          <div className="led-stat"><div className="led-stat-label">前期開銷（已知/預訂）</div><div className="led-stat-val">{formatMoney(preTotal, 'TWD')}</div></div>
          <div className="led-stat"><div className="led-stat-label">流水帳（現場）</div><div className="led-stat-val">{formatMoney(duringTotal, 'TWD')}</div></div>
        </div>
      </section>

      <section className="led-block">
        <div className="led-block-head"><h3>五類別佔比</h3></div>
        {grand === 0 ? (
          <div className="led-empty-row led-pad">這趟還沒有花費資料</div>
        ) : (
          <div className="led-analysis-split">
            <svg viewBox="0 0 180 180" width="180" height="180" className="led-donut">
              <circle cx="90" cy="90" r={R} fill="none" stroke="var(--border-soft)" strokeWidth="20" />
              <g transform="rotate(-90 90 90)" fill="none" strokeWidth="20">
                {segs.map((s, i) => (
                  <circle key={i} cx="90" cy="90" r={R} stroke={s.color} strokeDasharray={`${s.dash} ${C - s.dash}`} strokeDashoffset={s.off} />
                ))}
              </g>
              <text x="90" y="86" textAnchor="middle" className="led-donut-cap">實際</text>
              <text x="90" y="104" textAnchor="middle" className="led-donut-num">{formatAmount(grand)}</text>
            </svg>
            <table className="led-tb led-tb-analysis">
              <thead>
                <tr><th>類別</th><th className="num">前期</th><th className="num">流水帳</th><th className="num">合計</th><th className="num">佔比</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.category}>
                    <td><i className="led-dot" style={{ background: CATEGORY_COLOR[r.category] }} />{r.category}</td>
                    <td className="num">{formatAmount(r.pre)}</td>
                    <td className="num">{formatAmount(r.during)}</td>
                    <td className="num led-strong">{formatAmount(r.total)}</td>
                    <td className="num">{r.pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td>合計</td><td className="num">{formatAmount(preTotal)}</td><td className="num">{formatAmount(duringTotal)}</td><td className="num led-strong">{formatAmount(grand)}</td><td className="num">100%</td></tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {(rst.estimated > 0 || budgets.length > 0) && (
        <section className="led-block">
          <div className="led-block-head"><h3>預估 vs 實際</h3></div>
          <div className="led-tb-wrap">
            <table className="led-tb">
              <thead><tr><th>項目</th><th className="num">預估</th><th className="num">實際</th><th className="num">差距</th></tr></thead>
              <tbody>
                {rst.estimated > 0 && (
                  <tr>
                    <td className="led-strong">餐廳預訂</td>
                    <td className="num">{formatAmount(rst.estimated)}</td>
                    <td className="num">{formatAmount(rst.actual)}</td>
                    <td className={`num ${rst.actual > rst.estimated ? 'led-over-text' : 'led-ok'}`}>{rst.actual >= rst.estimated ? '+' : ''}{formatAmount(rst.actual - rst.estimated)}</td>
                  </tr>
                )}
                {budgets.map((b) => {
                  const used = b.committed + b.during;
                  return (
                    <tr key={b.category}>
                      <td className="led-strong">{b.category}預算</td>
                      <td className="num">{formatAmount(b.budget)}</td>
                      <td className="num">{formatAmount(used)}</td>
                      <td className={`num ${used > b.budget ? 'led-over-text' : 'led-ok'}`}>{used >= b.budget ? '+' : ''}{formatAmount(used - b.budget)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
