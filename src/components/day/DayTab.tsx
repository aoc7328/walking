import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DayPlan } from '../../types/trip';
import { formatWithWeekday } from '../../utils/date';

interface Props {
  day: DayPlan;
  active: boolean;
  onSelect: () => void;
}

export default function DayTab({ day, active, onSelect }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: day.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const nonHotelCount = day.items.filter((it) => !it.isHotel).length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`day-tab${active ? ' active' : ''}${isDragging ? ' dragging' : ''}`}
      onClick={onSelect}
      {...attributes}
      {...listeners}
    >
      <span className="day-tab-date">{formatWithWeekday(day.date)}</span>
      <span className="day-tab-num">
        Day <em>{day.dayIndex}</em>
      </span>
      <span className="day-tab-meta">{nonHotelCount} 點</span>
    </div>
  );
}
