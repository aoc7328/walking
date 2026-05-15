import { useEffect, useState } from 'react';
import { useTripStore } from '../../stores/tripStore';
import { useUIStore } from '../../stores/uiStore';
import { addDays, formatFullWithWeekday } from '../../utils/date';

export default function ChangeStartDateModal() {
  const open = useUIStore((s) => s.dateModalOpen);
  const close = useUIStore((s) => s.closeDateModal);
  const trip = useTripStore((s) => s.trip);
  const changeStartDate = useTripStore((s) => s.changeStartDate);

  const [next, setNext] = useState('');

  useEffect(() => {
    if (trip && open) setNext(trip.startDate);
  }, [open, trip]);

  if (!open || !trip) return null;

  const endDate = addDays(next || trip.startDate, trip.days.length - 1);

  function handleConfirm() {
    if (!next) return;
    changeStartDate(next);
    close();
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal">
        <div className="modal-date">
          <h2 className="modal-title">更換起始日</h2>
          <p className="modal-subtitle">整段行程會一起平移　·　天數固定不變，要增減天數請用日程表的 + 按鈕</p>

          <div className="date-row">
            <span className="date-row-label">目前起始日</span>
            <span className="date-row-value date-row-value-readonly">{formatFullWithWeekday(trip.startDate)}</span>
          </div>

          <div className="date-row">
            <span className="date-row-label">新起始日</span>
            <input
              type="date"
              className="date-input"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>

          <div className="date-row">
            <span className="date-row-label">新結束日</span>
            <span className="date-row-value date-row-value-readonly">{formatFullWithWeekday(endDate)}</span>
          </div>

          <div className="date-row">
            <span className="date-row-label">天數</span>
            <span className="date-row-value date-row-value-readonly">{trip.days.length} 天　·　不變</span>
          </div>

          <div className="modal-actions">
            <button className="btn" onClick={close}>
              取消
            </button>
            <button className="btn btn-primary" onClick={handleConfirm}>
              確定平移
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
