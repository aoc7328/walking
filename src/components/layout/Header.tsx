import { useEffect, useRef, useState } from 'react';
import { useTripStore } from '../../stores/tripStore';
import { formatRange, diffDays, addDays } from '../../utils/date';
import TripSwitcher from './TripSwitcher';
import { useUIStore } from '../../stores/uiStore';
import SaveAsModal from './SaveAsModal';

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
  const renameTrip = useTripStore((s) => s.renameTrip);
  const dirty = useTripStore((s) => s.dirty);
  const persisted = useTripStore((s) => s.persisted);
  const saveTrip = useTripStore((s) => s.saveTrip);
  const openShareModal = useUIStore((s) => s.openShareModal);
  const openOverviewModal = useUIStore((s) => s.openOverviewModal);
  const openDownloadModal = useUIStore((s) => s.openDownloadModal);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!trip) return <header className="header" />;

  const endDate = addDays(trip.startDate, trip.days.length - 1);
  const totalDays = diffDays(trip.startDate, endDate) + 1;
  const meta = `${formatRange(trip.startDate, endDate)}　·　${totalDays} 天`;

  async function handleSave() {
    if (saving) return;
    if (!persisted) {
      // 從未存過（mock 範例）→ 另存新行程
      setSaveAsOpen(true);
      return;
    }
    // 既有行程 → 覆蓋
    setSaving(true);
    try {
      await saveTrip();
    } catch (err) {
      window.alert('儲存失敗：' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="header">
        <div className="brand">
          <img className="brand-logo" src="/logo.png" alt="logo" />
          <span className="brand-mark">
            <em>胖齊肥柔去走走</em>
          </span>
          <span className="brand-divider" />
          <div className="trip-info">
            <EditableTripName name={trip.name} onSave={renameTrip} />
            <span className="trip-meta">{meta}</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={openOverviewModal} title="打開整段行程的總覽地圖">總覽</button>
          <TripSwitcher />
          <button
            className={`btn${dirty ? ' btn-primary' : ''}`}
            onClick={handleSave}
            disabled={saving || !dirty}
            title={persisted ? '儲存變更到 KV' : '另存為新行程'}
          >
            {saving ? '儲存中…' : dirty ? '儲存 ●' : '已儲存'}
          </button>
          <button className="btn" onClick={openDownloadModal} title="下載 PDF（普通版 / 騎馬釘小冊子）">下載</button>
          <button className="btn" onClick={openShareModal} title="產生 QR Code 與分享連結，讓朋友掃描看手機版行程">分享</button>
        </div>
      </header>
      {saveAsOpen && <SaveAsModal onClose={() => setSaveAsOpen(false)} />}
    </>
  );
}
