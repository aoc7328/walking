import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { Expense, ExpenseSplit, Ledger } from '../../types/ledger';
import { SELF, allocate, knownPayees, lineTotal, parseSplitLines, splitDiff, splitsSubtotal } from '../../utils/split';
import { formatMoney } from '../../utils/money';
import { uuid } from '../../utils/format';

interface Props {
  expense: Expense;
  ledger: Ledger;
  busy: boolean;
  /** 把整本帳改掉並寫回雲端；回傳有沒有成功。 */
  mutate: (fn: (l: Ledger) => Ledger, okMsg: string) => Promise<boolean>;
  onClose: () => void;
}

/**
 * 手機版「這筆是幫誰買的」。
 *
 * 一次代買常常十幾項，站著用手機打品名不可能，所以這裡的設計是
 * 「明細先進得來、然後只用點的」：點一列展開人名按鈕，點一下就指定完。
 * 人名按鈕是這本帳出現過的名字，第一次用才要打字。
 */
export default function MobileSplitSheet({ expense, ledger, busy, mutate, onClose }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(false);

  const splits = expense.splits ?? [];
  const shares = allocate(expense);
  const names = knownPayees(ledger);
  const cur = expense.currency;
  const diff = splitDiff(expense);

  /** 所有改動都是「改這筆支出的 splits」。 */
  const patchSplits = (fn: (list: ExpenseSplit[]) => ExpenseSplit[], msg: string) =>
    void mutate(
      (l) => ({
        ...l,
        expenses: l.expenses.map((e) => (e.id === expense.id ? { ...e, splits: fn(e.splits ?? []) } : e)),
      }),
      msg,
    );

  const setPerson = (id: string, person: string | undefined) => {
    setExpanded(null);
    patchSplits((list) => list.map((s) => (s.id === id ? { ...s, person } : s)), person ? `已指定給 ${person}` : '已改成自己的');
  };

  const setQty = (id: string, qty: number) =>
    patchSplits((list) => list.map((s) => (s.id === id ? { ...s, qty: Math.max(1, Number.isFinite(qty) ? qty : 1) } : s)), '已改數量');

  /** 同一項要分給兩個人：複製成另一列，兩邊各自改數量。 */
  const duplicate = (s: ExpenseSplit) =>
    patchSplits((list) => {
      const i = list.findIndex((x) => x.id === s.id);
      if (i < 0) return list;
      const copy: ExpenseSplit = { ...s, id: uuid(), qty: 1, person: undefined };
      const next = [...list];
      next.splice(i + 1, 0, copy);
      return next;
    }, '已複製一列，兩邊各自改數量');

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

  return createPortal(
    <div className="mv-sheet-backdrop" onClick={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}>
      <div className="mv-sheet">
        <div className="mv-sheet-head">
          <span>拆給誰　·　{expense.title || '（未命名）'}</span>
          <button className="mv-sheet-close" onClick={onClose} aria-label="關閉">×</button>
        </div>

        <div className="mv-sheet-body">
          {shares.length > 0 && (
            <div className="mv-split-sum">
              {shares.map((s) => (
                <span key={s.person} className="mv-split-chip">
                  {s.person}<b>{formatMoney(s.amount, cur)}</b>
                </span>
              ))}
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
                          <button className="mv-btn mv-btn-small" onClick={() => duplicate(s)} disabled={busy}>拆成兩列</button>
                          <button className="mv-btn mv-btn-small mv-btn-danger" onClick={() => remove(s.id)} disabled={busy}>刪除</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="mv-split-foot-note">
                <span className="mv-muted">
                  明細加總 {formatMoney(splitsSubtotal(splits), cur)}　·　這筆刷了 {formatMoney(expense.amount, cur)}
                  {diff !== 0 && <>　·　差額 {formatMoney(diff, cur)} 已按比例攤進各人金額</>}
                </span>
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
        </div>

        <div className="mv-sheet-foot">
          <button className="mv-submit" onClick={onClose} disabled={busy}>{busy ? '儲存中…' : '完成'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
