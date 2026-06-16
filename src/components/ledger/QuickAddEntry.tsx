import { useState } from 'react';
import type { Ledger, ExpenseCategory } from '../../types/ledger';
import { categoriesOf } from '../../utils/ledger';
import { toISODate } from '../../utils/date';

interface NewEntry { date: string; category: ExpenseCategory; title: string; amount: number; currency: string; paymentMethodId?: string }

/** 流水帳上方常駐的快速新增列：填完按「送出」就加一筆，欄位留著繼續記下一筆。 */
export default function QuickAddEntry({ ledger, onAdd }: { ledger: Ledger; onAdd: (d: NewEntry) => void }) {
  const local = ledger.localCurrency;
  const cats = categoriesOf(ledger);
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [category, setCategory] = useState<string>(cats.includes('飲食') ? '飲食' : cats[0] ?? '其他');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(local);
  const [pay, setPay] = useState('');

  function submit() {
    const amt = amount === '' ? 0 : Number(amount);
    if (!title.trim() && !amt) return;
    onAdd({ date, category, title: title.trim(), amount: amt, currency, paymentMethodId: pay || undefined });
    setTitle('');
    setAmount('');
  }
  const onEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') submit(); };

  return (
    <div className="led-quickadd">
      <span className="led-muted">新增一筆：</span>
      <input className="led-cell led-cell-boxed" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <select className="led-cell led-cell-boxed" value={category} onChange={(e) => setCategory(e.target.value)}>
        {cats.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input className="led-cell led-cell-boxed led-qa-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="買了什麼" onKeyDown={onEnter} />
      <input className="led-cell led-cell-boxed num" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="金額" onKeyDown={onEnter} />
      <select className="led-cell led-cell-boxed" value={currency} onChange={(e) => setCurrency(e.target.value)}>
        {local !== 'TWD' && <option value={local}>{local}</option>}
        <option value="TWD">TWD</option>
      </select>
      <select className="led-cell led-cell-boxed" value={pay} onChange={(e) => setPay(e.target.value)}>
        <option value="">支付…</option>
        {ledger.paymentMethods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <button className="led-add-btn led-add-primary" style={{ marginTop: 0 }} onClick={submit}>送出</button>
    </div>
  );
}
