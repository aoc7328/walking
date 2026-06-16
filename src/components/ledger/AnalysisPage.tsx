import type { Ledger } from '../../types/ledger';
import type { Trip } from '../../types/trip';
import { formatMoney, formatAmount } from '../../utils/money';
import { categoryTotals, categoryColor, planVsActual, largestExpense, categoryToBucket } from '../../utils/ledger';

const R = 70;
const C = 2 * Math.PI * R;

export default function AnalysisPage({ ledger, trip }: { ledger: Ledger; trip: Trip }) {
  const { rows, grand } = categoryTotals(ledger);
  const pa = planVsActual(ledger);
  const paMap = new Map(pa.rows.map((r) => [r.category, r]));
  const days = Math.max(1, trip.days.length);
  const top = largestExpense(ledger);

  // 固定/吃飯/購物 三大塊
  const bucket = { fixed: 0, food: 0, shopping: 0 };
  rows.forEach((r) => { bucket[categoryToBucket(r.category)] += r.total; });
  const pctOf = (v: number) => (grand > 0 ? Math.round((v / grand) * 100) : 0);

  const overRows = pa.rows.filter((r) => r.diff > 0).sort((a, b) => b.diff - a.diff);
  const topCat = [...rows].filter((r) => r.total > 0).sort((a, b) => b.total - a.total)[0];

  // donut
  let offset = 0;
  const segs = rows.filter((r) => r.total > 0).map((r) => {
    const len = (r.total / grand) * C;
    const seg = { color: categoryColor(r.category), dash: len, off: -offset };
    offset += len;
    return seg;
  });

  const diffWord = pa.diff > 0 ? '超支' : pa.diff < 0 ? '結餘' : '剛好打平';
  const diffPct = pa.estTotal > 0 ? Math.round((Math.abs(pa.diff) / pa.estTotal) * 100) : 0;

  return (
    <div className="led-page-cols">
      {/* 預估 / 實際 / 差距 */}
      <section className="led-block">
        <div className="led-stat-row">
          <div className="led-stat"><div className="led-stat-label">總預估（已知＋預算）</div><div className="led-stat-val">{formatMoney(pa.estTotal, 'TWD')}</div></div>
          <div className="led-stat"><div className="led-stat-label">實際總額</div><div className="led-stat-val">{formatMoney(pa.actTotal, 'TWD')}</div></div>
          <div className="led-stat">
            <div className="led-stat-label">差距</div>
            <div className="led-stat-val" style={{ color: pa.diff > 0 ? 'var(--accent-warm)' : pa.diff < 0 ? '#3B6D11' : 'var(--ink-primary)' }}>
              {pa.diff > 0 ? '+' : ''}{formatAmount(pa.diff)}
            </div>
            <div className="led-muted">{diffWord}{pa.diff !== 0 ? `　${diffPct}%` : ''}</div>
          </div>
        </div>
      </section>

      {/* 重點提示 */}
      {grand > 0 && (
        <section className="led-block">
          <div className="led-block-head"><h3>重點提示</h3></div>
          <div className="led-insights">
            <ul>
              <li>平均每天花 <b>{formatMoney(Math.round(grand / days), 'TWD')}</b>（共 {days} 天）</li>
              {top && <li>最大單筆：<b>{top.label}</b> {formatMoney(top.twd, 'TWD')}</li>}
              {overRows.length > 0
                ? <li>最該檢討：<b className="led-over-text">{overRows[0]!.category}</b> 超出預估 {formatMoney(overRows[0]!.diff, 'TWD')}{overRows.length > 1 ? `（另有 ${overRows.length - 1} 類也超支）` : ''}</li>
                : <li className="led-ok">各類別都在預估範圍內 ✓</li>}
              {topCat && <li>花最多的是 <b>{topCat.category}</b>，佔 {topCat.pct.toFixed(1)}%</li>}
              <li>固定成本 <b>{pctOf(bucket.fixed)}%</b>　·　吃飯 <b>{pctOf(bucket.food)}%</b>　·　購物 <b>{pctOf(bucket.shopping)}%</b></li>
            </ul>
          </div>
        </section>
      )}

      {/* 五類別 + 預估 vs 實際 */}
      <section className="led-block">
        <div className="led-block-head"><h3>各類別 預估 vs 實際</h3></div>
        {grand === 0 ? (
          <div className="led-empty-row led-pad">這趟還沒有花費資料</div>
        ) : (
          <div className="led-analysis-split">
            <svg viewBox="0 0 180 180" width="180" height="180" className="led-donut">
              <circle cx="90" cy="90" r={R} fill="none" stroke="var(--border-soft)" strokeWidth="20" />
              <g transform="rotate(-90 90 90)" fill="none" strokeWidth="20">
                {segs.map((s, i) => <circle key={i} cx="90" cy="90" r={R} stroke={s.color} strokeDasharray={`${s.dash} ${C - s.dash}`} strokeDashoffset={s.off} />)}
              </g>
              <text x="90" y="86" textAnchor="middle" className="led-donut-cap">實際</text>
              <text x="90" y="104" textAnchor="middle" className="led-donut-num">{formatAmount(grand)}</text>
            </svg>
            <table className="led-tb led-tb-analysis">
              <thead>
                <tr><th>類別</th><th className="num">預估</th><th className="num">實際</th><th className="num">差距</th><th className="num">佔比</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const p = paMap.get(r.category);
                  const diff = p?.diff ?? 0;
                  return (
                    <tr key={r.category}>
                      <td><i className="led-dot" style={{ background: categoryColor(r.category) }} />{r.category}</td>
                      <td className="num">{formatAmount(p?.estimate ?? 0)}</td>
                      <td className="num led-strong">{formatAmount(r.total)}</td>
                      <td className={`num ${diff > 0 ? 'led-over-text' : diff < 0 ? 'led-ok' : 'led-muted'}`}>{diff > 0 ? '+' : ''}{formatAmount(diff)}</td>
                      <td className="num">{r.pct.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>合計</td>
                  <td className="num">{formatAmount(pa.estTotal)}</td>
                  <td className="num led-strong">{formatAmount(pa.actTotal)}</td>
                  <td className={`num ${pa.diff > 0 ? 'led-over-text' : pa.diff < 0 ? 'led-ok' : ''}`}>{pa.diff > 0 ? '+' : ''}{formatAmount(pa.diff)}</td>
                  <td className="num">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
