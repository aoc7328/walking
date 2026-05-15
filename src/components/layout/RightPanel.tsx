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

function findNextStop(items: ReturnType<typeof useTripStore.getState>['trip'] extends infer T ? T : never, _now: Date) {
  void items;
  void _now;
  return null;
}
void findNextStop;

export default function RightPanel() {
  const collapsed = useUIStore((s) => s.collapse.rightPanel);
  const toggle = useUIStore((s) => s.toggleCollapse);
  const currentDayId = useUIStore((s) => s.currentDayId);
  const trip = useTripStore((s) => s.trip);
  const reorderItems = useTripStore((s) => s.reorderItems);
  const setLegMode = useTripStore((s) => s.setLegMode);

  const day = trip?.days.find((d) => d.id === currentDayId) ?? null;

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

  let nonHotelCount = 0;
  return (
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
            <div className="right-panel-day-meta">
              {day.city ?? '尚未設定城市'}　·　{day.items.length} 個點　·　拖拉重排
            </div>
            <button
              className="collapse-toggle"
              onClick={() => toggle('rightPanel')}
              style={{ position: 'absolute', top: 14, right: 18, width: 18, height: 18, fontSize: 9 }}
              title="收合右欄"
            >
              ▸
            </button>
          </div>
          <div className="right-panel-list thin-scroll">
            {day.items.length === 0 && <div className="empty-day">這天還沒安排　·　在上方搜尋並加入地點</div>}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={day.items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
                {day.items.map((item, idx) => {
                  if (!item.isHotel) nonHotelCount += 1;
                  const label = item.isHotel ? 0 : nonHotelCount;
                  const card = (
                    <ItineraryCard
                      key={item.id}
                      item={item}
                      dayId={day.id}
                      index={label}
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
  );
}
