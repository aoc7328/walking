import { useState } from 'react';
import type { Ledger, PaymentKind } from '../../types/ledger';
import { EXPENSE_CATEGORIES, categoriesOf } from '../../utils/ledger';
import { useLedgerEdit } from './useLedgerEdit';
import { TextCell, NumCell, SelectCell, DeleteCell } from './EditableCells';

const kindOpts: { value: PaymentKind; label: string }[] = [
  { value: 'card', label: '信用卡' },
  { value: 'cash', label: '現金' },
  { value: 'mobile', label: '行動支付' },
];

export default function SettingsPage({ ledger }: { ledger: Ledger }) {
  const ed = useLedgerEdit();
  const [newChannel, setNewChannel] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const cats = categoriesOf(ledger);
  const isDefaultCat = (c: string) => (EXPENSE_CATEGORIES as string[]).includes(c);

  return (
    <div className="led-page-cols">
      {/* 幣別與匯率 */}
      <section className="led-block">
        <div className="led-block-head"><h3>幣別與匯率</h3></div>
        <div className="led-settings-row">
          <label>當地貨幣
            <input className="led-cell led-cell-boxed" value={ledger.localCurrency} onChange={(e) => ed.setMeta({ localCurrency: e.target.value.toUpperCase() })} placeholder="JPY / NZD…" />
          </label>
          <label>匯率　1 {ledger.localCurrency} =
            <input className="led-cell led-cell-boxed num" type="number" step="0.0001" value={ledger.fxRate} onChange={(e) => ed.setMeta({ fxRate: Number(e.target.value) || 0 })} />
            TWD
          </label>
        </div>
      </section>

      {/* 支付方式 */}
      <section className="led-block">
        <div className="led-block-head"><h3>支付方式　<span className="led-muted">{ledger.paymentMethods.length}</span></h3></div>
        <div className="led-tb-wrap">
          <table className="led-tb">
            <thead><tr><th>名稱</th><th>類型</th><th className="num">刷卡上限（台幣，可空）</th><th>備註（優惠/回饋）</th><th></th></tr></thead>
            <tbody>
              {ledger.paymentMethods.map((p) => (
                <tr key={p.id}>
                  <td><TextCell value={p.name} onChange={(v) => ed.patchPayment(p.id, { name: v })} placeholder="例：A卡 國泰CUBE" /></td>
                  <td><SelectCell value={p.kind} onChange={(v) => ed.patchPayment(p.id, { kind: v })} options={kindOpts} /></td>
                  <td className="num">{p.kind === 'card' ? <NumCell value={p.limit} onChange={(v) => ed.patchPayment(p.id, { limit: v || undefined })} placeholder="不限" /> : <span className="led-muted">—</span>}</td>
                  <td><TextCell value={p.note} onChange={(v) => ed.patchPayment(p.id, { note: v })} placeholder="例：日本實體刷 3% 回饋" /></td>
                  <td><DeleteCell onClick={() => ed.delPayment(p.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="led-add-btn" onClick={ed.addPayment}>＋ 新增支付方式</button>
      </section>

      {/* 餐廳訂位預設 */}
      <section className="led-block">
        <div className="led-block-head"><h3>餐廳訂位預設</h3>
          <span className="led-muted">同行成員固定，每餐共用；匯出給秘書時自動帶上，不必每餐重填</span>
        </div>
        <div className="led-settings-row">
          <label>訂位人
            <input className="led-cell led-cell-boxed" value={ledger.reservation?.bookingName ?? ''} onChange={(e) => ed.setReservation({ bookingName: e.target.value })} placeholder="例：張先生" />
          </label>
          <label>主訂者
            <input className="led-cell led-cell-boxed" value={ledger.reservation?.leadGuest ?? ''} onChange={(e) => ed.setReservation({ leadGuest: e.target.value })} placeholder="主要聯絡人" />
          </label>
          <label>人數
            <input className="led-cell led-cell-boxed num" type="number" value={ledger.reservation?.partySize ?? ''} onChange={(e) => ed.setReservation({ partySize: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="2" />
          </label>
          <label>聯絡方式
            <input className="led-cell led-cell-boxed" value={ledger.reservation?.contact ?? ''} onChange={(e) => ed.setReservation({ contact: e.target.value })} placeholder="電話 / email" />
          </label>
        </div>
        <label className="led-fullnote">飲食習慣與語言需求
          <input className="led-cell led-cell-boxed led-cell-wide" value={ledger.reservation?.dietaryNote ?? ''} onChange={(e) => ed.setReservation({ dietaryNote: e.target.value })} placeholder="例：兩位都不吃生食、會過敏蝦蟹；不會日文，請以英文或圖片溝通" />
        </label>
      </section>

      {/* 預約管道 */}
      <section className="led-block">
        <div className="led-block-head"><h3>預約管道</h3></div>
        <div className="led-chips">
          {ledger.channels.length === 0 && <span className="led-muted">尚無（例：TableCheck、白金秘書）</span>}
          {ledger.channels.map((c) => (
            <span key={c} className="led-chip">{c}<button className="led-chip-x" onClick={() => ed.delChannel(c)} aria-label="刪除">×</button></span>
          ))}
        </div>
        <div className="led-settings-row">
          <input className="led-cell led-cell-boxed" value={newChannel} onChange={(e) => setNewChannel(e.target.value)} placeholder="新增預約管道"
            onKeyDown={(e) => { if (e.key === 'Enter' && newChannel.trim()) { ed.addChannel(newChannel.trim()); setNewChannel(''); } }} />
          <button className="led-add-btn" style={{ marginTop: 0 }} onClick={() => { if (newChannel.trim()) { ed.addChannel(newChannel.trim()); setNewChannel(''); } }}>新增</button>
        </div>
      </section>

      {/* 類別與各類別預算 */}
      <section className="led-block">
        <div className="led-block-head"><h3>類別與預算（台幣）</h3>
          <span className="led-muted">可新增自訂類別；預算上限給出發後分頁顯示三段進度</span>
        </div>
        <div className="led-tb-wrap">
          <table className="led-tb">
            <thead><tr><th>類別</th><th className="num">預算上限</th><th></th></tr></thead>
            <tbody>
              {cats.map((cat) => {
                const b = ledger.budgets.find((x) => x.category === cat);
                return (
                  <tr key={cat}>
                    <td className="led-strong">{cat}{isDefaultCat(cat) ? '' : ' ·自訂'}</td>
                    <td className="num"><NumCell value={b?.amount} onChange={(v) => ed.setBudget(cat, v)} placeholder="未設" /></td>
                    <td>{isDefaultCat(cat) ? null : <DeleteCell onClick={() => { if (window.confirm(`刪除自訂類別「${cat}」？（已用此類別的紀錄不會被刪，只是類別清單與預算移除）`)) ed.delCategory(cat); }} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="led-settings-row" style={{ marginTop: 8 }}>
          <input className="led-cell led-cell-boxed" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="新增類別（例：門票、娛樂）"
            onKeyDown={(e) => { if (e.key === 'Enter' && newCategory.trim()) { ed.addCategory(newCategory.trim()); setNewCategory(''); } }} />
          <button className="led-add-btn" style={{ marginTop: 0 }} onClick={() => { if (newCategory.trim()) { ed.addCategory(newCategory.trim()); setNewCategory(''); } }}>新增類別</button>
        </div>
      </section>
    </div>
  );
}
