import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Expense, ExpenseSplit, Ledger } from '../../types/ledger';
import { SELF, knownPayees, lineTotal, parseSplitLines, purchaseOf, splitDiff, splitsSubtotal } from '../../utils/split';
import { formatMoney } from '../../utils/money';
import { uuid } from '../../utils/format';
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

interface Props {
  expense: Expense;
  ledger: Ledger;
  tripId: string;
  busy: boolean;
  /** 把整本帳改掉並寫回雲端；回傳有沒有成功。 */
  mutate: (fn: (l: Ledger) => Ledger, okMsg: string) => Promise<boolean>;
  onToast: (msg: string) => void;
  onClose: () => void;
}

/**
 * 一筆代買自己的處理視窗：明細配人、發票照片、跟誰收到錢了，全在這一攤裡面。
 *
 * 一次代買常常十幾項，站著用手機打品名不可能，所以設計是
 * 「明細先進得來、然後只用點的」：點一列展開人名按鈕，點一下就指定完。
 */
export default function MobileSplitSheet({ expense, ledger, tripId, busy, mutate, onToast, onClose }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const splits = expense.splits ?? [];
  const receipts = expense.receiptKeys ?? [];
  const p = purchaseOf(expense);
  const names = knownPayees(ledger);
  const cur = expense.currency;
  const diff = splitDiff(expense);

  /** 這一攤的任何改動，都是改這筆支出。 */
  const patchExpense = (fn: (e: Expense) => Expense, msg: string) =>
    void mutate((l) => ({ ...l, expenses: l.expenses.map((e) => (e.id === expense.id ? fn(e) : e)) }), msg);

  const patchSplits = (fn: (list: ExpenseSplit[]) => ExpenseSplit[], msg: string) =>
    patchExpense((e) => ({ ...e, splits: fn(e.splits ?? []) }), msg);

  const setPerson = (id: string, person: string | undefined) => {
    setExpanded(null);
    patchSplits((list) => list.map((s) => (s.id === id ? { ...s, person } : s)), person ? `已指定給 ${person}` : '已改成自己的');
  };

  const setQty = (id: string, qty: number) =>
    patchSplits((list) => list.map((s) => (s.id === id ? { ...s, qty: Math.max(1, Number.isFinite(qty) ? qty : 1) } : s)), '已改數量');

  /**
   * 同一項要分給兩個人：從原本那列「分」一件出來成為新的一列，
   * 兩列數量加起來不變（10 → 9 + 1，再自己調成 6 + 4）。
   *
   * 不能用「複製一列」做——那會讓總件數多一件、明細加總超過刷卡金額，
   * 差額一被攤下去，連沒動到的人金額都會跟著跳。
   */
  const splitOff = (s: ExpenseSplit) =>
    patchSplits((list) => {
      const i = list.findIndex((x) => x.id === s.id);
      if (i < 0 || !(s.qty > 1)) return list;
      const next = [...list];
      next[i] = { ...s, qty: s.qty - 1 };
      next.splice(i + 1, 0, { ...s, id: uuid(), qty: 1, person: undefined });
      return next;
    }, '已拆成兩列，數量各自調');

  const remove = (id: string) => patchSplits((list) => list.filter((s) => s.id !== id), '已刪除這項');

  const addBlank = () => {
    const label = window.prompt('品名？');
    if (label === null) return;
    const price = Number(window.prompt('單價（' + cur + '）？', '0') ?? '');
    patchSplits(
      (list) => [...list, { id: uuid(), label: label.trim(), price: Number.isFinite(price) ? price : 0, qty: 1 }],
      '已加一項',
    );
  };

  const addNewName = (id: string) => {
    const name = window.prompt('這項是幫誰買的？');
    if (!name || !name.trim()) return;
    setPerson(id, name.trim());
  };

  const applyPaste = () => {
    const lines = parseSplitLines(paste);
    if (lines.length === 0) {
      window.alert('每行請寫成：品名, 單價, 數量（數量可省略）');
      return;
    }
    setPaste('');
    setShowPaste(false);
    patchSplits((list) => [...list, ...lines.map((x) => ({ id: uuid(), ...x }))], `已帶進 ${lines.length} 項`);
  };

  const toggleSettled = (name: string) =>
    patchExpense((e) => {
      const cur2 = e.settledPersons ?? [];
      return { ...e, settledPersons: cur2.includes(name) ? cur2.filter((n) => n !== name) : [...cur2, name] };
    }, '已更新收款狀態');

  /** 發票照片：一次可以選好幾張（長長一條的收據要分開拍）。 */
  async function addReceipts(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const keys: string[] = [];
      for (const f of Array.from(files)) {
        keys.push(await uploadAsset(await receiptBlob(f), tripId));
      }
      patchExpense((e) => ({ ...e, receiptKeys: [...(e.receiptKeys ?? []), ...keys] }), `已加 ${keys.length} 張發票`);
    } catch (err) {
      onToast('發票上傳失敗：' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const removeReceipt = (key: string) => {
    if (!window.confirm('把這張發票從這筆代買移掉？')) return;
    patchExpense((e) => ({ ...e, receiptKeys: (e.receiptKeys ?? []).filter((k) => k !== key) }), '已移除一張發票');
  };

  return createPortal(
    <div className="mv-sheet-backdrop" onClick={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}>
      <div className="mv-sheet">
        <div className="mv-sheet-head">
          <span>拆帳　·　{expense.title || '（未命名）'}</span>
          <button className="mv-sheet-close" onClick={onClose} aria-label="關閉">×</button>
        </div>

        <div className="mv-sheet-body">
          <div className="mv-split-total">
            這筆刷了 <b>{formatMoney(expense.amount, cur)}</b>
            {'　·　'}自己 <b>{formatMoney(p.self, cur)}</b>
            {p.others.length > 0 && <>{'　·　'}要收回 <b>{formatMoney(p.outstanding, cur)}</b></>}
          </div>

          {p.shares.length > 0 && (
            <div className="mv-split-sum">
              {p.shares.map((s) => (
                <span key={s.person} className={`mv-split-chip${s.settled ? ' done' : ''}`}>
                  {s.person}<b>{formatMoney(s.amount, cur)}</b>{s.settled ? ' ✓' : ''}
                </span>
              ))}
            </div>
          )}

          {/* 明細跟刷卡金額對不上時一定要講出來：差額會按比例攤進每個人的金額，
              沒看到這行的話，只會覺得別人的錢莫名其妙變來變去。 */}
          {splits.length > 0 && diff !== 0 && (
            <div className="mv-split-warn">
              明細加總比刷卡金額{diff < 0 ? '多' : '少'} {formatMoney(Math.abs(diff), cur)}
              ，差額已按比例攤進每個人的金額。數量還沒調完的話先調完。
            </div>
          )}

          {splits.length === 0 ? (
            <p className="mv-empty">
              這筆還沒有明細。
              <br />
              用下面的「貼上收據」一次帶進來，或一項一項加。
            </p>
          ) : (
            <div className="mv-split-list">
              {splits.map((s) => {
                const open = expanded === s.id;
                const who = (s.person ?? '').trim();
                return (
                  <div key={s.id} className={`mv-split-row${open ? ' open' : ''}`}>
                    <button
                      type="button"
                      className="mv-split-head"
                      aria-expanded={open}
                      onClick={() => setExpanded(open ? null : s.id)}
                    >
                      <span className="mv-split-name">
                        {s.label || '（未命名）'}
                        {s.qty > 1 && <span className="mv-muted">　×{s.qty}</span>}
                      </span>
                      <span className="mv-split-amt">{formatMoney(lineTotal(s), cur)}</span>
                      <span className={`mv-split-who${who ? ' assigned' : ''}`}>{who || SELF}</span>
                    </button>

                    {open && (
                      <div className="mv-split-edit">
                        <div className="mv-cat-row">
                          <button className={`mv-cat${!who ? ' active' : ''}`} onClick={() => setPerson(s.id, undefined)}>
                            {SELF}
                          </button>
                          {names.map((n) => (
                            <button key={n} className={`mv-cat${who === n ? ' active' : ''}`} onClick={() => setPerson(s.id, n)}>
                              {n}
                            </button>
                          ))}
                          <button className="mv-cat" onClick={() => addNewName(s.id)}>＋ 新名字</button>
                        </div>

                        <div className="mv-split-tools">
                          <span className="mv-muted">數量</span>
                          <button className="mv-btn mv-btn-small" onClick={() => setQty(s.id, s.qty - 1)} disabled={busy || s.qty <= 1}>−</button>
                          <b>{s.qty}</b>
                          <button className="mv-btn mv-btn-small" onClick={() => setQty(s.id, s.qty + 1)} disabled={busy}>＋</button>
                          <button
                            className="mv-btn mv-btn-small"
                            onClick={() => splitOff(s)}
                            disabled={busy || !(s.qty > 1)}
                            title={s.qty > 1 ? '分一件出來成為新的一列，配給別人' : '只有一件，沒得拆'}
                          >拆成兩列</button>
                          <button className="mv-btn mv-btn-small mv-btn-danger" onClick={() => remove(s.id)} disabled={busy}>刪除</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="mv-split-foot-note">
                <span className="mv-muted">明細加總 {formatMoney(splitsSubtotal(splits), cur)}</span>
              </div>
            </div>
          )}

          {showPaste ? (
            <>
              <textarea
                className="mv-input"
                rows={5}
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={'一行一項：\n品名, 單價, 數量'}
              />
              <button className="mv-submit" onClick={applyPaste} disabled={busy || !paste.trim()}>帶進明細</button>
            </>
          ) : (
            <div className="mv-split-tools mv-split-add">
              <button className="mv-btn" onClick={addBlank} disabled={busy}>＋ 加一項</button>
              <button className="mv-btn" onClick={() => setShowPaste(true)} disabled={busy}>貼上收據</button>
            </div>
          )}

          {/* 發票照片 */}
          <div className="mv-split-block-head">發票 · 收據{receipts.length > 0 && `（${receipts.length} 張）`}</div>
          <div className="mv-receipts">
            {receipts.map((k) => (
              <div key={k} className="mv-receipt">
                <img src={assetUrl(k)} alt="發票" onClick={() => setViewing(k)} />
                <button className="mv-receipt-del" onClick={() => removeReceipt(k)} aria-label="移除這張">×</button>
              </div>
            ))}
            <button className="mv-receipt-add" onClick={() => fileRef.current?.click()} disabled={busy || uploading}>
              {uploading ? '上傳中…' : '＋ 加照片'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => void addReceipts(e.target.files)}
            />
          </div>
          <div className="mv-split-foot-note">
            <span className="mv-muted">收據太長可以分好幾張拍，一次選起來一起加。</span>
          </div>

          {/* 收款 */}
          {p.others.length > 0 && (
            <>
              <div className="mv-split-block-head">收款</div>
              {p.others.map((s) => (
                <label key={s.person} className="mv-settle-row">
                  <input
                    type="checkbox"
                    checked={s.settled}
                    disabled={busy}
                    onChange={() => toggleSettled(s.person)}
                  />
                  <span className="mv-settle-name">{s.person}</span>
                  <span className="mv-settle-amt">{formatMoney(s.amount, cur)}</span>
                  <span className={s.settled ? 'mv-under' : 'mv-muted'}>{s.settled ? '已收' : '還沒收'}</span>
                </label>
              ))}
            </>
          )}
        </div>

        <div className="mv-sheet-foot">
          <button className="mv-submit" onClick={onClose} disabled={busy}>{busy ? '儲存中…' : '完成'}</button>
        </div>
      </div>

      {viewing && (
        <div className="mv-receipt-view" onClick={() => setViewing(null)}>
          <img src={assetUrl(viewing)} alt="發票" />
        </div>
      )}
    </div>,
    document.body,
  );
}
