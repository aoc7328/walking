import { useEffect } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useUIStore } from '../../stores/uiStore';
import { useTripStore } from '../../stores/tripStore';
import { formatWithWeekday } from '../../utils/date';
import ItineraryCard from '../itinerary/ItineraryCard';
import LegConnector from '../itinerary/LegConnector';
import type { TransportMode } from '../../types/place';

export default function RightPanel() {
  const collapsed = useUIStore((s) => s.collapse.rightPanel);
  const toggle = useUIStore((s) => s.toggleCollapse);
  const currentDayId = useUIStore((s) => s.currentDayId);
  const setCurrentDay = useUIStore((s) => s.setCurrentDay);
  const trip = useTripStore((s) => s.trip);
  const reorderItems = useTripStore((s) => s.reorderItems);
  const setLegMode = useTripStore((s) => s.setLegMode);
  const removeDay = useTripStore((s) => s.removeDay);
  const refreshLegsForDay = useTripStore((s) => s.refreshLegsForDay);

  const day = trip?.days.find((d) => d.id === currentDayId) ?? null;

  // 當日或行程任何 leg 缺少 duration 時，跟 Google 拿一次真實時間
  useEffect(() => {
    if (!day) return;
    const needsFetch = day.items.length >= 2 && day.legs.some((l) => l.durationMinutes === undefined);
    if (!needsFetch) return;
    void refreshLegsForDay(day.id);
  }, [day?.id, day?.items.length, day?.legs, refreshLegsForDay, day]);

  function handleDeleteDay() {
    if (!day || !trip) return;
    if (trip.days.length <= 1) {
      window.alert('至少要保留一天，不能刪除');
      return;
    }
    const msg = `確定刪除 Day ${day.dayIndex}（${day.city ?? day.date}）的所有行程嗎？\n此操作無法復原。`;
    if (!window.confirm(msg)) return;
    const idx = trip.days.findIndex((d) => d.id === day.id);
    removeDay(day.id);
    const remaining = trip.days.filter((d) => d.id !== day.id);
    const next = remaining[idx] ?? remaining[idx - 1] ?? remaining[0];
    if (next) setCurrentDay(next.id);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(e: DragEndEvent) {
    if (!day) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = day.items.findIndex((it) => it.id === active.id);
    const newIndex = day.items.findIndex((it) => it.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    reorderItems(day.id, oldIndex, newIndex);
  }

  function handleLegMode(legIdx: number, mode: TransportMode) {
    if (!day) return;
    setLegMode(day.id, legIdx, mode);
  }

  // 計算當天第一個 / 最後一個飯店 item 的 id（給 marker 文字用）
  let firstHotelId: string | null = null;
  let lastHotelId: string | null = null;
  if (day) {
    for (let i = 0; i < day.items.length; i++) {
      if (day.items[i]!.isHotel) {
        firstHotelId = day.items[i]!.id;
        break;
      }
    }
    for (let i = day.items.length - 1; i >= 0; i--) {
      if (day.items[i]!.isHotel) {
        lastHotelId = day.items[i]!.id;
        break;
      }
    }
  }

  let nonHotelCount = 0;
  return (
    <>
      <aside className={`right-panel${collapsed ? ' collapsed' : ''}`}>
        {!day && (
          <div className="right-panel-header">
            <div className="right-panel-day-top">
              <span className="right-panel-day-num">尚未選日</span>
            </div>
          </div>
        )}
        {day && (
          <>
            <div className="right-panel-header">
              <div className="right-panel-day-top">
                <span className="right-panel-day-num">
                  Day <em>{day.dayIndex}</em>
                </span>
                <span className="right-panel-day-date">{formatWithWeekday(day.date)}</span>
              </div>
              <div className="right-panel-tools-row">
                <button
                  className="right-panel-delete-day"
                  onClick={handleDeleteDay}
                  title="刪除本日"
                  disabled={trip ? trip.days.length <= 1 : true}
                >
                  🗑　刪除本日
                </button>
                <button
                  className="collapse-toggle"
                  onClick={() => toggle('rightPanel')}
                  style={{ width: 18, height: 18, fontSize: 13 }}
                  title="收合右欄"
                >
                  ▸
                </button>
              </div>
            </div>
            <div className="right-panel-list thin-scroll">
              {day.items.length === 0 && <div className="empty-day">這天還沒安排　·　在上方搜尋並加入地點</div>}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={day.items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
                  {day.items.map((item, idx) => {
                    let markerLabel: string;
                    if (item.isHotel) {
                      if (item.id === firstHotelId) markerLabel = 'S';
                      else if (item.id === lastHotelId) markerLabel = 'E';
                      else markerLabel = 'H';
                    } else {
                      nonHotelCount += 1;
                      markerLabel = String(nonHotelCount);
                    }
                    const card = (
                      <ItineraryCard
                        key={item.id}
                        item={item}
                        dayId={day.id}
                        markerLabel={markerLabel}
                        isNextStop={false}
                      />
                    );
                    const leg = day.legs[idx];
                    const showLeg = idx < day.items.length - 1 && leg;
                    return (
                      <div key={item.id}>
                        {card}
                        {showLeg && <LegConnector leg={leg} onModeChange={(m) => handleLegMode(idx, m)} />}
                      </div>
                    );
                  })}
                </SortableContext>
              </DndContext>
            </div>
          </>
        )}
      </aside>
      {collapsed && (
        <button className="expand-btn expand-right" onClick={() => toggle('rightPanel')} title="展開右欄">
          ◂
        </button>
      )}
    </>
  );
}
