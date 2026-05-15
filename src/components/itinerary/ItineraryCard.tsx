import { useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ItineraryItem } from '../../types/trip';
import { useUIStore } from '../../stores/uiStore';
import { useTripStore } from '../../stores/tripStore';
import {
  addMinutesToTime,
  minutesToHHMM,
  hhmmToMinutes,
  timeDiffMinutes,
  formatWithWeekday,
  normalizeTimeInput,
} from '../../utils/date';
import { formatDuration } from '../../utils/format';
import NoteEditor from './NoteEditor';

interface Props {
  item: ItineraryItem;
  dayId: string;
  markerLabel: string;
  isNextStop?: boolean;
}

type Row1Mode = 'arrival' | 'stay';

export default function ItineraryCard({ item, dayId, markerLabel, isNextStop }: Props) {
  const openDetail = useUIStore((s) => s.openDetail);
  const updateItem = useTripStore((s) => s.updateItem);
  const copyItemToDay = useTripStore((s) => s.copyItemToDay);
  const removeItem = useTripStore((s) => s.removeItem);
  const trip = useTripStore((s) => s.trip);

  const [editingNotes, setEditingNotes] = useState(false);
  const [row1Mode, setRow1Mode] = useState<Row1Mode>('arrival');
  const [copyOpen, setCopyOpen] = useState(false);
  const copyRef = useRef<HTMLDivElement>(null);

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    const ok = window.confirm(`確定刪除「${item.place.name}」這個行程？此操作無法復原。`);
    if (!ok) return;
    removeItem(dayId, item.id);
  }

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  useEffect(() => {
    if (!copyOpen) return;
    function onDown(e: MouseEvent) {
      if (copyRef.current && !copyRef.current.contains(e.target as Node)) setCopyOpen(false);
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [copyOpen]);

  function commitArrival(value: string) {
    const v = normalizeTimeInput(value);
    if (!v) return;
    updateItem(dayId, item.id, { arrivalTime: v, arrivalManual: true });
  }

  function commitStayHHMM(value: string) {
    const minutes = hhmmToMinutes(value);
    if (minutes === null) return;
    updateItem(dayId, item.id, { stayMinutes: minutes });
  }

  function commitLeave(value: string) {
    const v = normalizeTimeInput(value);
    if (!v) return;
    const minutes = timeDiffMinutes(item.arrivalTime, v);
    updateItem(dayId, item.id, { stayMinutes: minutes });
  }

  function resetArrivalToSystem() {
    updateItem(dayId, item.id, { arrivalManual: false });
  }

  const stayHHMM = minutesToHHMM(item.stayMinutes);
  const leaveTime = addMinutesToTime(item.arrivalTime, item.stayMinutes);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`itinerary-card${isNextStop ? ' next-stop' : ''}${isDragging ? ' dragging' : ''}`}
      onClick={() => openDetail(item.place.placeId, 'itinerary')}
      {...attributes}
      {...listeners}
    >
      <div className={`item-marker${item.isHotel ? ' hotel' : ''}`}>{markerLabel}</div>
      <div className="item-body">
        <div className="item-head-row">
          <span className="item-name">{item.place.name}</span>
          <div className="item-card-actions" onClick={(e) => e.stopPropagation()}>
            <div className="item-copy-wrap" ref={copyRef}>
              <button
                className="item-icon-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setCopyOpen((o) => !o);
                }}
                title="複製到其他天"
                aria-label="複製"
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
                        copyItemToDay(dayId, item.id, d.id);
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
              title="刪除此行程"
              aria-label="刪除"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                <path d="M10 11v6M14 11v6"></path>
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>

        <div className="item-time-row" onClick={(e) => e.stopPropagation()}>
          <select
            className="item-duration-mode"
            value={row1Mode}
            onChange={(e) => setRow1Mode(e.target.value as Row1Mode)}
            onClick={(e) => e.stopPropagation()}
          >
            <option value="arrival">抵達</option>
            <option value="stay">停留</option>
          </select>
          {row1Mode === 'arrival' ? (
            <input
              className="item-duration-input"
              type="text"
              inputMode="numeric"
              pattern="\d{2}:\d{2}"
              key={`${item.id}-arr-${item.arrivalTime}`}
              defaultValue={item.arrivalTime}
              maxLength={5}
              placeholder="09:00"
              onBlur={(e) => commitArrival(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              onClick={(e) => e.stopPropagation()}
              title="24 小時制 HH:MM（例：17:30）"
            />
          ) : (
            <input
              className="item-duration-input"
              type="text"
              inputMode="numeric"
              pattern="\d{2}:\d{2}"
              key={`${item.id}-stay-${stayHHMM}`}
              defaultValue={stayHHMM}
              maxLength={5}
              placeholder="01:00"
              onBlur={(e) => commitStayHHMM(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              onClick={(e) => e.stopPropagation()}
              title="格式 HH:MM，例如 01:00 表示停留 1 小時"
            />
          )}
          {item.arrivalManual && (
            <button
              className="item-time-manual-tag"
              title="目前抵達時間是手動設定，點擊改為自動推算"
              onClick={(e) => {
                e.stopPropagation();
                resetArrivalToSystem();
              }}
            >
              自訂 ↺
            </button>
          )}
        </div>

        <div className="item-time-row" onClick={(e) => e.stopPropagation()}>
          <span className="item-leave-label">離開</span>
          <input
            className="item-duration-input"
            type="text"
            inputMode="numeric"
            pattern="\d{2}:\d{2}"
            key={`${item.id}-leave-${leaveTime}`}
            defaultValue={leaveTime}
            maxLength={5}
            placeholder="10:00"
            onBlur={(e) => commitLeave(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            onClick={(e) => e.stopPropagation()}
            title="24 小時制 HH:MM，會回算成停留時間"
          />
          <span className="item-stay-hint">停留 {formatDuration(item.stayMinutes)}</span>
        </div>

        {item.notes && item.notes.length > 0 && !editingNotes && (
          <div className="item-notes" onClick={(e) => { e.stopPropagation(); setEditingNotes(true); }}>
            {item.notes.map((n, i) => (
              <div key={i} className="item-note">{n}</div>
            ))}
          </div>
        )}
        {editingNotes && (
          <NoteEditor
            notes={item.notes ?? []}
            onChange={(next) => updateItem(dayId, item.id, { notes: next })}
          />
        )}
        {(!item.notes || item.notes.length === 0) && !editingNotes && (
          <button className="note-add-btn" onClick={(e) => { e.stopPropagation(); setEditingNotes(true); }}>
            + 加備註
          </button>
        )}
      </div>
    </div>
  );
}
