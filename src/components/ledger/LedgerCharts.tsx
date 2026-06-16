import { formatAmount } from '../../utils/money';

const PIE_PALETTE = ['#5B4B7F', '#378ADD', '#EF9F27', '#1D9E75', '#D4537E', '#888780', '#BA7517', '#0F6E56', '#A32D2D'];

/** 把上界進位到漂亮的刻度（1/2/5 × 10^n）。 */
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * mag;
}

/** 圓餅圖 + 圖例。 */
export function PieChart({ data }: { data: { label: string; value: number }[] }) {
  const items = data.filter((d) => d.value > 0);
  const total = items.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return <div className="led-empty-row led-pad">尚無資料</div>;
  const cx = 90, cy = 90, r = 86;
  let acc = -Math.PI / 2;
  const wedges = items.map((d, i) => {
    const ang = (d.value / total) * Math.PI * 2;
    const start = acc;
    const end = acc + ang;
    acc = end;
    return { d, color: PIE_PALETTE[i % PIE_PALETTE.length], start, end };
  });
  const arc = (start: number, end: number) => {
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
  };
  return (
    <div className="led-pie-wrap">
      <svg viewBox="0 0 180 180" width="172" height="172" className="led-donut">
        {items.length === 1
          ? <circle cx={cx} cy={cy} r={r} fill={wedges[0]!.color} />
          : wedges.map((w, i) => <path key={i} d={arc(w.start, w.end)} fill={w.color} stroke="var(--bg-page)" strokeWidth="1" />)}
      </svg>
      <div className="led-pie-legend">
        {wedges.map((w, i) => (
          <div key={i} className="led-pie-leg">
            <span className="led-dot" style={{ background: w.color }} />
            <span className="led-pie-leg-name">{w.d.label}</span>
            <span className="led-pie-leg-val">{formatAmount(w.d.value)}　<span className="led-muted">{((w.d.value / total) * 100).toFixed(1)}%</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 垂直長條圖 + XY 軸 + 折線標點。 */
export function ColumnChart({ data, color = '#1D9E75' }: { data: { label: string; value: number }[]; color?: string }) {
  if (data.length === 0) return <div className="led-empty-row led-pad">尚無資料</div>;
  const W = 660, H = 250, mL = 56, mR = 12, mT = 12, mB = 30;
  const pW = W - mL - mR, pH = H - mT - mB;
  const yMax = niceCeil(Math.max(...data.map((d) => d.value), 1));
  const n = data.length;
  const slot = pW / n;
  const barW = Math.min(slot * 0.5, 40);
  const x = (i: number) => mL + i * slot + slot / 2;
  const y = (v: number) => mT + pH - (v / yMax) * pH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(t * yMax));
  const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" className="led-colchart">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={mL} y1={y(t)} x2={W - mR} y2={y(t)} className="led-grid" />
          <text x={mL - 6} y={y(t) + 3} className="led-axis-y">{formatAmount(t)}</text>
        </g>
      ))}
      {data.map((d, i) => (
        <rect key={i} x={x(i) - barW / 2} y={y(d.value)} width={barW} height={Math.max(0, mT + pH - y(d.value))} rx="2" fill={color} opacity="0.8" />
      ))}
      <polyline points={pts} fill="none" stroke="#2C4A3D" strokeWidth="1.5" />
      {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.value)} r="2.8" fill="#2C4A3D" />)}
      {data.map((d, i) => <text key={i} x={x(i)} y={H - 10} className="led-axis-x">{d.label}</text>)}
      <line x1={mL} y1={mT} x2={mL} y2={mT + pH} className="led-axis-line" />
      <line x1={mL} y1={mT + pH} x2={W - mR} y2={mT + pH} className="led-axis-line" />
    </svg>
  );
}
