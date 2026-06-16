import type { Ledger, ExpenseCategory, ReservationStatus } from '../../types/ledger';
import { formatMoney } from '../../utils/money';
import {
  accommodationTotalTWD, restaurantTotalsTWD, expensesTotalTWD,
  EXPENSE_CATEGORIES, RESERVATION_LABEL, pricePerNight,
} from '../../utils/ledger';
import { exportRestaurantsCSV } from '../../services/ledgerExport';
import { useLedgerEdit } from './useLedgerEdit';
import { TextCell, NumCell, DateCell, TimeCell, SelectCell, CheckCell, DeleteCell } from './EditableCells';

const catOpts = EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }));
const statusOpts = (['reserved', 'none', 'walkin', 'impromptu', 'cancelled'] as ReservationStatus[]).map((s) => ({ value: s, label: RESERVATION_LABEL[s] }));

export default function PreDeparturePage({ ledger, tripName }: { ledger: Ledger; tripName: string }) {
  const ed = useLedgerEdit();
  const local = ledger.localCurrency;
  const curOpts = local === 'TWD' ? [{ value: 'TWD', label: 'TWD' }] : [{ value: 'TWD', label: 'TWD' }, { value: local, label: local }];
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
                <th className="num">每晚</th><th className="num">總價</th><th>幣別</th><th>附餐</th><th>平台</th><th>付款日</th><th>卡</th><th></th>
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
                  <td className="num led-muted">{formatMoney(pricePerNight(a), a.currency)}</td>
                  <td className="num"><NumCell value={a.price} onChange={(v) => ed.patchAccommodation(a.id, { price: v })} /></td>
                  <td><SelectCell value={a.currency} onChange={(v) => ed.patchAccommodation(a.id, { currency: v })} options={curOpts} /></td>
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
            <span className="led-muted">預估 {Math.round(rst.estimated).toLocaleString()}　·　實際 <b className="led-strong">{Math.round(rst.actual).toLocaleString()}</b></span>
            {ledger.restaurants.length > 0 && (
              <button className="led-export-btn" onClick={() => exportRestaurantsCSV(ledger, tripName)} title="匯出 CSV 給秘書訂位">匯出 CSV</button>
            )}
          </div>
        </div>
        <div className="led-tb-wrap">
          <table className="led-tb">
            <thead>
              <tr>
                <th>日期</th><th>時間</th><th>店名</th><th>種類</th><th>狀態</th><th className="num">預估</th>
                <th className="num">實際</th><th>幣別</th><th>支付</th><th>編號</th><th>管道</th><th>訂位人</th><th className="num">人數</th><th>聯絡</th><th>備註</th><th></th>
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
                  <td className="num"><NumCell value={r.estimated} onChange={(v) => ed.patchRestaurant(r.id, { estimated: v })} /></td>
                  <td className="num"><NumCell value={r.amount} onChange={(v) => ed.patchRestaurant(r.id, { amount: v })} /></td>
                  <td><SelectCell value={r.currency ?? 'TWD'} onChange={(v) => ed.patchRestaurant(r.id, { currency: v })} options={curOpts} /></td>
                  <td><SelectCell value={r.paymentMethodId ?? ''} onChange={(v) => ed.patchRestaurant(r.id, { paymentMethodId: v || undefined })} options={payOpts} /></td>
                  <td><TextCell value={r.bookingRef} onChange={(v) => ed.patchRestaurant(r.id, { bookingRef: v })} /></td>
                  <td><SelectCell value={r.channel ?? ''} onChange={(v) => ed.patchRestaurant(r.id, { channel: v || undefined })} options={chOpts} /></td>
                  <td><TextCell value={r.bookingName} onChange={(v) => ed.patchRestaurant(r.id, { bookingName: v })} /></td>
                  <td className="num"><NumCell value={r.partySize} onChange={(v) => ed.patchRestaurant(r.id, { partySize: v })} /></td>
                  <td><TextCell value={r.contact} onChange={(v) => ed.patchRestaurant(r.id, { contact: v })} /></td>
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
              <tr><th>付款</th><th>類別</th><th>項目</th><th className="num">金額</th><th>幣別</th><th>支付</th><th>備註</th><th></th></tr>
            </thead>
            <tbody>
              {pre.map((e) => (
                <tr key={e.id}>
                  <td><CheckCell checked={e.paid} onChange={(v) => ed.patchExpense(e.id, { paid: v })} /></td>
                  <td><SelectCell value={e.category} onChange={(v) => ed.patchExpense(e.id, { category: v as ExpenseCategory })} options={catOpts} /></td>
                  <td><TextCell value={e.title} onChange={(v) => ed.patchExpense(e.id, { title: v })} placeholder="項目" /></td>
                  <td className="num"><NumCell value={e.amount} onChange={(v) => ed.patchExpense(e.id, { amount: v })} /></td>
                  <td><SelectCell value={e.currency} onChange={(v) => ed.patchExpense(e.id, { currency: v })} options={curOpts} /></td>
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
