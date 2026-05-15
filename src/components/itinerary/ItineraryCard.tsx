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
  const trip = useTripStore((s) => s.trip);

  const [editingNotes, setEditingNotes] = useState(false);
  const [row1Mode, setRow1Mode] = useState<Row1Mode>('arrival');
  const [copyOpen, setCopyOpen] = useState(false);
  const copyRef = useRef<HTMLDivElement>(null);

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
    const v = value.trim();
    if (!/^\d{2}:\d{2}$/.test(v)) return;
    updateItem(dayId, item.id, { arrivalTime: v, arrivalManual: true });
  }

  function commitStayHHMM(value: string) {
    const minutes = hhmmToMinutes(value);
    if (minutes === null) return;
    updateItem(dayId, item.id, { stayMinutes: minutes });
  }

  function commitLeave(value: string) {
    if (!/^\d{2}:\d{2}$/.test(value)) return;
    const minutes = timeDiffMinutes(item.arrivalTime, value);
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
                className="item-copy-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setCopyOpen((o) => !o);
                }}
                title="複製到其他天"
              >
                📋
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
              type="time"
              key={`${item.id}-arr-${item.arrivalTime}`}
              defaultValue={item.arrivalTime}
              onBlur={(e) => commitArrival(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              onClick={(e) => e.stopPropagation()}
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
            type="time"
            key={`${item.id}-leave-${leaveTime}`}
            defaultValue={leaveTime}
            onBlur={(e) => commitLeave(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            onClick={(e) => e.stopPropagation()}
            title="設定離開時間，會回算成停留時間"
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
