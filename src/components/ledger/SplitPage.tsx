import { useRef, useState } from 'react';
import type { Expense, Ledger } from '../../types/ledger';
import { formatAmount, formatMoney, toTWD } from '../../utils/money';
import {
  SELF, knownPayees, lineTotal, outstandingTWD, parseSplitLines, payeeTotals, purchaseOf, purchases, splitDiff, splitsSubtotal,
} from '../../utils/split';
import { formatMonthDay } from '../../utils/date';
import { useLedgerEdit } from './useLedgerEdit';
import { TextCell, NumCell, DeleteCell } from './EditableCells';
import { assetUrl, dataUrlToBlob, uploadAsset } from '../../services/assets';
import { fileToScaledJpegDataUrl } from '../../utils/image';

/**
 * 一張發票照片 → 可上傳的 Blob。
 *
 * 後端單張上限 5MB。相機照片先用 JPEG 1600px 壓一次，萬一還是太大
 * （超長的收據、超高畫素手機）就再降一階，不要讓使用者在店門口卡住。
 */
async function receiptBlob(file: File): Promise<Blob> {
  let blob = dataUrlToBlob(await fileToScaledJpegDataUrl(file, 1600, 0.82));
  if (blob.size > 4.5 * 1024 * 1024) blob = dataUrlToBlob(await fileToScaledJpegDataUrl(file, 1200, 0.7));
  return blob;
}

const PAYEE_LIST_ID = 'split-payee-options';

/**
 * 代買分帳：一筆代買一張獨立的卡，裡面是那一攤的明細、發票、收款。
 * 不同攤之間互不干擾——同一個人這攤給了、下一攤還沒給，是兩回事。
 */
export default function SplitPage({ ledger, tripId }: { ledger: Ledger; tripId: string }) {
  const ed = useLedgerEdit();
  const list = purchases(ledger);
  const owed = outstandingTWD(ledger);
  const byPerson = payeeTotals(ledger);

  /** 還沒拆過的支出：選一筆就開一攤新的。 */
  const candidates = [...ledger.expenses]
    .filter((e) => !(e.splits?.length || e.receiptKeys?.length))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  const [pickId, setPickId] = useState('');

  return (
    <div className="led-page-cols">
      <section className="led-block">
        <div className="led-block-head">
          <h3>代買 · 拆帳　<span className="led-muted">{list.length} 攤</span></h3>
          <span className="led-muted">
            還沒收回來 <b className={owed > 0 ? 'led-over-text' : 'led-ok'}>{formatMoney(owed, 'TWD')}</b>
          </span>
        </div>

        <div className="led-split-pick">
          <select className="led-cell led-cell-boxed led-cell-wide" value={pickId} onChange={(e) => setPickId(e.target.value)}>
            <option value="">從流水帳挑一筆，開一攤新的代買…</option>
            {candidates.map((e) => (
              <option key={e.id} value={e.id}>
                {(e.date ? formatMonthDay(e.date) : '無日期') + '　' + (e.title || '（未命名）') + '　' + formatMoney(e.amount, e.currency)}
              </option>
            ))}
          </select>
          <button
            className="btn"
            disabled={!pickId}
            onClick={() => { ed.addSplit(pickId); setPickId(''); }}
          >開始拆這筆</button>
        </div>

        {list.length === 0 && (
          <div className="led-empty-row led-pad">
            還沒有任何代買。上面挑一筆已經記在帳上的花費（例如藥妝店那筆），就會在下面開出一張獨立的卡。
          </div>
        )}
      </section>

      {list.map((p) => (
        <PurchaseCard key={p.expense.id} purchase={p} ledger={ledger} tripId={tripId} />
      ))}

      {byPerson.length > 0 && list.length > 1 && (
        <section className="led-block">
          <div className="led-block-head"><h3>依人合計</h3>
            <span className="led-muted">跨所有代買，最後跟人收錢時看這個</span>
          </div>
          <div className="led-cards-grid led-payee-grid">
            {byPerson.map((t) => (
              <div key={t.name} className={`led-cardbox led-payee${t.outstanding === 0 ? ' settled' : ''}`}>
                <div className="led-cardbox-top">
                  <span className="led-strong">{t.name}</span>
                  <span className="led-muted">{t.items} 件</span>
                </div>
                <div className="led-cardbox-amt">{formatMoney(t.outstanding, 'TWD')}</div>
                <div className="led-muted">{t.outstanding === 0 ? '全部收齊了' : `共 ${formatAmount(t.twd)}，還沒收 ${formatAmount(t.outstanding)}`}</div>
                <ul className="led-payee-lines">
                  {t.entries.map(({ expense, share }) => (
                    <li key={expense.id}>
                      <span className="led-muted">
                        {expense.date ? formatMonthDay(expense.date) : '—'}　{expense.title || '（未命名）'}
                      </span>
                      <span>{formatMoney(share.amount, expense.currency)}{share.settled ? ' ✓' : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <datalist id={PAYEE_LIST_ID}>
        {knownPayees(ledger).map((p) => <option key={p} value={p} />)}
      </datalist>
    </div>
  );
}

/** 一攤代買：明細 → 配人 → 發票 → 收款，全部在這張卡裡。 */
function PurchaseCard({ purchase, ledger, tripId }: { purchase: ReturnType<typeof purchaseOf>; ledger: Ledger; tripId: string }) {
  const ed = useLedgerEdit();
  const fileRef = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState('');
  const [uploading, setUploading] = useState(false);

  const e: Expense = purchase.expense;
  const splits = e.splits ?? [];
  const receipts = e.receiptKeys ?? [];
  const cur = e.currency;
  const fx = ledger.fxRate;
  const diff = splitDiff(e);

  function applyPaste() {
    const lines = parseSplitLines(paste);
    if (lines.length === 0) {
      window.alert('這段文字裡沒有「品名, 金額」格式的行。每行請寫成：品名, 單價, 數量, 歸誰（後兩欄可省略）');
      return;
    }
    ed.addSplitLines(e.id, lines);
    setPaste('');
  }

  async function addReceipts(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const keys: string[] = [];
      for (const f of Array.from(files)) {
        keys.push(await uploadAsset(await receiptBlob(f), tripId));
      }
      ed.addReceipts(e.id, keys);
    } catch (err) {
      window.alert('發票上傳失敗：' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <section className="led-block led-purchase">
      <div className="led-block-head">
        <h3>
          {e.date ? formatMonthDay(e.date) : '無日期'}　{e.title || '（未命名）'}
          <span className="led-muted">　{formatMoney(e.amount, cur)}</span>
        </h3>
        <span className="led-muted">
          自己 <b className="led-strong">{formatMoney(purchase.self, cur)}</b>
          {purchase.others.length > 0 && (
            <>　·　還沒收 <b className={purchase.outstanding > 0 ? 'led-over-text' : 'led-ok'}>{formatMoney(purchase.outstanding, cur)}</b></>
          )}
        </span>
      </div>

      {splits.length > 0 && diff !== 0 && (
        <div className="led-split-warn">
          明細加總比刷卡金額{diff < 0 ? '多' : '少'} {formatMoney(Math.abs(diff), cur)}，差額已按各人金額比例分攤。
        </div>
      )}

      <div className="led-tb-wrap">
        <table className="led-tb led-split-tb">
          <thead>
            <tr><th>品名</th><th className="num">單價</th><th className="num">數量</th><th className="num">小計</th><th>歸誰</th><th /></tr>
          </thead>
          <tbody>
            {splits.length === 0 && (
              <tr><td colSpan={6} className="led-empty-row">還沒有明細。按「＋ 一項」手動加，或用下面的貼上框一次帶進來。</td></tr>
            )}
            {splits.map((s) => (
              <tr key={s.id}>
                <td><TextCell value={s.label} onChange={(v) => ed.patchSplit(e.id, s.id, { label: v })} placeholder="商品名稱" /></td>
                <td className="num"><NumCell value={s.price} onChange={(v) => ed.patchSplit(e.id, s.id, { price: v })} /></td>
                <td className="num"><NumCell value={s.qty} onChange={(v) => ed.patchSplit(e.id, s.id, { qty: v })} /></td>
                <td className="num led-strong">{formatAmount(lineTotal(s))}</td>
                <td>
                  <input
                    className="led-cell"
                    list={PAYEE_LIST_ID}
                    value={s.person ?? ''}
                    placeholder={SELF}
                    onChange={(ev) => ed.patchSplit(e.id, s.id, { person: ev.target.value || undefined })}
                  />
                </td>
                <td><DeleteCell onClick={() => ed.delSplit(e.id, s.id)} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="led-strong">明細加總</td>
              <td colSpan={2} />
              <td className="num led-strong">{formatAmount(splitsSubtotal(splits))}</td>
              <td colSpan={2} className="led-muted">這筆刷了 {formatMoney(e.amount, cur)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="led-split-shares">
        {purchase.shares.map((s) => (
          <span key={s.person} className={`led-split-chip${s.settled ? ' done' : ''}`}>
            {s.person}
            <b>{formatMoney(s.amount, cur)}</b>
            <i className="led-muted">≒ {formatMoney(toTWD(s.amount, cur, fx), 'TWD')}</i>
          </span>
        ))}
      </div>

      <div className="led-split-paste">
        <textarea
          className="led-cell led-split-textarea"
          value={paste}
          onChange={(ev) => setPaste(ev.target.value)}
          placeholder={'一次貼上整張收據，一行一項：\n品名, 單價, 數量, 歸誰\n（數量與歸誰可省略；用逗號或 Tab 分隔都行）'}
          rows={3}
        />
        <div className="led-split-paste-btns">
          <button className="btn" onClick={applyPaste} disabled={!paste.trim()}>貼上明細</button>
          <button className="btn" onClick={() => ed.addSplit(e.id)}>＋ 一項</button>
        </div>
      </div>

      <div className="led-purchase-cols">
        <div>
          <div className="led-block-head"><h3>發票 · 收據{receipts.length > 0 && `（${receipts.length} 張）`}</h3></div>
          <div className="led-receipts">
            {receipts.map((k) => (
              <div key={k} className="led-receipt">
                <a href={assetUrl(k)} target="_blank" rel="noreferrer"><img src={assetUrl(k)} alt="發票" /></a>
                <button
                  className="led-receipt-del"
                  title="從這攤移除"
                  onClick={() => { if (window.confirm('把這張發票從這筆代買移掉？')) ed.delReceipt(e.id, k); }}
                >×</button>
              </div>
            ))}
            <button className="led-receipt-add" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? '上傳中…' : '＋ 加照片'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(ev) => void addReceipts(ev.target.files)} />
          </div>
          <div className="led-muted">收據太長可以分好幾張拍，一次選起來一起上傳。</div>
        </div>

        {purchase.others.length > 0 && (
          <div>
            <div className="led-block-head"><h3>收款</h3></div>
            <div className="led-settles">
              {purchase.others.map((s) => (
                <label key={s.person} className="led-settle-row">
                  <input
                    type="checkbox"
                    className="led-check"
                    checked={s.settled}
                    onChange={() => ed.toggleSettledPerson(e.id, s.person)}
                  />
                  <span className="led-strong">{s.person}</span>
                  <span>{formatMoney(s.amount, cur)}</span>
                  <span className={s.settled ? 'led-ok' : 'led-muted'}>{s.settled ? '已收' : '還沒收'}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
