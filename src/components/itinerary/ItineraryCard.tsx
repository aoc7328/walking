import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ItineraryItem } from '../../types/trip';
import { useUIStore } from '../../stores/uiStore';
import { useTripStore } from '../../stores/tripStore';
import { formatStayDuration } from '../../utils/date';
import NoteEditor from './NoteEditor';

interface Props {
  item: ItineraryItem;
  dayId: string;
  index: number;
  isNextStop?: boolean;
}

export default function ItineraryCard({ item, dayId, index, isNextStop }: Props) {
  const openDetail = useUIStore((s) => s.openDetail);
  const updateItem = useTripStore((s) => s.updateItem);
  const [editingNotes, setEditingNotes] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const markerLabel = item.isHotel ? 'H' : String(index);

  function handleTimeBlur(e: React.FocusEvent<HTMLInputElement>) {
    const value = e.target.value.trim();
    if (/^\d{2}:\d{2}$/.test(value)) {
      updateItem(dayId, item.id, { arrivalTime: value });
    }
  }

  function handleStayBlur(e: React.FocusEvent<HTMLInputElement>) {
    const value = parseInt(e.target.value, 10);
    if (Number.isFinite(value) && value >= 0 && value <= 1440) {
      updateItem(dayId, item.id, { stayMinutes: value });
    }
  }

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
            defaultValue={item.arrivalTime}
            onBlur={handleTimeBlur}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
          <span className="item-name">{item.place.name}</span>
        </div>
        <div className="item-stay" onClick={(e) => e.stopPropagation()}>
          停留{' '}
          <input
            className="item-stay-input"
            type="number"
            min={0}
            max={1440}
            defaultValue={item.stayMinutes}
            onBlur={handleStayBlur}
            onClick={(e) => e.stopPropagation()}
          />{' '}
          分　·　{formatStayDuration(item.stayMinutes)}
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
