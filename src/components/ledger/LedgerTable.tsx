import { useRef, type CSSProperties, type ReactNode } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  /** 開啟「拖曳整列改排序」：多一欄拖曳把手；排序中（sort）時自動停用。 */
  draggable?: boolean;
  onReorder?: (activeId: string, overId: string) => void;
}

function DragHandleSvg() {
  return (
    <svg viewBox="0 0 10 16" width="10" height="16" fill="currentColor" aria-hidden>
      <circle cx="2.5" cy="2" r="1.2" /><circle cx="7.5" cy="2" r="1.2" />
      <circle cx="2.5" cy="8" r="1.2" /><circle cx="7.5" cy="8" r="1.2" />
      <circle cx="2.5" cy="14" r="1.2" /><circle cx="7.5" cy="14" r="1.2" />
    </svg>
  );
}

/** 可拖曳排序的一列（前置一格拖曳把手 + 各資料欄）。 */
function SortableRow<R>({ id, cols, row }: { id: string; cols: LedgerColumn<R>[]; row: R }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };
  return (
    <tr ref={setNodeRef} style={style} className={isDragging ? 'led-tr-dragging' : undefined}>
      <td className="led-drag-cell">
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="led-row-drag"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          title="按住拖曳調整排序"
          aria-label="拖曳排序"
        >
          <DragHandleSvg />
        </button>
      </td>
      {cols.map((c) => <td key={c.key} className={c.num ? 'num' : ''}>{c.render(row)}</td>)}
    </tr>
  );
}

/** 可拖寬、可隱藏欄、可排序、可拖曳整列改順序的編輯表格。欄寬變更透過 onResize 寫回（按儲存才上雲端）。 */
export default function LedgerTable<R>(props: Props<R>) {
  const { columns, rows, rowKey, hidden = [], widths = {}, onResize, sort, onSort, footerLabel, emptyText, draggable, onReorder } = props;
  const colRefs = useRef<Record<string, HTMLTableColElement | null>>({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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

  // 拖曳排序只有在「開啟 draggable 且沒有套欄位排序」時才成立（排序中的顯示順序≠陣列順序）。
  const dnd = !!draggable && !sort;

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

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    onReorder?.(String(active.id), String(over.id));
  }

  const hasFooter = footerLabel !== undefined || columns.some((c) => c.foot !== undefined);

  const table = (
    <table className="led-tb led-tb-fixed">
      <colgroup>
        {dnd && <col style={{ width: 30 }} />}
        {cols.map((c) => <col key={c.key} ref={(el) => { colRefs.current[c.key] = el; }} style={{ width: widthOf(c) }} />)}
      </colgroup>
      <thead>
        <tr>
          {dnd && <th className="led-drag-th" aria-hidden />}
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
          <tr><td colSpan={cols.length + (dnd ? 1 : 0)} className="led-empty-row">{emptyText ?? '尚無資料'}</td></tr>
        ) : dnd ? (
          <SortableContext items={display.map((r) => rowKey(r))} strategy={verticalListSortingStrategy}>
            {display.map((r) => <SortableRow key={rowKey(r)} id={rowKey(r)} cols={cols} row={r} />)}
          </SortableContext>
        ) : (
          display.map((r) => (
            <tr key={rowKey(r)}>
              {cols.map((c) => <td key={c.key} className={c.num ? 'num' : ''}>{c.render(r)}</td>)}
            </tr>
          ))
        )}
      </tbody>
      {hasFooter && (
        <tfoot>
          <tr>
            {dnd && <td className="led-drag-cell" aria-hidden />}
            {cols.map((c, i) => (
              <td key={c.key} className={c.num ? 'num' : ''}>{i === 0 ? (footerLabel ?? c.foot) : c.foot}</td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );

  return (
    <div className="led-tb-wrap">
      {dnd ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {table}
        </DndContext>
      ) : table}
    </div>
  );
}
