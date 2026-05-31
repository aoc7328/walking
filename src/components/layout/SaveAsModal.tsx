import { useRef, useState } from 'react';
import { useTripStore } from '../../stores/tripStore';

interface Props {
  onClose: () => void;
}

export default function SaveAsModal({ onClose }: Props) {
  const trip = useTripStore((s) => s.trip);
  const saveAsNewTrip = useTripStore((s) => s.saveAsNewTrip);
  const [name, setName] = useState(trip?.name ?? '新行程');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      await saveAsNewTrip(name.trim() || (trip?.name ?? '新行程'));
      onClose();
    } catch (err) {
      window.alert('儲存失敗：' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div className="modal" style={{ maxWidth: 400, padding: '22px 24px 18px' }}>
        <h2 className="modal-title">儲存為新行程</h2>
        <p className="modal-subtitle">這份行程還沒存過，請給它一個名稱</p>
        <input
          ref={inputRef}
          className="trip-name-input"
          style={{ width: '100%', marginTop: 12, marginBottom: 16, fontSize: 15, padding: '8px 10px' }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) handleSave(); else if (e.key === 'Escape') onClose(); }}
          autoFocus
          disabled={saving}
        />
        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={saving}>取消</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? '儲存中…' : '確定儲存'}
          </button>
        </div>
      </div>
    </div>
  );
}
