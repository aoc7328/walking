import { useEffect } from 'react';
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
import type { TodoItem } from '../../types/trip';
import { useUIStore } from '../../stores/uiStore';
import { useTripStore } from '../../stores/tripStore';

function TodoRow({ todo }: { todo: TodoItem }) {
  const patchTodo = useTripStore((s) => s.patchTodo);
  const removeTodo = useTripStore((s) => s.removeTodo);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: todo.id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={`todo-row${todo.done ? ' done' : ''}${isDragging ? ' dragging' : ''}`}>
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="todo-drag"
        {...attributes}
        {...listeners}
        title="按住拖曳調整順序"
        aria-label="拖曳排序"
      >
        <svg viewBox="0 0 10 16" width="10" height="16" fill="currentColor" aria-hidden>
          <circle cx="2.5" cy="2" r="1.2" /><circle cx="7.5" cy="2" r="1.2" />
          <circle cx="2.5" cy="8" r="1.2" /><circle cx="7.5" cy="8" r="1.2" />
          <circle cx="2.5" cy="14" r="1.2" /><circle cx="7.5" cy="14" r="1.2" />
        </svg>
      </button>
      <input
        type="checkbox"
        className="todo-check"
        checked={todo.done}
        onChange={(e) => patchTodo(todo.id, { done: e.target.checked })}
        title={todo.done ? '標記為未完成' : '標記為完成'}
      />
      <input
        className="todo-text"
        value={todo.text}
        onChange={(e) => patchTodo(todo.id, { text: e.target.value })}
        placeholder="待辦項目…例：eSIM 還沒買"
      />
      <input
        className="todo-note"
        value={todo.note ?? ''}
        onChange={(e) => patchTodo(todo.id, { note: e.target.value })}
        placeholder="備註…"
      />
      <button className="todo-del" onClick={() => removeTodo(todo.id)} title="刪除這項" aria-label="刪除">×</button>
    </div>
  );
}

/** 「筆記」彈窗：出發前待辦清單（私人，不分享/不下載）。 */
export default function NotesModal() {
  const open = useUIStore((s) => s.notesModalOpen);
  const close = useUIStore((s) => s.closeNotesModal);
  const todos = useTripStore((s) => s.trip?.todos ?? []);
  const addTodo = useTripStore((s) => s.addTodo);
  const reorderTodos = useTripStore((s) => s.reorderTodos);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  const doneCount = todos.filter((t) => t.done).length;

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    reorderTodos(String(active.id), String(over.id));
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal notes-modal">
        <div className="notes-modal-body">
          <div className="notes-modal-head">
            <h2 className="modal-title">筆記 · 待辦</h2>
            <span className="notes-modal-sub">
              出發前提醒自己的事（私人，不會分享也不會匯出）
              {todos.length > 0 ? `　·　${doneCount}/${todos.length} 完成` : ''}
            </span>
          </div>

          <div className="notes-list thin-scroll">
            {todos.length === 0 ? (
              <div className="notes-empty">還沒有待辦。按下方「＋ 新增一項」開始，例如「機場接送還沒叫」。</div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {todos.map((t) => <TodoRow key={t.id} todo={t} />)}
                </SortableContext>
              </DndContext>
            )}
          </div>

          <button className="notes-add-btn" onClick={addTodo}>＋ 新增一項</button>

          <div className="modal-actions">
            <button className="btn" onClick={close}>關閉</button>
          </div>
        </div>
      </div>
    </div>
  );
}
