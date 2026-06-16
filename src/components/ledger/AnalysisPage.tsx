import type { Ledger } from '../../types/ledger';
import type { Trip } from '../../types/trip';
import { formatMoney, formatAmount } from '../../utils/money';
import {
  categoryTotals, categoryColor, planVsActual, categoryToBucket,
  pivotCategoryPayment, dailySpending,
} from '../../utils/ledger';
import { PieChart, ColumnChart } from './LedgerCharts';

const R = 70;
const C = 2 * Math.PI * R;

function HBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(0, (value / max) * 100) : 0;
  return <div className="led-hbar"><div className="led-hbar-fill" style={{ width: `${pct}%`, background: color }} /></div>;
}

export default function AnalysisPage({ ledger, trip }: { ledger: Ledger; trip: Trip }) {
  const { rows, grand } = categoryTotals(ledger);
  const pa = planVsActual(ledger);
  const paMap = new Map(pa.rows.map((r) => [r.category, r]));
  const days = Math.max(1, trip.days.length);
  const pivot = pivotCategoryPayment(ledger);
  const daily = dailySpending(ledger);

  const bucket = { fixed: 0, food: 0, shopping: 0 };
  rows.forEach((r) => { bucket[categoryToBucket(r.category)] += r.total; });
  const pct = (v: number) => (grand > 0 ? ((v / grand) * 100).toFixed(1) : '0.0');

  // donut
  let offset = 0;
  const segs = rows.filter((r) => r.total > 0).map((r) => {
    const len = (r.total / grand) * C;
    const seg = { color: categoryColor(r.category), dash: len, off: -offset };
    offset += len;
    return seg;
  });

  const cmpMax = Math.max(1, ...pa.rows.map((r) => Math.max(r.estimate, r.actual)));
  const diffWord = pa.diff > 0 ? '超支' : pa.diff < 0 ? '結餘' : '打平';
  const diffPct = pa.estTotal > 0 ? Math.round((Math.abs(pa.diff) / pa.estTotal) * 100) : 0;

  return (
    <div className="led-page-cols">
      {/* 總預估 / 實際 / 差距 */}
      <section className="led-block">
        <div className="led-stat-row">
          <div className="led-stat"><div className="led-stat-label">總預估（已知＋預算）</div><div className="led-stat-val">{formatMoney(pa.estTotal, 'TWD')}</div></div>
          <div className="led-stat"><div className="led-stat-label">實際總額</div><div className="led-stat-val">{formatMoney(pa.actTotal, 'TWD')}</div></div>
          <div className="led-stat">
            <div className="led-stat-label">差距</div>
            <div className="led-stat-val" style={{ color: pa.diff > 0 ? 'var(--accent-warm)' : pa.diff < 0 ? '#3B6D11' : 'var(--ink-primary)' }}>{pa.diff > 0 ? '+' : ''}{formatAmount(pa.diff)}</div>
            <div className="led-muted">{diffWord}{pa.diff !== 0 ? `　${diffPct}%` : ''}　·　平均每天 {formatMoney(Math.round(grand / days), 'TWD')}</div>
          </div>
        </div>
      </section>

      {/* 三大塊 */}
      <section className="led-block">
        <div className="led-stat-row">
          <div className="led-stat"><div className="led-stat-label">固定成本（交通・住宿・其他）</div><div className="led-stat-val">{formatMoney(bucket.fixed, 'TWD')}<span className="led-muted">　{pct(bucket.fixed)}%</span></div></div>
          <div className="led-stat"><div className="led-stat-label">吃飯</div><div className="led-stat-val">{formatMoney(bucket.food, 'TWD')}<span className="led-muted">　{pct(bucket.food)}%</span></div></div>
          <div className="led-stat"><div className="led-stat-label">購物</div><div className="led-stat-val">{formatMoney(bucket.shopping, 'TWD')}<span className="led-muted">　{pct(bucket.shopping)}%</span></div></div>
        </div>
      </section>

      {/* 五類別圓環 + 明細表（前期/流水帳/實際/預估/差距/佔比） */}
      <section className="led-block">
        <div className="led-block-head"><h3>各類別明細</h3></div>
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
                <tr><th>類別</th><th className="num">前期</th><th className="num">流水帳</th><th className="num">實際</th><th className="num">預估</th><th className="num">差距</th><th className="num">佔比</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const p = paMap.get(r.category);
                  const diff = p?.diff ?? 0;
                  return (
                    <tr key={r.category}>
                      <td><i className="led-dot" style={{ background: categoryColor(r.category) }} />{r.category}</td>
                      <td className="num">{formatAmount(r.pre)}</td>
                      <td className="num">{formatAmount(r.during)}</td>
                      <td className="num led-strong">{formatAmount(r.total)}</td>
                      <td className="num">{formatAmount(p?.estimate ?? 0)}</td>
                      <td className={`num ${diff > 0 ? 'led-over-text' : diff < 0 ? 'led-ok' : 'led-muted'}`}>{diff > 0 ? '+' : ''}{formatAmount(diff)}</td>
                      <td className="num">{r.pct.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>合計</td>
                  <td className="num">{formatAmount(rows.reduce((s, r) => s + r.pre, 0))}</td>
                  <td className="num">{formatAmount(rows.reduce((s, r) => s + r.during, 0))}</td>
                  <td className="num led-strong">{formatAmount(pa.actTotal)}</td>
                  <td className="num">{formatAmount(pa.estTotal)}</td>
                  <td className={`num ${pa.diff > 0 ? 'led-over-text' : pa.diff < 0 ? 'led-ok' : ''}`}>{pa.diff > 0 ? '+' : ''}{formatAmount(pa.diff)}</td>
                  <td className="num">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* 預估 vs 實際 長條圖 */}
      {grand > 0 && (
        <section className="led-block">
          <div className="led-block-head"><h3>預估 vs 實際</h3><span className="led-muted led-legend"><i className="led-dot" style={{ background: 'var(--ink-faint)' }} />預估　<i className="led-dot" style={{ background: 'var(--accent-primary)' }} />實際</span></div>
          <div className="led-cmp">
            {pa.rows.filter((r) => r.estimate > 0 || r.actual > 0).map((r) => (
              <div key={r.category} className="led-cmp-grp">
                <div className="led-cmp-cat">
                  <span><i className="led-dot" style={{ background: categoryColor(r.category) }} />{r.category}</span>
                  {r.diff !== 0 && <span className={r.diff > 0 ? 'led-over-text' : 'led-ok'}>{r.diff > 0 ? '超 ' : '省 '}{formatAmount(Math.abs(r.diff))}</span>}
                </div>
                <div className="led-cmp-lines">
                  <div className="led-cmp-line"><span className="tag">估</span><HBar value={r.estimate} max={cmpMax} color="var(--ink-faint)" /><span className="val">{formatAmount(r.estimate)}</span></div>
                  <div className="led-cmp-line"><span className="tag">實</span><HBar value={r.actual} max={cmpMax} color={categoryColor(r.category)} /><span className="val">{formatAmount(r.actual)}</span></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 每日花費 */}
      {daily.length > 0 && (
        <section className="led-block">
          <div className="led-block-head"><h3>每日花費（流水帳）</h3></div>
          <ColumnChart data={daily.map((d) => ({ label: d.date.slice(5).replace('-', '/'), value: d.twd }))} />
        </section>
      )}

      {/* 支付方式花費 */}
      {pivot.methods.length > 0 && pivot.grand > 0 && (
        <section className="led-block">
          <div className="led-block-head"><h3>各支付方式花費</h3></div>
          <PieChart data={pivot.methods.map((m, i) => ({ label: m.name, value: pivot.colTotals[i]! }))} />
        </section>
      )}

      {/* 樞紐表：類別 × 支付方式 */}
      {pivot.rows.length > 0 && pivot.methods.length > 0 && (
        <section className="led-block">
          <div className="led-block-head"><h3>樞紐表　類別 × 支付方式（台幣）</h3></div>
          <div className="led-tb-wrap">
            <table className="led-tb">
              <thead>
                <tr><th>類別 ＼ 支付</th>{pivot.methods.map((m) => <th key={m.id} className="num">{m.name}</th>)}<th className="num">合計</th></tr>
              </thead>
              <tbody>
                {pivot.rows.map((r) => (
                  <tr key={r.category}>
                    <td><i className="led-dot" style={{ background: categoryColor(r.category) }} />{r.category}</td>
                    {r.cells.map((v, i) => <td key={i} className="num">{v ? formatAmount(v) : <span className="led-muted">—</span>}</td>)}
                    <td className="num led-strong">{formatAmount(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td>合計</td>{pivot.colTotals.map((v, i) => <td key={i} className="num">{formatAmount(v)}</td>)}<td className="num led-strong">{formatAmount(pivot.grand)}</td></tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
