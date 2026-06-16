import { useRef, type ReactNode } from 'react';

export interface LedgerColumn<R> {
  key: string;
  label: string;
  num?: boolean;
  width?: number;
  render: (row: R) => ReactNode;
  sortable?: boolean;
  sortValue?: (row: R) => string | number;
  /** 表尾小計儲存格內容（有任一欄給 foot 或有 footerLabel 才顯示表尾）。 */
  foot?: ReactNode;
}

export interface SortState { key: string; dir: 'asc' | 'desc' }

interface Props<R> {
  tableId: string;
  columns: LedgerColumn<R>[];
  rows: R[];
  rowKey: (r: R) => string;
  hidden?: string[];
  widths?: Record<string, number>;
  onResize?: (key: string, width: number) => void;
  sort?: SortState | null;
  onSort?: (key: string) => void;
  footerLabel?: string;
  emptyText?: string;
}

/** 可拖寬、可隱藏欄、可排序的編輯表格。欄寬變更透過 onResize 寫回（按儲存才上雲端）。 */
export default function LedgerTable<R>(props: Props<R>) {
  const { columns, rows, rowKey, hidden = [], widths = {}, onResize, sort, onSort, footerLabel, emptyText } = props;
  const colRefs = useRef<Record<string, HTMLTableColElement | null>>({});

  const hiddenSet = new Set(hidden);
  const cols = columns.filter((c) => !hiddenSet.has(c.key));
  const widthOf = (c: LedgerColumn<R>) => widths[c.key] ?? c.width ?? 120;

  let display = rows;
  if (sort) {
    const col = columns.find((c) => c.key === sort.key);
    if (col?.sortValue) {
      const sv = col.sortValue;
      display = [...rows].sort((a, b) => {
        const x = sv(a), y = sv(b);
        const r = x < y ? -1 : x > y ? 1 : 0;
        return sort.dir === 'asc' ? r : -r;
      });
    }
  }

  function startResize(e: React.MouseEvent, c: LedgerColumn<R>) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = widthOf(c);
    const colEl = colRefs.current[c.key];
    const calc = (ev: MouseEvent) => Math.max(48, startW + (ev.clientX - startX));
    // 拖曳期間直接改 <col> 寬度（不觸發 React 重繪），避免大表(餐廳 14 列)每像素重繪整張表而卡死
    const move = (ev: MouseEvent) => { if (colEl) colEl.style.width = `${calc(ev)}px`; };
    const up = (ev: MouseEvent) => {
      onResize?.(c.key, Math.round(calc(ev)));
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  const hasFooter = footerLabel !== undefined || columns.some((c) => c.foot !== undefined);

  return (
    <div className="led-tb-wrap">
      <table className="led-tb led-tb-fixed">
        <colgroup>
          {cols.map((c) => <col key={c.key} ref={(el) => { colRefs.current[c.key] = el; }} style={{ width: widthOf(c) }} />)}
        </colgroup>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} className={c.num ? 'num' : ''}>
                <span
                  className={c.sortable && onSort ? 'led-th-sort' : undefined}
                  onClick={c.sortable && onSort ? () => onSort(c.key) : undefined}
                >
                  {c.label}
                  {c.sortable && sort?.key === c.key ? <span className="led-sort-ind">{sort.dir === 'asc' ? ' ▲' : ' ▼'}</span> : null}
                </span>
                <span className="led-col-resizer" onMouseDown={(e) => startResize(e, c)} title="拖曳調整欄寬" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {display.length === 0 ? (
            <tr><td colSpan={cols.length} className="led-empty-row">{emptyText ?? '尚無資料'}</td></tr>
          ) : display.map((r) => (
            <tr key={rowKey(r)}>
              {cols.map((c) => <td key={c.key} className={c.num ? 'num' : ''}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
        {hasFooter && (
          <tfoot>
            <tr>
              {cols.map((c, i) => (
                <td key={c.key} className={c.num ? 'num' : ''}>{i === 0 ? (footerLabel ?? c.foot) : c.foot}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
