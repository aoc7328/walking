import type { Ledger, ExpenseCategory, ReservationStatus } from '../../types/ledger';
import { formatAmount, toTWD } from '../../utils/money';
import {
  accommodationTotalTWD, restaurantTotalsTWD, expensesTotalTWD,
  categoriesOf, RESERVATION_LABEL, extractStaysFromTrip,
} from '../../utils/ledger';
import { addDays, formatWithWeekday } from '../../utils/date';
import { useTripStore } from '../../stores/tripStore';
import { exportRestaurantsCSV } from '../../services/ledgerExport';
import { printReservationCard } from '../../services/reservationCard';
import { useLedgerEdit } from './useLedgerEdit';
import { TextCell, NumCell, DateCell, TimeCell, SelectCell, CheckCell, DeleteCell, MoneyInput } from './EditableCells';
import LedgerTable, { type LedgerColumn } from './LedgerTable';
import ColumnToggles from './ColumnToggles';

const statusOpts = (['reserved', 'none', 'walkin', 'impromptu', 'cancelled'] as ReservationStatus[]).map((s) => ({ value: s, label: RESERVATION_LABEL[s] }));

export default function PreDeparturePage({ ledger, tripName }: { ledger: Ledger; tripName: string }) {
  const ed = useLedgerEdit();
  const trip = useTripStore((s) => s.trip);
  const local = ledger.localCurrency;
  const fx = ledger.fxRate;
  const catOpts = categoriesOf(ledger).map((c) => ({ value: c, label: c }));
  const payOpts = [{ value: '', label: '—' }, ...ledger.paymentMethods.map((p) => ({ value: p.id, label: p.name }))];
  const chOpts = [{ value: '', label: '—' }, ...ledger.channels.map((c) => ({ value: c, label: c }))];
  const locOf = (twd: number) => (fx ? Math.round(twd / fx) : 0);
  const rst = restaurantTotalsTWD(ledger);
  const accTotal = accommodationTotalTWD(ledger);
  const preTotal = expensesTotalTWD(ledger, 'pre');
  const pre = ledger.expenses.filter((e) => e.phase === 'pre');

  const widthsOf = (id: string) => ledger.view?.colWidths?.[id] ?? {};
  const hiddenOf = (id: string) => ledger.view?.hiddenCols?.[id] ?? [];

  function importFromItinerary() {
    if (!trip) return;
    const stays = extractStaysFromTrip(trip);
    if (stays.length === 0) {
      window.alert('行程裡找不到標記為「飯店」的地點。\n請先在行程把住的地方加進去（圖示設成飯店），再回來帶入。');
      return;
    }
    const summary = stays.map((s) => `${s.checkIn}　${s.name}（${s.nights} 晚）`).join('\n');
    if (window.confirm(`從行程找到 ${stays.length} 段住宿：\n\n${summary}\n\n帶入住宿表？（同名的更新入住日/晚數，沒有的新增一列）`)) {
      ed.importStays(stays);
    }
  }

  type A = Ledger['accommodations'][number];
  const accCols: LedgerColumn<A>[] = [
    { key: 'paid', label: '付款', width: 56, render: (a) => <CheckCell checked={a.paid} onChange={(v) => ed.patchAccommodation(a.id, { paid: v })} /> },
    { key: 'area', label: '區域', width: 90, render: (a) => <TextCell value={a.area} onChange={(v) => ed.patchAccommodation(a.id, { area: v })} placeholder="區域" /> },
    { key: 'name', label: '飯店', width: 150, render: (a) => <TextCell value={a.name} onChange={(v) => ed.patchAccommodation(a.id, { name: v })} placeholder="飯店名稱" /> },
    { key: 'checkIn', label: '入住', width: 132, render: (a) => <DateCell value={a.checkIn} onChange={(v) => ed.patchAccommodation(a.id, { checkIn: v })} /> },
    { key: 'nights', label: '晚', num: true, width: 50, render: (a) => <NumCell value={a.nights} onChange={(v) => ed.patchAccommodation(a.id, { nights: v })} /> },
    { key: 'checkOut', label: '退房', width: 100, render: (a) => <span className="led-muted">{a.checkIn ? formatWithWeekday(addDays(a.checkIn, a.nights)) : '—'}</span> },
    { key: 'perNight', label: '每晚', num: true, width: 78, render: (a) => <span className="led-muted">{a.nights > 0 ? formatAmount(toTWD(a.price, a.currency, fx) / a.nights) : 0}</span> },
    { key: 'priceTwd', label: '總價 NT$', num: true, width: 92, render: (a) => <MoneyInput kind="twd" amount={a.price} currency={a.currency} localCurrency={local} fxRate={fx} onChange={(amt, cur) => ed.patchAccommodation(a.id, { price: amt, currency: cur })} />, foot: <b className="led-strong">{formatAmount(accTotal)}</b> },
    { key: 'priceLocal', label: `總價 ${local}`, num: true, width: 92, render: (a) => <MoneyInput kind="local" amount={a.price} currency={a.currency} localCurrency={local} fxRate={fx} onChange={(amt, cur) => ed.patchAccommodation(a.id, { price: amt, currency: cur })} />, foot: formatAmount(locOf(accTotal)) },
    { key: 'meals', label: '附餐', width: 90, render: (a) => <TextCell value={a.meals} onChange={(v) => ed.patchAccommodation(a.id, { meals: v })} placeholder="附餐" /> },
    { key: 'platform', label: '平台', width: 90, render: (a) => <TextCell value={a.platform} onChange={(v) => ed.patchAccommodation(a.id, { platform: v })} placeholder="平台" /> },
    { key: 'chargeDate', label: '免費取消日（含）', width: 120, render: (a) => <TextCell value={a.chargeDate} onChange={(v) => ed.patchAccommodation(a.id, { chargeDate: v })} placeholder="例：9/10" /> },
    { key: 'pay', label: '卡', width: 110, render: (a) => <SelectCell value={a.paymentMethodId ?? ''} onChange={(v) => ed.patchAccommodation(a.id, { paymentMethodId: v || undefined })} options={payOpts} /> },
    { key: 'del', label: '', width: 40, render: (a) => <DeleteCell onClick={() => ed.delAccommodation(a.id)} /> },
  ];
  const accPreset = ['perNight', 'meals', 'chargeDate', 'pay'];

  type R = Ledger['restaurants'][number];
  const restCols: LedgerColumn<R>[] = [
    { key: 'date', label: '日期', width: 132, render: (r) => <DateCell value={r.date} onChange={(v) => ed.patchRestaurant(r.id, { date: v })} /> },
    { key: 'time', label: '時間', width: 90, render: (r) => <TimeCell value={r.time} onChange={(v) => ed.patchRestaurant(r.id, { time: v })} /> },
    { key: 'name', label: '店名', width: 150, render: (r) => <TextCell value={r.name} onChange={(v) => ed.patchRestaurant(r.id, { name: v })} placeholder="店名" /> },
    { key: 'cuisine', label: '種類', width: 90, render: (r) => <TextCell value={r.cuisine} onChange={(v) => ed.patchRestaurant(r.id, { cuisine: v })} placeholder="種類" /> },
    { key: 'status', label: '狀態', width: 92, render: (r) => <SelectCell value={r.status} onChange={(v) => ed.patchRestaurant(r.id, { status: v })} options={statusOpts} /> },
    { key: 'estTwd', label: '預估 NT$', num: true, width: 84, render: (r) => <MoneyInput kind="twd" amount={r.estimated} currency={r.estimatedCurrency ?? 'TWD'} localCurrency={local} fxRate={fx} onChange={(amt, cur) => ed.patchRestaurant(r.id, { estimated: amt, estimatedCurrency: cur })} />, foot: formatAmount(rst.estimated) },
    { key: 'estLocal', label: `預估 ${local}`, num: true, width: 84, render: (r) => <MoneyInput kind="local" amount={r.estimated} currency={r.estimatedCurrency ?? 'TWD'} localCurrency={local} fxRate={fx} onChange={(amt, cur) => ed.patchRestaurant(r.id, { estimated: amt, estimatedCurrency: cur })} />, foot: formatAmount(locOf(rst.estimated)) },
    { key: 'actTwd', label: '實際 NT$', num: true, width: 84, render: (r) => <MoneyInput kind="twd" amount={r.amount} currency={r.currency ?? 'TWD'} localCurrency={local} fxRate={fx} onChange={(amt, cur) => ed.patchRestaurant(r.id, { amount: amt, currency: cur })} />, foot: <b className="led-strong">{formatAmount(rst.actual)}</b> },
    { key: 'actLocal', label: `實際 ${local}`, num: true, width: 84, render: (r) => <MoneyInput kind="local" amount={r.amount} currency={r.currency ?? 'TWD'} localCurrency={local} fxRate={fx} onChange={(amt, cur) => ed.patchRestaurant(r.id, { amount: amt, currency: cur })} />, foot: formatAmount(locOf(rst.actual)) },
    { key: 'pay', label: '支付', width: 110, render: (r) => <SelectCell value={r.paymentMethodId ?? ''} onChange={(v) => ed.patchRestaurant(r.id, { paymentMethodId: v || undefined })} options={payOpts} /> },
    { key: 'ref', label: '編號', width: 90, render: (r) => <TextCell value={r.bookingRef} onChange={(v) => ed.patchRestaurant(r.id, { bookingRef: v })} /> },
    { key: 'channel', label: '管道', width: 100, render: (r) => <SelectCell value={r.channel ?? ''} onChange={(v) => ed.patchRestaurant(r.id, { channel: v || undefined })} options={chOpts} /> },
    { key: 'note', label: '備註', width: 120, render: (r) => <TextCell value={r.note} onChange={(v) => ed.patchRestaurant(r.id, { note: v })} /> },
    { key: 'card', label: '牌', width: 48, render: (r) => <button className="led-export-btn" onClick={() => printReservationCard(r, ledger)} title="印出預訂牌（語言依目的地）">牌</button> },
    { key: 'del', label: '', width: 40, render: (r) => <DeleteCell onClick={() => ed.delRestaurant(r.id)} /> },
  ];
  const restPreset = ['estTwd', 'estLocal', 'ref', 'channel', 'note'];

  type E = Ledger['expenses'][number];
  const fixedCols: LedgerColumn<E>[] = [
    { key: 'paid', label: '付款', width: 56, render: (e) => <CheckCell checked={e.paid} onChange={(v) => ed.patchExpense(e.id, { paid: v })} /> },
    { key: 'category', label: '類別', width: 90, render: (e) => <SelectCell value={e.category} onChange={(v) => ed.patchExpense(e.id, { category: v as ExpenseCategory })} options={catOpts} /> },
    { key: 'title', label: '項目', width: 150, render: (e) => <TextCell value={e.title} onChange={(v) => ed.patchExpense(e.id, { title: v })} placeholder="項目" /> },
    { key: 'amtTwd', label: '金額 NT$', num: true, width: 92, render: (e) => <MoneyInput kind="twd" amount={e.amount} currency={e.currency} localCurrency={local} fxRate={fx} onChange={(amt, cur) => ed.patchExpense(e.id, { amount: amt, currency: cur })} />, foot: <b className="led-strong">{formatAmount(preTotal)}</b> },
    { key: 'amtLocal', label: `金額 ${local}`, num: true, width: 92, render: (e) => <MoneyInput kind="local" amount={e.amount} currency={e.currency} localCurrency={local} fxRate={fx} onChange={(amt, cur) => ed.patchExpense(e.id, { amount: amt, currency: cur })} />, foot: formatAmount(locOf(preTotal)) },
    { key: 'pay', label: '支付', width: 110, render: (e) => <SelectCell value={e.paymentMethodId ?? ''} onChange={(v) => ed.patchExpense(e.id, { paymentMethodId: v || undefined })} options={payOpts} /> },
    { key: 'note', label: '備註', width: 120, render: (e) => <TextCell value={e.note} onChange={(v) => ed.patchExpense(e.id, { note: v })} /> },
    { key: 'del', label: '', width: 40, render: (e) => <DeleteCell onClick={() => ed.delExpense(e.id)} /> },
  ];
  const fixedPreset = ['amtLocal', 'note'];

  return (
    <div className="led-page-cols led-cols-wide">
      <div className="led-cols-bar">
        <span className="led-muted">欄位顯示：</span>
        <ColumnToggles tableId="acc" title="住宿" columns={accCols} hidden={hiddenOf('acc')} presetHidden={accPreset} onToggle={ed.toggleCol} onSet={ed.setHiddenCols} />
        <ColumnToggles tableId="rest" title="餐廳" columns={restCols} hidden={hiddenOf('rest')} presetHidden={restPreset} onToggle={ed.toggleCol} onSet={ed.setHiddenCols} />
        <ColumnToggles tableId="fixed" title="固定項" columns={fixedCols} hidden={hiddenOf('fixed')} presetHidden={fixedPreset} onToggle={ed.toggleCol} onSet={ed.setHiddenCols} />
        <span className="led-muted">　拖欄位邊界可調寬，調完按右上「儲存」保留</span>
      </div>

      {/* 住宿 */}
      <section className="led-block" id="sec-acc">
        <div className="led-block-head">
          <h3>住宿　<span className="led-muted">{ledger.accommodations.length} 間</span></h3>
          <div className="led-block-actions">
            <button className="led-add-btn" style={{ marginTop: 0 }} onClick={ed.addAccommodation}>＋ 新增住宿</button>
            <button className="led-export-btn" onClick={importFromItinerary} title="掃描行程裡標為飯店的地點，自動帶入入住日與連住晚數">從行程帶入</button>
          </div>
        </div>
        <LedgerTable tableId="acc" columns={accCols} rows={ledger.accommodations} rowKey={(a) => a.id} hidden={hiddenOf('acc')} widths={widthsOf('acc')} onResize={(k, w) => ed.setColWidth('acc', k, w)} draggable onReorder={(a, o) => ed.reorderAccommodations(a, o)} footerLabel="小計" emptyText="尚無住宿" />
      </section>

      {/* 餐廳預訂 */}
      <section className="led-block" id="sec-rest">
        <div className="led-block-head">
          <h3>餐廳預訂　<span className="led-muted">{ledger.restaurants.length} 間</span></h3>
          <div className="led-block-actions">
            <button className="led-add-btn" style={{ marginTop: 0 }} onClick={() => ed.addRestaurant(local)}>＋ 新增餐廳</button>
            {ledger.restaurants.length > 0 && (
              <>
                <button className="led-export-btn" onClick={() => exportRestaurantsCSV(ledger, tripName, 'all')} title="完整欄位（含金額），給自己對帳">匯出全部</button>
                <button className="led-export-btn" onClick={() => exportRestaurantsCSV(ledger, tripName, 'secretary')} title="只含訂位需要的欄位 + 飲食/語言需求，給秘書">給秘書</button>
              </>
            )}
          </div>
        </div>
        <LedgerTable tableId="rest" columns={restCols} rows={ledger.restaurants} rowKey={(r) => r.id} hidden={hiddenOf('rest')} widths={widthsOf('rest')} onResize={(k, w) => ed.setColWidth('rest', k, w)} draggable onReorder={(a, o) => ed.reorderRestaurants(a, o)} footerLabel="小計 · 吃飯" emptyText="尚無餐廳預訂" />
      </section>

      {/* 其他固定項 */}
      <section className="led-block" id="sec-fixed">
        <div className="led-block-head">
          <h3>其他固定項　<span className="led-muted">{pre.length} 筆</span></h3>
          <button className="led-add-btn" style={{ marginTop: 0 }} onClick={() => ed.addExpense('pre', local)}>＋ 新增固定項</button>
        </div>
        <LedgerTable tableId="fixed" columns={fixedCols} rows={pre} rowKey={(e) => e.id} hidden={hiddenOf('fixed')} widths={widthsOf('fixed')} onResize={(k, w) => ed.setColWidth('fixed', k, w)} draggable onReorder={(a, o) => ed.reorderExpenses('pre', a, o)} footerLabel="小計" emptyText="尚無固定項" />
      </section>
    </div>
  );
}
