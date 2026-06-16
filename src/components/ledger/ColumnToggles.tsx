interface Col { key: string; label: string }

/** 欄位顯示控制：勾選＝隱藏該欄；另有「全部顯示 / 部分隱藏」快捷。 */
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
  const hiddenSet = new Set(hidden);
  return (
    <details className="led-cols-panel">
      <summary>{title}　<span className="led-muted">{hidden.length ? `隱藏 ${hidden.length} 欄` : '全顯示'}</span></summary>
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
    </details>
  );
}
