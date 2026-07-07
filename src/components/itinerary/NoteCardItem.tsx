import { useLayoutEffect, useRef, useState } from 'react';
import { useTripStore } from '../../stores/tripStore';
import type { NoteCard } from '../../types/trip';
import PlaceIconBadge from '../common/PlaceIconBadge';
import IconPicker from '../common/IconPicker';

/**
 * 小卡片：無時間、無地點的隨手備忘。
 * 只有圖示（可選）＋ 一段自由文字，文字方塊高度隨內容自動長高、完整顯示。
 * 不進路線/地圖/時間鏈——資料存在 DayPlan.cards，跟 items 完全分開。
 */
export default function NoteCardItem({ card, dayId }: { card: NoteCard; dayId: string }) {
  const updateNoteCard = useTripStore((s) => s.updateNoteCard);
  const removeNoteCard = useTripStore((s) => s.removeNoteCard);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // 文字方塊自動長高：高度跟著內容走，完整顯示、不出現內部捲軸。
  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [card.text]);

  function handleDelete() {
    if (card.text.trim() && !window.confirm('刪除這張小卡片？此操作無法復原。')) return;
    removeNoteCard(dayId, card.id);
  }

  return (
    <div className="note-card">
      <PlaceIconBadge iconEmoji={card.iconEmoji} onClick={() => setIconPickerOpen(true)} />
      <textarea
        ref={taRef}
        className="note-card-text"
        value={card.text}
        onChange={(e) => updateNoteCard(dayId, card.id, { text: e.target.value })}
        placeholder="隨手寫點什麼…想去哪再說"
        rows={1}
      />
      <button
        className="item-icon-btn item-icon-btn-danger note-card-del"
        onClick={handleDelete}
        title="刪除小卡片"
        aria-label="刪除小卡片"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
          <path d="M10 11v6M14 11v6"></path>
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
      <IconPicker
        open={iconPickerOpen}
        currentEmoji={card.iconEmoji}
        onSelect={(emoji) => updateNoteCard(dayId, card.id, { iconEmoji: emoji ?? undefined })}
        onClose={() => setIconPickerOpen(false)}
      />
    </div>
  );
}
