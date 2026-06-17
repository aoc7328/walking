import { useEffect, useRef, useState } from 'react';

interface Col { key: string; label: string }

/** 欄位顯示控制：勾選＝隱藏該欄；點面板外任一處自動關閉。 */
export default function ColumnToggles({
  tableId, title, columns, hidden, presetHidden, onToggle, onSet,
}: {
  tableId: string;
  title: string;
  columns: Col[];
  hidden: string[];
  presetHidden: string[];
  onToggle: (tableId: string, key: string) => void;
  onSet: (tableId: string, keys: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hiddenSet = new Set(hidden);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="led-cols-panel" ref={ref}>
      <button type="button" className={`led-cols-summary${open ? ' open' : ''}`} onClick={() => setOpen((o) => !o)}>
        {title}　<span className="led-muted">{hidden.length ? `隱藏 ${hidden.length} 欄` : '全顯示'}</span>
      </button>
      {open && (
        <div className="led-cols-body">
          <div className="led-cols-actions">
            <button className="led-export-btn" onClick={() => onSet(tableId, [])}>全部顯示</button>
            <button className="led-export-btn" onClick={() => onSet(tableId, presetHidden)}>部分隱藏</button>
            <span className="led-muted">（勾選＝隱藏該欄）</span>
          </div>
          <div className="led-cols-checks">
            {columns.filter((c) => c.label).map((c) => (
              <label key={c.key} className="led-col-check">
                <input type="checkbox" checked={hiddenSet.has(c.key)} onChange={() => onToggle(tableId, c.key)} />
                {c.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
