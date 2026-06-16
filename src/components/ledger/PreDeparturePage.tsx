import type { Ledger } from '../../types/ledger';
import { formatMoney, formatAmount, toTWD } from '../../utils/money';
import {
  formatStayRange,
  pricePerNight,
  accommodationTotalTWD,
  restaurantTotalsTWD,
  expensesTotalTWD,
  RESERVATION_LABEL,
} from '../../utils/ledger';
import { exportRestaurantsCSV } from '../../services/ledgerExport';

function paidCell(paid: boolean) {
  return paid ? <span className="led-yes">✓ 已付</span> : <span className="led-no">待付</span>;
}

/** 金額：原幣；若非台幣再附上 ≈台幣。 */
function money(amount: number | undefined, currency: string, fx: number) {
  if (amount === undefined || amount === null) return <span className="led-muted">—</span>;
  if (currency === 'TWD') return formatMoney(amount, 'TWD');
  return (
    <span>
      {formatMoney(amount, currency)} <span className="led-muted">≈{formatAmount(toTWD(amount, currency, fx))}</span>
    </span>
  );
}

export default function PreDeparturePage({ ledger, tripName }: { ledger: Ledger; tripName: string }) {
  const fx = ledger.fxRate;
  const pmName = (id?: string) => ledger.paymentMethods.find((p) => p.id === id)?.name ?? '';
  const rst = restaurantTotalsTWD(ledger);
  const pre = ledger.expenses.filter((e) => e.phase === 'pre');

  return (
    <div className="led-page-cols">
      {/* 住宿 */}
      <section className="led-block">
        <div className="led-block-head">
          <h3>住宿　<span className="led-muted">{ledger.accommodations.length} 間</span></h3>
          <span className="led-muted">合計 <b className="led-strong">{formatMoney(accommodationTotalTWD(ledger), 'TWD')}</b></span>
        </div>
        <div className="led-tb-wrap">
          <table className="led-tb">
            <thead>
              <tr>
                <th>付款</th><th>區域</th><th>飯店</th><th>入住 → 退房</th><th className="num">晚</th>
                <th className="num">每晚</th><th className="num">總價</th><th>附餐</th><th>平台</th><th>付款日</th>
              </tr>
            </thead>
            <tbody>
              {ledger.accommodations.length === 0 ? (
                <tr><td colSpan={10} className="led-empty-row">尚無住宿</td></tr>
              ) : ledger.accommodations.map((a) => (
                <tr key={a.id}>
                  <td>{paidCell(a.paid)}</td>
                  <td>{a.area ?? ''}</td>
                  <td className="led-strong">{a.name}</td>
                  <td>{formatStayRange(a.checkIn, a.nights)}</td>
                  <td className="num">{a.nights}</td>
                  <td className="num">{money(pricePerNight(a), a.currency, fx)}</td>
                  <td className="num led-strong">{money(a.price, a.currency, fx)}</td>
                  <td>{a.meals ?? '—'}</td>
                  <td>{a.platform}</td>
                  <td>{a.chargeDate ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 餐廳預訂 */}
      <section className="led-block">
        <div className="led-block-head">
          <h3>餐廳預訂　<span className="led-muted">{ledger.restaurants.length} 間</span></h3>
          <div className="led-block-actions">
            <span className="led-muted">預估 {formatAmount(rst.estimated)}　·　實際 <b className="led-strong">{formatAmount(rst.actual)}</b></span>
            {ledger.restaurants.length > 0 && (
              <button className="led-export-btn" onClick={() => exportRestaurantsCSV(ledger, tripName)} title="匯出 CSV 給秘書訂位">匯出 CSV</button>
            )}
          </div>
        </div>
        <div className="led-tb-wrap">
          <table className="led-tb">
            <thead>
              <tr>
                <th>日期</th><th>時間</th><th>店名</th><th>種類</th><th>狀態</th>
                <th className="num">預估</th><th className="num">實際</th><th>支付</th><th>預約編號</th><th>管道</th><th>訂位/聯絡</th><th>備註</th>
              </tr>
            </thead>
            <tbody>
              {ledger.restaurants.length === 0 ? (
                <tr><td colSpan={12} className="led-empty-row">尚無餐廳預訂</td></tr>
              ) : ledger.restaurants.map((r) => (
                <tr key={r.id}>
                  <td>{r.date.slice(5).replace('-', '/')}</td>
                  <td>{r.time ?? ''}</td>
                  <td className="led-strong">{r.name}</td>
                  <td>{r.cuisine}</td>
                  <td><span className={`led-status led-status-${r.status}`}>{RESERVATION_LABEL[r.status]}</span></td>
                  <td className="num">{r.estimated ? formatAmount(r.estimated) : <span className="led-muted">—</span>}</td>
                  <td className="num led-strong">{r.amount ? money(r.amount, r.currency ?? 'TWD', fx) : <span className="led-muted">—</span>}</td>
                  <td>{pmName(r.paymentMethodId)}</td>
                  <td>{r.bookingRef ?? ''}</td>
                  <td>{r.channel ?? ''}</td>
                  <td>{[r.bookingName, r.contact].filter(Boolean).join(' ')}</td>
                  <td className="led-note">{r.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 其他固定項 */}
      <section className="led-block">
        <div className="led-block-head">
          <h3>其他固定項　<span className="led-muted">{pre.length} 筆</span></h3>
          <span className="led-muted">合計 <b className="led-strong">{formatMoney(expensesTotalTWD(ledger, 'pre'), 'TWD')}</b></span>
        </div>
        <div className="led-tb-wrap">
          <table className="led-tb">
            <thead>
              <tr><th>付款</th><th>類別</th><th>項目</th><th className="num">金額</th><th>備註</th></tr>
            </thead>
            <tbody>
              {pre.length === 0 ? (
                <tr><td colSpan={5} className="led-empty-row">尚無固定項</td></tr>
              ) : pre.map((e) => (
                <tr key={e.id}>
                  <td>{paidCell(e.paid)}</td>
                  <td>{e.category}</td>
                  <td className="led-strong">{e.title}</td>
                  <td className="num led-strong">{money(e.amount, e.currency, fx)}</td>
                  <td className="led-note">{e.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
