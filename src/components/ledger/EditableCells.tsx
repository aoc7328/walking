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
