import { useRef } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useTripStore } from '../../stores/tripStore';
import { useUIStore } from '../../stores/uiStore';
import DayTab from '../day/DayTab';

export default function DayStrip() {
  const collapsed = useUIStore((s) => s.collapse.dayStrip);
  const toggle = useUIStore((s) => s.toggleCollapse);
  const openDate = useUIStore((s) => s.openDateModal);
  const currentDayId = useUIStore((s) => s.currentDayId);
  const setCurrentDay = useUIStore((s) => s.setCurrentDay);
  const trip = useTripStore((s) => s.trip);
  const reorderDays = useTripStore((s) => s.reorderDays);
  const addDayBefore = useTripStore((s) => s.addDayBefore);
  const addDayAfter = useTripStore((s) => s.addDayAfter);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // 滾輪垂直 → 橫向捲動（不影響 trackpad 原本就有的橫向 deltaX）
  // 用 callback ref：每次 list 元素 mount / unmount 都重新掛事件
  const wheelHandlerRef = useRef<((e: WheelEvent) => void) | null>(null);
  const listElRef = useRef<HTMLDivElement | null>(null);
  function attachList(node: HTMLDivElement | null) {
    // 先清掉舊的事件
    if (listElRef.current && wheelHandlerRef.current) {
      listElRef.current.removeEventListener('wheel', wheelHandlerRef.current);
    }
    listElRef.current = node;
    if (!node) {
      wheelHandlerRef.current = null;
      return;
    }
    const handler = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      if (node.scrollWidth <= node.clientWidth) return;
      e.preventDefault();
      node.scrollLeft += e.deltaY;
    };
    wheelHandlerRef.current = handler;
    node.addEventListener('wheel', handler, { passive: false });
  }

  if (!trip) return <div className="day-strip-wrap" />;

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id || !trip) return;
    const from = trip.days.findIndex((d) => d.id === active.id);
    const to = trip.days.findIndex((d) => d.id === over.id);
    if (from < 0 || to < 0) return;
    reorderDays(from, to);
  }

  return (
    <div
      className={`day-strip-wrap${collapsed ? ' collapsed' : ''}`}
      onMouseEnter={collapsed ? () => toggle('dayStrip') : undefined}
    >
      {collapsed && <div className="day-strip-peek">日程表　·　移到此處展開</div>}
      <div className="day-strip-content">
        <div className="day-strip-toolbar">
          <span className="day-strip-label">
            {trip.days.length} 個 Day　·　拖動標籤調整順序　·　點選切換右欄
          </span>
          <div className="day-strip-tools">
            <button className="btn" onClick={openDate}>
              更換起始日
            </button>
            <button className="collapse-toggle" onClick={() => toggle('dayStrip')} title="收合日程表">
              ▾
            </button>
          </div>
        </div>
        <div className="day-strip-list thin-scroll" ref={attachList}>
          <div className="day-tab add" title="往前新增一天" onClick={addDayBefore}>
            <span>+</span>
            <span className="add-label">往前</span>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={trip.days.map((d) => d.id)} strategy={horizontalListSortingStrategy}>
              {trip.days.map((day) => (
                <DayTab
                  key={day.id}
                  day={day}
                  active={day.id === currentDayId}
                  onSelect={() => setCurrentDay(day.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
          <div className="day-tab add" title="往後新增一天" onClick={addDayAfter}>
            <span>+</span>
            <span className="add-label">往後</span>
          </div>
        </div>
      </div>
    </div>
  );
}
