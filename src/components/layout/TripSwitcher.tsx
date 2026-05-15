import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useTripStore } from '../../stores/tripStore';
import { listAllTrips } from '../../db/repository';
import type { Trip } from '../../types/trip';
import { addDays, formatRange } from '../../utils/date';

export default function TripSwitcher() {
  const open = useUIStore((s) => s.tripSwitcherOpen);
  const toggle = useUIStore((s) => s.toggleTripSwitcher);
  const close = useUIStore((s) => s.closeTripSwitcher);
  const openNewTripModal = useUIStore((s) => s.openNewTripModal);
  const setCurrentDay = useUIStore((s) => s.setCurrentDay);

  const trip = useTripStore((s) => s.trip);
  const switchToTrip = useTripStore((s) => s.switchToTrip);
  const deleteTrip = useTripStore((s) => s.deleteTrip);

  const [allTrips, setAllTrips] = useState<Trip[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listAllTrips().then((trips) => {
      if (!cancelled) setAllTrips(trips);
    });
    return () => {
      cancelled = true;
    };
  }, [open, trip?.updatedAt]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        close();
      }
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open, close]);

  async function handleSwitch(id: string) {
    if (id === trip?.id) {
      close();
      return;
    }
    await switchToTrip(id);
    setCurrentDay(null);
    close();
  }

  async function handleDelete(e: React.MouseEvent, t: Trip) {
    e.stopPropagation();
    if (!window.confirm(`確定刪除「${t.name}」？此操作無法復原。`)) return;
    await deleteTrip(t.id);
    const fresh = await listAllTrips();
    setAllTrips(fresh);
  }

  return (
    <div className="trip-switcher" ref={wrapRef}>
      <button className="trip-switcher-trigger" onClick={toggle} title="切換／管理行程">
        📁　行程
        <span className="trip-switcher-arrow">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="trip-switcher-dropdown">
          <div className="trip-switcher-list">
            {allTrips.length === 0 && <div className="trip-switcher-empty">沒有其他行程</div>}
            {allTrips.map((t) => {
              const isCurrent = t.id === trip?.id;
              const endDate = addDays(t.startDate, t.days.length - 1);
              return (
                <div
                  key={t.id}
                  className={`trip-switcher-item${isCurrent ? ' current' : ''}`}
                  onClick={() => handleSwitch(t.id)}
                >
                  <div className="trip-switcher-item-main">
                    <div className="trip-switcher-item-name">
                      {isCurrent && <span className="trip-switcher-current-tag">✓</span>}
                      {t.name}
                    </div>
                    <div className="trip-switcher-item-meta">
                      {formatRange(t.startDate, endDate)}　·　{t.days.length} 天
                    </div>
                  </div>
                  <button
                    className="trip-switcher-delete"
                    onClick={(e) => handleDelete(e, t)}
                    title="刪除行程"
                    disabled={allTrips.length <= 1}
                  >
                    🗑
                  </button>
                </div>
              );
            })}
          </div>
          <button className="trip-switcher-new" onClick={openNewTripModal}>
            ＋　新增行程
          </button>
        </div>
      )}
    </div>
  );
}
