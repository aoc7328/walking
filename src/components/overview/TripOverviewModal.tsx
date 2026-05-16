import { useEffect } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useTripStore } from '../../stores/tripStore';
import TripOverviewMap from '../map/TripOverviewMap';
import { addDays, formatRange, diffDays } from '../../utils/date';

export default function TripOverviewModal() {
  const open = useUIStore((s) => s.overviewModalOpen);
  const close = useUIStore((s) => s.closeOverviewModal);
  const trip = useTripStore((s) => s.trip);
  const setCurrentDay = useUIStore((s) => s.setCurrentDay);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open || !trip) return null;

  const endDate = addDays(trip.startDate, trip.days.length - 1);
  const total = diffDays(trip.startDate, endDate) + 1;
  const range = formatRange(trip.startDate, endDate);

  function handleDayClick(dayId: string) {
    setCurrentDay(dayId);
    close();
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="overview-modal">
        <div className="overview-modal-header">
          <div>
            <h2 className="overview-modal-title">
              <em>行程總覽</em>
            </h2>
            <div className="overview-modal-meta">
              {range}　·　{total} 天
            </div>
          </div>
          <button className="detail-close" onClick={close} title="關閉">
            ✕
          </button>
        </div>
        <div className="overview-modal-body">
          <TripOverviewMap trip={trip} onDayClick={handleDayClick} />
        </div>
      </div>
    </div>
  );
}
