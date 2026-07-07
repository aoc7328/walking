import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTripStore } from '../../stores/tripStore';
import type { DayNote } from '../../types/trip';
import { formatWithWeekday } from '../../utils/date';
import PlaceIconBadge from '../common/PlaceIconBadge';
import IconPicker from '../common/IconPicker';

/**
 * 這天的備註（單一）：無時間、無地點。
 * 圖示（可選）＋ 一段自由文字，文字方塊高度隨內容自動長高、完整顯示。
 * 可清除、可「套用到其他天」（小島連住不用重打）。不進路線/地圖/時間鏈。
 */
export default function DayNoteEditor({ note, dayId }: { note: DayNote; dayId: string }) {
  const setDayNote = useTripStore((s) => s.setDayNote);
  const clearDayNote = useTripStore((s) => s.clearDayNote);
  const copyDayNoteToDay = useTripStore((s) => s.copyDayNoteToDay);
  const trip = useTripStore((s) => s.trip);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const applyRef = useRef<HTMLDivElement>(null);

  // 文字方塊自動長高：高度跟著內容走，完整顯示、不出現內部捲軸。
  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [note.text]);

  useEffect(() => {
    if (!applyOpen) return;
    function onDown(e: MouseEvent) {
      if (applyRef.current && !applyRef.current.contains(e.target as Node)) setApplyOpen(false);
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [applyOpen]);

  function handleClear() {
    if (note.text.trim() && !window.confirm('清除這天的備註？此操作無法復原。')) return;
    clearDayNote(dayId);
  }

  const otherDays = trip ? trip.days.filter((d) => d.id !== dayId) : [];

  return (
    <div className="note-card">
      <PlaceIconBadge iconEmoji={note.iconEmoji} onClick={() => setIconPickerOpen(true)} />

      <textarea
        ref={taRef}
        className="note-card-text"
        value={note.text}
        onChange={(e) => setDayNote(dayId, { text: e.target.value })}
        placeholder="這天的備註…想去哪再說"
        rows={1}
      />

      <div className="note-card-actions">
        {otherDays.length > 0 && (
          <div className="item-copy-wrap" ref={applyRef}>
            <button
              className="item-icon-btn"
              onClick={(e) => { e.stopPropagation(); setApplyOpen((o) => !o); }}
              title="把這則備註套用到其他天"
              aria-label="套用到其他天"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            {applyOpen && (
              <div className="item-copy-menu">
                <div className="item-copy-menu-label">套用到</div>
                {otherDays.map((d) => (
                  <button
                    key={d.id}
                    className="item-copy-menu-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyDayNoteToDay(dayId, d.id);
                      setApplyOpen(false);
                    }}
                  >
                    <span className="item-copy-menu-day">Day {d.dayIndex}</span>
                    <span className="item-copy-menu-date">{formatWithWeekday(d.date)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          className="item-icon-btn item-icon-btn-danger"
          onClick={handleClear}
          title="清除這天的備註"
          aria-label="清除備註"
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
        currentEmoji={note.iconEmoji}
        onSelect={(emoji) => setDayNote(dayId, { iconEmoji: emoji ?? undefined })}
        onClose={() => setIconPickerOpen(false)}
      />
    </div>
  );
}
