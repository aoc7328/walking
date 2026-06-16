import type { Ledger, ExpenseCategory, ReservationStatus } from '../../types/ledger';
import { formatMoney, formatAmount, toTWD } from '../../utils/money';
import {
  accommodationTotalTWD, restaurantTotalsTWD, expensesTotalTWD,
  EXPENSE_CATEGORIES, RESERVATION_LABEL,
} from '../../utils/ledger';
import { exportRestaurantsCSV } from '../../services/ledgerExport';
import { useLedgerEdit } from './useLedgerEdit';
import { TextCell, NumCell, DateCell, TimeCell, SelectCell, CheckCell, DeleteCell, MoneyCells } from './EditableCells';

const catOpts = EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }));
const statusOpts = (['reserved', 'none', 'walkin', 'impromptu', 'cancelled'] as ReservationStatus[]).map((s) => ({ value: s, label: RESERVATION_LABEL[s] }));

export default function PreDeparturePage({ ledger, tripName }: { ledger: Ledger; tripName: string }) {
  const ed = useLedgerEdit();
  const local = ledger.localCurrency;
  const fx = ledger.fxRate;
  const payOpts = [{ value: '', label: '—' }, ...ledger.paymentMethods.map((p) => ({ value: p.id, label: p.name }))];
  const chOpts = [{ value: '', label: '—' }, ...ledger.channels.map((c) => ({ value: c, label: c }))];
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
                <th>付款</th><th>區域</th><th>飯店</th><th>入住</th><th className="num">晚</th>
                <th className="num">每晚</th><th className="num">總價 NT$</th><th className="num">總價 {local}</th><th>附餐</th><th>平台</th><th>付款日</th><th>卡</th><th></th>
              </tr>
            </thead>
            <tbody>
              {ledger.accommodations.map((a) => (
                <tr key={a.id}>
                  <td><CheckCell checked={a.paid} onChange={(v) => ed.patchAccommodation(a.id, { paid: v })} /></td>
                  <td><TextCell value={a.area} onChange={(v) => ed.patchAccommodation(a.id, { area: v })} placeholder="區域" /></td>
                  <td><TextCell value={a.name} onChange={(v) => ed.patchAccommodation(a.id, { name: v })} placeholder="飯店名稱" /></td>
                  <td><DateCell value={a.checkIn} onChange={(v) => ed.patchAccommodation(a.id, { checkIn: v })} /></td>
                  <td className="num"><NumCell value={a.nights} onChange={(v) => ed.patchAccommodation(a.id, { nights: v })} /></td>
                  <td className="num led-muted">{a.nights > 0 ? formatAmount(toTWD(a.price, a.currency, fx) / a.nights) : 0}</td>
                  <MoneyCells amount={a.price} currency={a.currency} localCurrency={local} fxRate={fx} onChange={(amt, cur) => ed.patchAccommodation(a.id, { price: amt, currency: cur })} />
                  <td><TextCell value={a.meals} onChange={(v) => ed.patchAccommodation(a.id, { meals: v })} placeholder="附餐" /></td>
                  <td><TextCell value={a.platform} onChange={(v) => ed.patchAccommodation(a.id, { platform: v })} placeholder="平台" /></td>
                  <td><TextCell value={a.chargeDate} onChange={(v) => ed.patchAccommodation(a.id, { chargeDate: v })} placeholder="付款日" /></td>
                  <td><SelectCell value={a.paymentMethodId ?? ''} onChange={(v) => ed.patchAccommodation(a.id, { paymentMethodId: v || undefined })} options={payOpts} /></td>
                  <td><DeleteCell onClick={() => ed.delAccommodation(a.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="led-add-btn" onClick={ed.addAccommodation}>＋ 新增住宿</button>
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
                <th className="num">預估 NT$</th><th className="num">預估 {local}</th><th className="num">實際 NT$</th><th className="num">實際 {local}</th>
                <th>支付</th><th>編號</th><th>管道</th><th>備註</th><th></th>
              </tr>
            </thead>
            <tbody>
              {ledger.restaurants.map((r) => (
                <tr key={r.id}>
                  <td><DateCell value={r.date} onChange={(v) => ed.patchRestaurant(r.id, { date: v })} /></td>
                  <td><TimeCell value={r.time} onChange={(v) => ed.patchRestaurant(r.id, { time: v })} /></td>
                  <td><TextCell value={r.name} onChange={(v) => ed.patchRestaurant(r.id, { name: v })} placeholder="店名" /></td>
                  <td><TextCell value={r.cuisine} onChange={(v) => ed.patchRestaurant(r.id, { cuisine: v })} placeholder="種類" /></td>
                  <td><SelectCell value={r.status} onChange={(v) => ed.patchRestaurant(r.id, { status: v })} options={statusOpts} /></td>
                  <MoneyCells amount={r.estimated} currency={r.estimatedCurrency ?? 'TWD'} localCurrency={local} fxRate={fx} onChange={(amt, cur) => ed.patchRestaurant(r.id, { estimated: amt, estimatedCurrency: cur })} />
                  <MoneyCells amount={r.amount} currency={r.currency ?? 'TWD'} localCurrency={local} fxRate={fx} onChange={(amt, cur) => ed.patchRestaurant(r.id, { amount: amt, currency: cur })} />
                  <td><SelectCell value={r.paymentMethodId ?? ''} onChange={(v) => ed.patchRestaurant(r.id, { paymentMethodId: v || undefined })} options={payOpts} /></td>
                  <td><TextCell value={r.bookingRef} onChange={(v) => ed.patchRestaurant(r.id, { bookingRef: v })} /></td>
                  <td><SelectCell value={r.channel ?? ''} onChange={(v) => ed.patchRestaurant(r.id, { channel: v || undefined })} options={chOpts} /></td>
                  <td><TextCell value={r.note} onChange={(v) => ed.patchRestaurant(r.id, { note: v })} /></td>
                  <td><DeleteCell onClick={() => ed.delRestaurant(r.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="led-add-btn" onClick={() => ed.addRestaurant(local)}>＋ 新增餐廳</button>
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
              <tr><th>付款</th><th>類別</th><th>項目</th><th className="num">金額 NT$</th><th className="num">金額 {local}</th><th>支付</th><th>備註</th><th></th></tr>
            </thead>
            <tbody>
              {pre.map((e) => (
                <tr key={e.id}>
                  <td><CheckCell checked={e.paid} onChange={(v) => ed.patchExpense(e.id, { paid: v })} /></td>
                  <td><SelectCell value={e.category} onChange={(v) => ed.patchExpense(e.id, { category: v as ExpenseCategory })} options={catOpts} /></td>
                  <td><TextCell value={e.title} onChange={(v) => ed.patchExpense(e.id, { title: v })} placeholder="項目" /></td>
                  <MoneyCells amount={e.amount} currency={e.currency} localCurrency={local} fxRate={fx} onChange={(amt, cur) => ed.patchExpense(e.id, { amount: amt, currency: cur })} />
                  <td><SelectCell value={e.paymentMethodId ?? ''} onChange={(v) => ed.patchExpense(e.id, { paymentMethodId: v || undefined })} options={payOpts} /></td>
                  <td><TextCell value={e.note} onChange={(v) => ed.patchExpense(e.id, { note: v })} /></td>
                  <td><DeleteCell onClick={() => ed.delExpense(e.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="led-add-btn" onClick={() => ed.addExpense('pre', local)}>＋ 新增固定項</button>
      </section>
    </div>
  );
}
