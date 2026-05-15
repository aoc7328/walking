import { useEffect, useRef, useState } from 'react';
import { useTripStore } from '../../stores/tripStore';
import { formatRange, diffDays, addDays } from '../../utils/date';
import { exportTripAsJSON, exportTripAsHTML, importTripJSONFile } from '../../services/exportImport';
import { exportTripAsPDF } from '../../services/pdfExport';
import TripSwitcher from './TripSwitcher';

function EditableTripName({ name, onSave }: { name: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commit() {
    const v = draft.trim();
    if (v && v !== name) onSave(v);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="trip-name-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') {
            setDraft(name);
            setEditing(false);
          }
        }}
      />
    );
  }
  return (
    <span className="trip-name trip-name-editable" onClick={() => setEditing(true)} title="點擊修改名稱">
      {name}
      <span className="trip-name-edit-hint">✎</span>
    </span>
  );
}

export default function Header() {
  const trip = useTripStore((s) => s.trip);
  const setTrip = useTripStore((s) => s.setTrip);
  const renameTrip = useTripStore((s) => s.renameTrip);

  if (!trip) return <header className="header" />;

  const endDate = addDays(trip.startDate, trip.days.length - 1);
  const totalDays = diffDays(trip.startDate, endDate) + 1;
  const meta = `${formatRange(trip.startDate, endDate)}　·　${totalDays} 天`;

  async function handleImport() {
    const ok = window.confirm('匯入會覆蓋目前的行程，確定要繼續嗎？');
    if (!ok) return;
    try {
      const imported = await importTripJSONFile();
      if (imported) setTrip(imported);
    } catch (err) {
      window.alert('匯入失敗：' + (err instanceof Error ? err.message : '未知錯誤'));
    }
  }

  return (
    <header className="header">
      <div className="brand">
        <span className="brand-mark">
          <em>胖齊肥柔去走走</em>
        </span>
        <span className="brand-divider" />
        <div className="trip-info">
          <EditableTripName name={trip.name} onSave={renameTrip} />
          <span className="trip-meta">{meta}</span>
        </div>
        <TripSwitcher />
      </div>
      <div className="header-actions">
        <button className="btn" onClick={() => exportTripAsJSON(trip)} title="匯出 JSON 行程檔（之後可從另一台裝置匯入還原）">匯出</button>
        <button className="btn" onClick={handleImport} title="從 JSON 行程檔匯入（會覆蓋目前的）">匯入</button>
        <button className="btn" onClick={() => exportTripAsPDF(trip)} title="下載 PDF 旅遊小冊">下載</button>
        <button className="btn" onClick={() => exportTripAsHTML(trip)} title="產生獨立 HTML 檔，丟給朋友開瀏覽器就能看">分享</button>
      </div>
    </header>
  );
}
