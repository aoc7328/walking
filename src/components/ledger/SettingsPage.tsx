import { useRef, useState } from 'react';
import type { Ledger, PaymentKind } from '../../types/ledger';
import { EXPENSE_CATEGORIES, categoriesOf, categorySplit, DESTINATIONS } from '../../utils/ledger';
import { formatAmount } from '../../utils/money';
import { fileToScaledPngDataUrl, tightenQrCardImage } from '../../utils/image';
import { downloadVjwCardJpg, printVjwCards } from '../../services/vjwCard';
import { dataUrlToBlob, imageSrc, uploadAsset } from '../../services/assets';
import { useTripStore } from '../../stores/tripStore';
import { useLedgerEdit } from './useLedgerEdit';
import { TextCell, DateCell, NumCell, SelectCell, DeleteCell } from './EditableCells';

const kindOpts: { value: PaymentKind; label: string }[] = [
  { value: 'card', label: '信用卡' },
  { value: 'cash', label: '現金' },
  { value: 'mobile', label: '行動支付' },
];

export default function SettingsPage({ ledger, tripName }: { ledger: Ledger; tripName: string }) {
  const ed = useLedgerEdit();
  const [newChannel, setNewChannel] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [uploading, setUploading] = useState(false);
  const [ticketUploading, setTicketUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const ticketRef = useRef<HTMLInputElement>(null);
  const tripId = useTripStore((s) => s.trip?.id ?? '');
  const cats = categoriesOf(ledger);
  const split = categorySplit(ledger);
  const isDefaultCat = (c: string) => (EXPENSE_CATEGORIES as string[]).includes(c);
  const vjw = ledger.vjw ?? [];
  const tickets = ledger.tickets ?? [];

  async function handleVjwFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const scaled = await fileToScaledPngDataUrl(f, 1000);
        const tight = await tightenQrCardImage(scaled); // 去掉 QR 與英文名之間的大留白
        const key = await uploadAsset(dataUrlToBlob(tight), tripId);
        ed.addVjwEntry(key);
      }
    } catch (err) {
      window.alert('上傳失敗：' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  /** 票券 / 訂位截圖：原圖縮到 1400px（QR 要掃得到）後上傳 R2，標題預設用檔名。 */
  async function handleTicketFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setTicketUploading(true);
    try {
      for (const f of Array.from(files)) {
        const scaled = await fileToScaledPngDataUrl(f, 1400);
        const key = await uploadAsset(dataUrlToBlob(scaled), tripId);
        ed.addTicket({ title: f.name.replace(/\.[^.]+$/, '').slice(0, 40), imageKey: key });
      }
    } catch (err) {
      window.alert('上傳失敗：' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setTicketUploading(false);
      if (ticketRef.current) ticketRef.current.value = '';
    }
  }

  return (
    <div className="led-page-cols">
      {/* 目的地・幣別・匯率 */}
      <section className="led-block">
        <div className="led-block-head"><h3>目的地・幣別・匯率</h3>
          <span className="led-muted">選目的地會自動帶幣別與語言（預訂牌就用該國語言）</span>
        </div>
        <div className="led-settings-row">
          <label>旅行目的地
            <select className="led-cell led-cell-boxed" value={ledger.destination ?? ''} onChange={(e) => { const d = DESTINATIONS.find((x) => x.name === e.target.value); if (d) ed.setDestination(d.name, d.currency, d.language); }}>
              <option value="" disabled>選擇國家…</option>
              {DESTINATIONS.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
          </label>
          <label>當地貨幣
            <input className="led-cell led-cell-boxed" value={ledger.localCurrency} onChange={(e) => ed.setMeta({ localCurrency: e.target.value.toUpperCase() })} placeholder="JPY / NZD…" />
          </label>
          <label>匯率　1 {ledger.localCurrency} =
            <input className="led-cell led-cell-boxed num" type="number" step="0.0001" value={ledger.fxRate} onChange={(e) => ed.setMeta({ fxRate: Number(e.target.value) || 0 })} />
            TWD
          </label>
        </div>
      </section>

      {/* Visit Japan Web 入境 QR（只有目的地為日本時出現） */}
      {ledger.destination === '日本' && (
        <section className="led-block">
          <div className="led-block-head"><h3>Visit Japan Web 入境 QR</h3>
            <span className="led-muted">一人上傳一張 QR 截圖，填中文姓名與護照英文姓名；圖存雲端，手機版「手牌」分頁可直接出示，也能下載 JPG 或列印剪開塞護照</span>
          </div>
          <div className="vjw-list">
            {vjw.length === 0 && <span className="led-muted">尚無——按下方「上傳 QR」加入第一個人</span>}
            {vjw.map((v) => (
              <div key={v.id} className="vjw-row">
                <img className="vjw-thumb" src={imageSrc(v)} alt="Visit Japan Web QR" />
                <label className="vjw-name-field">中文姓名
                  <input className="led-cell led-cell-boxed" value={v.nameZh ?? ''} onChange={(e) => ed.patchVjwEntry(v.id, { nameZh: e.target.value })} placeholder="例：張思齊" />
                </label>
                <label className="vjw-name-field">英文姓名（護照）
                  <input className="led-cell led-cell-boxed" value={v.nameEn ?? ''} onChange={(e) => ed.patchVjwEntry(v.id, { nameEn: e.target.value })} placeholder="例：CHANG, SSU-CHI" />
                </label>
                <button className="led-export-btn" onClick={() => { void downloadVjwCardJpg(v, tripName); }} title="下載這個人的資訊卡（JPG，存手機）">下載 JPG</button>
                <button className="vjw-del" onClick={() => { if (window.confirm('刪除這張 QR？')) ed.delVjwEntry(v.id); }} aria-label="刪除" title="刪除">×</button>
              </div>
            ))}
          </div>
          <div className="led-settings-row" style={{ marginTop: 8 }}>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void handleVjwFiles(e.target.files); }} />
            <button className="led-add-btn" style={{ marginTop: 0 }} disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? '處理中…' : '＋ 上傳 QR'}</button>
            {vjw.length > 0 && (
              <button className="led-export-btn" onClick={() => printVjwCards(vjw, tripName)} title="全部人排在同一張 A4，印出來自己剪開">🖨 列印全部（A4）</button>
            )}
          </div>
        </section>
      )}

      {/* 票券 / 訂位截圖 */}
      <section className="led-block">
        <div className="led-block-head"><h3>票券 · 訂位截圖　<span className="led-muted">{tickets.length}</span></h3>
          <span className="led-muted">入場券、KKday 憑證、租車確認信、車票 QR…上傳圖片就好；手機版「手牌」分頁可全螢幕出示</span>
        </div>
        <div className="tk-list">
          {tickets.length === 0 && <span className="led-muted">尚無——按下方「上傳票券圖」加入</span>}
          {tickets.map((t) => (
            <div key={t.id} className="tk-row">
              <a href={imageSrc(t)} target="_blank" rel="noreferrer" title="開新分頁看原圖">
                <img className="tk-thumb" src={imageSrc(t)} alt={t.title} />
              </a>
              <div className="tk-fields">
                <label className="tk-field">標題
                  <TextCell value={t.title} onChange={(v) => ed.patchTicket(t.id, { title: v })} placeholder="例：環球影城 快速通關" />
                </label>
                <label className="tk-field tk-field-date">使用日期
                  <DateCell value={t.date} onChange={(v) => ed.patchTicket(t.id, { date: v })} />
                </label>
                <label className="tk-field tk-field-note">備註
                  <TextCell value={t.note} onChange={(v) => ed.patchTicket(t.id, { note: v })} placeholder="座位 / 取票方式 / 注意事項" />
                </label>
              </div>
              <button className="vjw-del" onClick={() => { if (window.confirm(`刪除「${t.title || '這張票券'}」？`)) ed.delTicket(t.id); }} aria-label="刪除" title="刪除">×</button>
            </div>
          ))}
        </div>
        <div className="led-settings-row" style={{ marginTop: 8 }}>
          <input ref={ticketRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void handleTicketFiles(e.target.files); }} />
          <button className="led-add-btn" style={{ marginTop: 0 }} disabled={ticketUploading} onClick={() => ticketRef.current?.click()}>{ticketUploading ? '上傳中…' : '＋ 上傳票券圖'}</button>
          <span className="led-muted">單張上限 5MB，可一次選多張</span>
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
          <label>人數
            <input className="led-cell led-cell-boxed num" type="number" value={ledger.reservation?.partySize ?? ''} onChange={(e) => ed.setReservation({ partySize: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="2" />
          </label>
          <label>聯絡方式
            <input className="led-cell led-cell-boxed" value={ledger.reservation?.contact ?? ''} onChange={(e) => ed.setReservation({ contact: e.target.value })} placeholder="電話" />
          </label>
          <label>Email
            <input className="led-cell led-cell-boxed" type="email" value={ledger.reservation?.email ?? ''} onChange={(e) => ed.setReservation({ email: e.target.value })} placeholder="name@example.com" />
          </label>
        </div>
        <div className="led-fullnote led-fullnote-col">
          <span>飲食習慣與語言需求</span>
          <textarea className="led-cell led-cell-boxed led-textarea" rows={3} value={ledger.reservation?.dietaryNote ?? ''} onChange={(e) => ed.setReservation({ dietaryNote: e.target.value })} placeholder="例：&#10;・兩位都不吃生食、會過敏蝦蟹&#10;・不會日文，請以英文或圖片溝通&#10;・其中一位吃素" />
        </div>
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
          <span className="led-muted">「已知/已訂」自動帶入（機票・租車・已訂餐廳…），你只要填「額外預估」零星支出，總預算自動加好</span>
        </div>
        <div className="led-tb-wrap">
          <table className="led-tb">
            <thead><tr><th>類別</th><th className="num">已知 / 已訂</th><th className="num">＋ 額外預估</th><th className="num">＝ 總預算</th><th></th></tr></thead>
            <tbody>
              {cats.map((cat) => {
                const b = ledger.budgets.find((x) => x.category === cat);
                const committed = Math.round(split[cat]?.planned ?? 0);
                const extra = b?.amount ?? 0;
                return (
                  <tr key={cat}>
                    <td className="led-strong">{cat}{isDefaultCat(cat) ? '' : ' ·自訂'}</td>
                    <td className="num led-muted">{committed ? formatAmount(committed) : '—'}</td>
                    <td className="num"><NumCell value={b?.amount} onChange={(v) => ed.setBudget(cat, v)} placeholder="0" /></td>
                    <td className="num led-strong">{committed + extra ? formatAmount(committed + extra) : '—'}</td>
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
