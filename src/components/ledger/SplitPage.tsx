import { useMemo, useState } from 'react';
import type { Ledger } from '../../types/ledger';
import { formatAmount, formatMoney, toTWD } from '../../utils/money';
import {
  SELF, allocate, knownPayees, lineTotal, parseSplitLines, payeeTotals, splitDiff, splitsSubtotal,
} from '../../utils/split';
import { formatMonthDay } from '../../utils/date';
import { useLedgerEdit } from './useLedgerEdit';
import { TextCell, NumCell, DeleteCell } from './EditableCells';

const PAYEE_LIST_ID = 'split-payee-options';

/** 幫別人買的東西：把一筆支出拆成一項項商品配給誰，最後算出每個人要付多少。 */
export default function SplitPage({ ledger }: { ledger: Ledger }) {
  const ed = useLedgerEdit();
  const fx = ledger.fxRate;
  const local = ledger.localCurrency;

  const totals = payeeTotals(ledger);
  const payees = knownPayees(ledger);
  const owed = totals.filter((t) => !t.isSelf && !t.settled).reduce((s, t) => s + t.twd, 0);
  const collected = totals.filter((t) => !t.isSelf && t.settled).reduce((s, t) => s + t.twd, 0);

  /** 可以拿來拆的支出：已經拆過的排前面，其餘照日期新到舊。 */
  const candidates = useMemo(
    () =>
      [...ledger.expenses].sort((a, b) => {
        const av = (a.splits?.length ?? 0) > 0 ? 1 : 0;
        const bv = (b.splits?.length ?? 0) > 0 ? 1 : 0;
        if (av !== bv) return bv - av;
        return (b.date ?? '').localeCompare(a.date ?? '');
      }),
    [ledger.expenses],
  );

  const [pickId, setPickId] = useState('');
  const current = ledger.expenses.find((e) => e.id === pickId) ?? null;
  const [paste, setPaste] = useState('');

  const splits = current?.splits ?? [];
  const subtotal = splitsSubtotal(splits);
  const diff = current ? splitDiff(current) : 0;
  const shares = current ? allocate(current) : [];

  function applyPaste() {
    if (!current) return;
    const lines = parseSplitLines(paste);
    if (lines.length === 0) {
      window.alert('這段文字裡沒有「品名, 金額」格式的行。每行請寫成：品名, 單價, 數量, 歸誰（後兩欄可省略）');
      return;
    }
    ed.addSplitLines(current.id, lines);
    setPaste('');
  }

  return (
    <div className="led-page-cols">
      {/* 每個人要付多少 */}
      <section className="led-block">
        <div className="led-block-head">
          <h3>每個人要付多少</h3>
          <span className="led-muted">
            還沒收 <b className="led-strong">{formatMoney(owed, 'TWD')}</b>
            {collected > 0 && <>　·　已收 {formatMoney(collected, 'TWD')}</>}
          </span>
        </div>
        {totals.length === 0 ? (
          <div className="led-empty-row led-pad">
            還沒有任何代買明細。在下面選一筆支出（例如藥妝店那筆），把商品一項項拆開配給誰，這裡就會自動算。
          </div>
        ) : (
          <div className="led-cards-grid led-payee-grid">
            {totals.map((t) => (
              <div key={t.name} className={`led-cardbox led-payee${t.settled ? ' settled' : ''}`}>
                <div className="led-cardbox-top">
                  <span className="led-strong">
                    {t.name}
                    {t.isSelf && <span className="led-muted">　（自己的，不用收）</span>}
                  </span>
                  {!t.isSelf && (
                    <label className="led-payee-settle" title="錢收到了就打勾">
                      <input
                        type="checkbox"
                        className="led-check"
                        checked={t.settled}
                        onChange={() => ed.toggleSettledPayee(t.name)}
                      />
                      已收款
                    </label>
                  )}
                </div>
                <div className="led-cardbox-amt">{formatMoney(t.twd, 'TWD')}</div>
                <div className="led-muted">
                  ≒ {formatMoney(fx ? t.twd / fx : 0, local)}　·　{t.items} 件
                </div>
                <ul className="led-payee-lines">
                  {t.entries.map(({ expense, share }) => (
                    <li key={expense.id}>
                      <span className="led-muted">
                        {expense.date ? formatMonthDay(expense.date) : '—'}　{expense.title || '（未命名）'}
                      </span>
                      <span>{formatMoney(share.amount, expense.currency)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 拆一筆支出 */}
      <section className="led-block">
        <div className="led-block-head">
          <h3>拆一筆支出</h3>
          <span className="led-muted">選一筆已經記在帳上的花費，把裡面的商品配給誰</span>
        </div>

        <div className="led-split-pick">
          <select className="led-cell led-cell-boxed led-cell-wide" value={pickId} onChange={(e) => setPickId(e.target.value)}>
            <option value="">選一筆支出…</option>
            {candidates.map((e) => (
              <option key={e.id} value={e.id}>
                {(e.date ? formatMonthDay(e.date) : '無日期') + '　' + (e.title || '（未命名）') + '　' + formatMoney(e.amount, e.currency) + ((e.splits?.length ?? 0) > 0 ? `　· 已拆 ${e.splits!.length} 項` : '')}
              </option>
            ))}
          </select>
          {current && (
            <button className="btn" onClick={() => ed.addSplit(current.id)}>＋ 一項</button>
          )}
          {current && splits.length > 0 && (
            <button
              className="btn"
              onClick={() => {
                if (window.confirm('清掉這筆的所有代買明細？（支出本身不會被刪）')) ed.clearSplits(current.id);
              }}
            >清空明細</button>
          )}
        </div>

        {!current ? (
          <div className="led-empty-row led-pad">上面選一筆，就能開始拆。</div>
        ) : (
          <>
            <datalist id={PAYEE_LIST_ID}>
              {payees.map((p) => <option key={p} value={p} />)}
            </datalist>

            <div className="led-tb-wrap">
            <table className="led-tb led-split-tb">
              <thead>
                <tr>
                  <th>品名</th>
                  <th className="num">單價</th>
                  <th className="num">數量</th>
                  <th className="num">小計</th>
                  <th>歸誰</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {splits.length === 0 && (
                  <tr><td colSpan={6} className="led-empty-row">還沒有明細。按「＋ 一項」手動加，或用下面的貼上框一次帶進來。</td></tr>
                )}
                {splits.map((s) => (
                  <tr key={s.id}>
                    <td><TextCell value={s.label} onChange={(v) => ed.patchSplit(current.id, s.id, { label: v })} placeholder="商品名稱" /></td>
                    <td className="num"><NumCell value={s.price} onChange={(v) => ed.patchSplit(current.id, s.id, { price: v })} /></td>
                    <td className="num"><NumCell value={s.qty} onChange={(v) => ed.patchSplit(current.id, s.id, { qty: v })} /></td>
                    <td className="num led-strong">{formatAmount(lineTotal(s))}</td>
                    <td>
                      <input
                        className="led-cell"
                        list={PAYEE_LIST_ID}
                        value={s.person ?? ''}
                        placeholder="自己"
                        onChange={(e) => ed.patchSplit(current.id, s.id, { person: e.target.value || undefined })}
                      />
                    </td>
                    <td><DeleteCell onClick={() => ed.delSplit(current.id, s.id)} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="led-strong">明細加總</td>
                  <td colSpan={2} />
                  <td className="num led-strong">{formatAmount(subtotal)}</td>
                  <td colSpan={2} className="led-muted">
                    這筆刷了 {formatMoney(current.amount, current.currency)}
                    {diff !== 0 && (
                      <>
                        　·　差額 <b className={diff > 0 ? 'led-over-text' : 'led-ok'}>{diff > 0 ? '+' : ''}{formatAmount(diff)}</b>
                        （按各人金額比例分攤）
                      </>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
            </div>

            {shares.length > 0 && (
              <div className="led-split-shares">
                {shares.map((s) => (
                  <span key={s.person} className="led-split-chip">
                    {s.person === SELF ? '自己' : s.person}
                    <b>{formatMoney(s.amount, current.currency)}</b>
                    <i className="led-muted">≒ {formatMoney(toTWD(s.amount, current.currency, fx), 'TWD')}</i>
                  </span>
                ))}
              </div>
            )}

            <div className="led-split-paste">
              <textarea
                className="led-cell led-split-textarea"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={'一次貼上整張收據，一行一項：\n品名, 單價, 數量, 歸誰\n（數量與歸誰可省略；用逗號或 Tab 分隔都行）'}
                rows={4}
              />
              <button className="btn" onClick={applyPaste} disabled={!paste.trim()}>貼上明細</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
