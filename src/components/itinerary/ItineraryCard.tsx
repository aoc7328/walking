import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ItineraryItem } from '../../types/trip';
import { useUIStore } from '../../stores/uiStore';
import { useTripStore } from '../../stores/tripStore';
import { addMinutesToTime, minutesToHHMM, hhmmToMinutes, timeDiffMinutes } from '../../utils/date';
import NoteEditor from './NoteEditor';

interface Props {
  item: ItineraryItem;
  dayId: string;
  markerLabel: string;
  isNextStop?: boolean;
}

type DurationMode = 'stay' | 'leave';

export default function ItineraryCard({ item, dayId, markerLabel, isNextStop }: Props) {
  const openDetail = useUIStore((s) => s.openDetail);
  const updateItem = useTripStore((s) => s.updateItem);
  const [editingNotes, setEditingNotes] = useState(false);
  const [durMode, setDurMode] = useState<DurationMode>('stay');

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function commitArrival(value: string) {
    const v = value.trim();
    if (!/^\d{2}:\d{2}$/.test(v)) return;
    updateItem(dayId, item.id, { arrivalTime: v, arrivalManual: true });
  }

  function resetArrivalToSystem() {
    updateItem(dayId, item.id, { arrivalManual: false });
  }

  function commitStay(hhmm: string) {
    const minutes = hhmmToMinutes(hhmm);
    if (minutes === null) return;
    updateItem(dayId, item.id, { stayMinutes: minutes });
  }

  function commitLeave(leave: string) {
    if (!/^\d{2}:\d{2}$/.test(leave)) return;
    const minutes = timeDiffMinutes(item.arrivalTime, leave);
    updateItem(dayId, item.id, { stayMinutes: minutes });
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
        <div className="item-time-name">
          <input
            className="item-time editable"
            key={`${item.id}-${item.arrivalTime}`}
            defaultValue={item.arrivalTime}
            onBlur={(e) => commitArrival(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            title="點擊修改抵達時間"
          />
          {item.arrivalManual && (
            <button
              className="item-time-manual-tag"
              title="目前是手動設定，點擊改為自動推算"
              onClick={(e) => {
                e.stopPropagation();
                resetArrivalToSystem();
              }}
            >
              自訂 ↺
            </button>
          )}
          <span className="item-name">{item.place.name}</span>
        </div>

        <div className="item-duration-row" onClick={(e) => e.stopPropagation()}>
          <select
            className="item-duration-mode"
            value={durMode}
            onChange={(e) => setDurMode(e.target.value as DurationMode)}
            onClick={(e) => e.stopPropagation()}
          >
            <option value="stay">停留</option>
            <option value="leave">離開</option>
          </select>
          {durMode === 'stay' ? (
            <input
              className="item-duration-input"
              type="text"
              inputMode="numeric"
              pattern="\d{2}:\d{2}"
              key={`${item.id}-stay-${stayHHMM}`}
              defaultValue={stayHHMM}
              maxLength={5}
              placeholder="01:00"
              onBlur={(e) => commitStay(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              onClick={(e) => e.stopPropagation()}
              title="格式 HH:MM，例如 01:00 表示停留 1 小時"
            />
          ) : (
            <input
              className="item-duration-input"
              type="time"
              key={`${item.id}-leave-${leaveTime}`}
              defaultValue={leaveTime}
              onBlur={(e) => commitLeave(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              onClick={(e) => e.stopPropagation()}
              title="離開時間（會回算成停留時間）"
            />
          )}
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
