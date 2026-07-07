import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTripStore } from '../../stores/tripStore';
import type { NoteCard } from '../../types/trip';
import { formatWithWeekday } from '../../utils/date';
import PlaceIconBadge from '../common/PlaceIconBadge';
import IconPicker from '../common/IconPicker';

/**
 * 小卡片：無時間、無地點的隨手備忘。
 * 只有圖示（可選）＋ 一段自由文字，文字方塊高度隨內容自動長高、完整顯示。
 * 可拖曳排序、可複製到其他天、可刪除——跟行程卡一致。
 * 不進路線/地圖/時間鏈——資料存在 DayPlan.cards，跟 items 完全分開。
 */
export default function NoteCardItem({ card, dayId }: { card: NoteCard; dayId: string }) {
  const updateNoteCard = useTripStore((s) => s.updateNoteCard);
  const removeNoteCard = useTripStore((s) => s.removeNoteCard);
  const copyNoteCardToDay = useTripStore((s) => s.copyNoteCardToDay);
  const trip = useTripStore((s) => s.trip);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition };

  // 文字方塊自動長高：高度跟著內容走，完整顯示、不出現內部捲軸。
  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [card.text]);

  useEffect(() => {
    if (!copyOpen) return;
    function onDown(e: MouseEvent) {
      if (copyRef.current && !copyRef.current.contains(e.target as Node)) setCopyOpen(false);
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [copyOpen]);

  function handleDelete() {
    if (card.text.trim() && !window.confirm('刪除這張小卡片？此操作無法復原。')) return;
    removeNoteCard(dayId, card.id);
  }

  return (
    <div ref={setNodeRef} style={style} className={`note-card${isDragging ? ' dragging' : ''}`}>
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="note-card-drag"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        title="按住拖曳調整順序"
        aria-label="拖曳"
      >
        <svg viewBox="0 0 10 16" width="10" height="16" fill="currentColor" aria-hidden>
          <circle cx="2.5" cy="2" r="1.2" />
          <circle cx="7.5" cy="2" r="1.2" />
          <circle cx="2.5" cy="8" r="1.2" />
          <circle cx="7.5" cy="8" r="1.2" />
          <circle cx="2.5" cy="14" r="1.2" />
          <circle cx="7.5" cy="14" r="1.2" />
        </svg>
      </button>

      <PlaceIconBadge iconEmoji={card.iconEmoji} onClick={() => setIconPickerOpen(true)} />

      <textarea
        ref={taRef}
        className="note-card-text"
        value={card.text}
        onChange={(e) => updateNoteCard(dayId, card.id, { text: e.target.value })}
        placeholder="隨手寫點什麼…想去哪再說"
        rows={1}
      />

      <div className="note-card-actions">
        <div className="item-copy-wrap" ref={copyRef}>
          <button
            className="item-icon-btn"
            onClick={(e) => { e.stopPropagation(); setCopyOpen((o) => !o); }}
            title="複製到其他天"
            aria-label="複製小卡片"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          {copyOpen && trip && (
            <div className="item-copy-menu">
              <div className="item-copy-menu-label">複製到</div>
              {trip.days.map((d) => (
                <button
                  key={d.id}
                  className={`item-copy-menu-item${d.id === dayId ? ' current' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    copyNoteCardToDay(dayId, card.id, d.id);
                    setCopyOpen(false);
                  }}
                >
                  <span className="item-copy-menu-day">Day {d.dayIndex}</span>
                  <span className="item-copy-menu-date">{formatWithWeekday(d.date)}</span>
                  {d.id === dayId && <span className="item-copy-menu-today">今日</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          className="item-icon-btn item-icon-btn-danger"
          onClick={handleDelete}
          title="刪除小卡片"
          aria-label="刪除小卡片"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
            <path d="M10 11v6M14 11v6"></path>
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>

      <IconPicker
        open={iconPickerOpen}
        currentEmoji={card.iconEmoji}
        onSelect={(emoji) => updateNoteCard(dayId, card.id, { iconEmoji: emoji ?? undefined })}
        onClose={() => setIconPickerOpen(false)}
      />
    </div>
  );
}
