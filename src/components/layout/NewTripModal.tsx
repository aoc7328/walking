import { useEffect, useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useTripStore } from '../../stores/tripStore';
import { toISODate, addDays, formatFullWithWeekday } from '../../utils/date';

export default function NewTripModal() {
  const open = useUIStore((s) => s.newTripModalOpen);
  const close = useUIStore((s) => s.closeNewTripModal);
  const createNewTrip = useTripStore((s) => s.createNewTrip);
  const setCurrentDay = useUIStore((s) => s.setCurrentDay);

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [days, setDays] = useState(3);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setStartDate(toISODate(new Date()));
      setDays(3);
    }
  }, [open]);

  if (!open) return null;

  const endDate = startDate ? addDays(startDate, days - 1) : '';

  async function handleCreate() {
    if (busy) return;
    setBusy(true);
    try {
      await createNewTrip(name || '新行程', startDate, days);
      setCurrentDay(null); // 讓 AppShell 重新選 day 1
      close();
    } finally {
      setBusy(false);
    }
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
          <h2 className="modal-title">新增行程</h2>
          <p className="modal-subtitle">建立一個全新的旅行規劃，原本的行程會保留</p>

          <div className="date-row">
            <span className="date-row-label">行程名稱</span>
            <input
              type="text"
              className="date-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：京都五日漫遊"
              autoFocus
            />
          </div>

          <div className="date-row">
            <span className="date-row-label">起始日</span>
            <input
              type="date"
              className="date-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="date-row">
            <span className="date-row-label">天數</span>
            <input
              type="number"
              className="date-input"
              min={1}
              max={60}
              value={days}
              onChange={(e) => setDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
          </div>

          <div className="date-row">
            <span className="date-row-label">結束日</span>
            <span className="date-row-value date-row-value-readonly">
              {endDate ? formatFullWithWeekday(endDate) : '—'}
            </span>
          </div>

          <div className="modal-actions">
            <button className="btn" onClick={close} disabled={busy}>
              取消
            </button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={busy || !startDate}>
              {busy ? '建立中…' : '建立行程'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
