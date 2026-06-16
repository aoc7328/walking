interface TextProps { value: string | undefined; onChange: (v: string) => void; placeholder?: string }

export function TextCell({ value, onChange, placeholder }: TextProps) {
  return (
    <input
      className="led-cell"
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

interface NumProps { value: number | undefined; onChange: (v: number) => void; placeholder?: string }

export function NumCell({ value, onChange, placeholder }: NumProps) {
  return (
    <input
      className="led-cell num"
      type="number"
      value={value === undefined || Number.isNaN(value) ? '' : value}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === '' ? 0 : Number(v));
      }}
    />
  );
}

export function DateCell({ value, onChange }: { value: string | undefined; onChange: (v: string) => void }) {
  return (
    <input
      className="led-cell"
      type="date"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function TimeCell({ value, onChange }: { value: string | undefined; onChange: (v: string) => void }) {
  return (
    <input
      className="led-cell"
      type="time"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

interface SelectProps<T extends string> { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }

export function SelectCell<T extends string>({ value, onChange, options }: SelectProps<T>) {
  return (
    <select className="led-cell" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function CheckCell({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return <input className="led-check" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />;
}

export function DeleteCell({ onClick }: { onClick: () => void }) {
  return (
    <button className="led-row-del" onClick={onClick} title="刪除這一列" aria-label="刪除">×</button>
  );
}

/** 單格金額輸入（台幣或當地其中一格）；打進去就把整筆的金額+幣別設成這格的幣別。 */
export function MoneyInput({
  kind, amount, currency, localCurrency, fxRate, onChange,
}: {
  kind: 'twd' | 'local';
  amount: number | undefined;
  currency: string;
  localCurrency: string;
  fxRate: number;
  onChange: (amount: number, currency: string) => void;
}) {
  const has = amount !== undefined && amount !== null && !Number.isNaN(amount);
  let val: number | '' = '';
  if (has) {
    if (kind === 'twd') val = currency === 'TWD' ? amount! : Math.round(amount! * fxRate);
    else val = currency === localCurrency ? amount! : fxRate ? Math.round(amount! / fxRate) : '';
  }
  return (
    <input
      className="led-cell num"
      type="number"
      value={val}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value), kind === 'twd' ? 'TWD' : localCurrency)}
    />
  );
}

/**
 * 金額雙欄：台幣 + 當地幣並排，打哪一欄、另一欄自動換算。
 * 儲存的是「使用者輸入的值 + 幣別」（避免換算來回的捨入誤差）。
 * 回傳兩個 <td>，放在 <tr> 裡。
 */
export function MoneyCells({
  amount, currency, localCurrency, fxRate, onChange,
}: {
  amount: number | undefined;
  currency: string;
  localCurrency: string;
  fxRate: number;
  onChange: (amount: number, currency: string) => void;
}) {
  const has = amount !== undefined && amount !== null && !Number.isNaN(amount);
  const twd = !has ? '' : currency === 'TWD' ? amount! : Math.round(amount! * fxRate);
  const loc = !has ? '' : currency === localCurrency ? amount! : fxRate ? Math.round(amount! / fxRate) : '';
  const parse = (v: string) => (v === '' ? 0 : Number(v));
  return (
    <>
      <td className="num">
        <input className="led-cell num" type="number" value={twd} onChange={(e) => onChange(parse(e.target.value), 'TWD')} />
      </td>
      <td className="num">
        <input className="led-cell num" type="number" value={loc} onChange={(e) => onChange(parse(e.target.value), localCurrency)} />
      </td>
    </>
  );
}
