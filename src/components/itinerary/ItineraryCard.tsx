import { useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ItineraryItem } from '../../types/trip';
import { useUIStore } from '../../stores/uiStore';
import { useTripStore } from '../../stores/tripStore';
import {
  addMinutesToTime,
  minutesToHHMM,
  hhmmToMinutes,
  formatWithWeekday,
  formatStayDuration,
  normalizeTimeInput,
} from '../../utils/date';
import NoteEditor from './NoteEditor';
import TimeField from './TimeField';
import PlaceIconBadge from '../common/PlaceIconBadge';
import IconPicker from '../common/IconPicker';
import { useAutoFitText } from '../../hooks/useAutoFitText';

interface Props {
  item: ItineraryItem;
  dayId: string;
  markerLabel: string;
  isNextStop?: boolean;
}

type Row1Mode = 'arrival' | 'stay';

export default function ItineraryCard({
  item,
  dayId,
  markerLabel,
  isNextStop,
}: Props) {
  const openDetail = useUIStore((s) => s.openDetail);
  const updateItem = useTripStore((s) => s.updateItem);
  const copyItemToDay = useTripStore((s) => s.copyItemToDay);
  const removeItem = useTripStore((s) => s.removeItem);
  const setPlaceIcon = useTripStore((s) => s.setPlaceIcon);
  const trip = useTripStore((s) => s.trip);

  const [editingNotes, setEditingNotes] = useState(false);
  const [row1Mode, setRow1Mode] = useState<Row1Mode>('arrival');
  const [copyOpen, setCopyOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  // 預設一律收折；要設時間就點底部「設定到達時間 ⌄」展開
  const [timeExpanded, setTimeExpanded] = useState(false);

  // 地點名稱自適應：先試 2 行（基準 17px），裝不下才一階一階縮，下限 17/1.5 ≈ 11.33px
  const NAME_BASE_PX = 17;
  const NAME_MIN_PX = NAME_BASE_PX / 1.5;
  const { ref: nameRef, size: dynamicNameSize } = useAutoFitText(
    item.place.name,
    NAME_BASE_PX,
    NAME_MIN_PX,
  );
  const copyRef = useRef<HTMLDivElement>(null);

  function handleBadgeClick() {
    setIconPickerOpen(true);
  }

  function handleIconSelect(emoji: string | null) {
    setPlaceIcon(item.place.placeId, emoji ?? undefined);
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    const ok = window.confirm(`確定刪除「${item.place.name}」這個行程？此操作無法復原。`);
    if (!ok) return;
    removeItem(dayId, item.id);
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  useEffect(() => {
    if (!copyOpen) return;
    function onDown(e: MouseEvent) {
      if (copyRef.current && !copyRef.current.contains(e.target as Node)) setCopyOpen(false);
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [copyOpen]);

  // 以下三個 commit 收使用者輸入的純數字，回傳 null=成功、字串=錯誤訊息（給 TimeField 顯示）。
  function commitArrival(digits: string): string | null {
    const v = normalizeTimeInput(digits);
    if (!v) return '時間格式不對';
    updateItem(dayId, item.id, { arrivalTime: v, arrivalManual: true });
    return null;
  }

  function commitStay(digits: string): string | null {
    const v = normalizeTimeInput(digits);
    const minutes = v ? hhmmToMinutes(v) : null;
    if (minutes === null) return '格式不對（時:分）';
    updateItem(dayId, item.id, { stayMinutes: minutes });
    return null;
  }

  function commitLeave(digits: string): string | null {
    const v = normalizeTimeInput(digits);
    if (!v) return '時間格式不對';
    const arr = hhmmToMinutes(item.arrivalTime);
    const lv = hhmmToMinutes(v);
    if (arr === null || lv === null) return '時間格式不對';
    // 防呆：離開不能早於抵達
    if (lv < arr) return '離開不能早於抵達';
    updateItem(dayId, item.id, { stayMinutes: lv - arr });
    return null;
  }

  function resetArrivalToSystem() {
    updateItem(dayId, item.id, { arrivalManual: false });
    setTimeExpanded(false);
  }

  const stayHHMM = minutesToHHMM(item.stayMinutes);
  const leaveTime = addMinutesToTime(item.arrivalTime, item.stayMinutes);

  // 抵達時間與「設定到達時間」toggle 永遠顯示。
  // 原本針對第一站（idx===0）的隱藏邏輯是為「起床飯店」設計，
  // 但匯入行程第一站可能是機場等真實抵達點，一律顯示比較不會誤導。
  const showArrivalInline = true;
  const showTimeToggle = true;
  const hasNotes = !!item.notes && item.notes.length > 0;
  const showAddNotesBtn = !hasNotes && !editingNotes;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`itinerary-card${isNextStop ? ' next-stop' : ''}${isDragging ? ' dragging' : ''}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="item-drag-handle"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        title="按住拖曳調整順序"
        aria-label="拖曳"
      >
        <svg viewBox="0 0 16 10" width="16" height="10" fill="currentColor" aria-hidden>
          <circle cx="2" cy="2.5" r="1.2" />
          <circle cx="6.7" cy="2.5" r="1.2" />
          <circle cx="11.3" cy="2.5" r="1.2" />
          <circle cx="16" cy="2.5" r="1.2" />
          <circle cx="2" cy="7.5" r="1.2" />
          <circle cx="6.7" cy="7.5" r="1.2" />
          <circle cx="11.3" cy="7.5" r="1.2" />
          <circle cx="16" cy="7.5" r="1.2" />
        </svg>
      </button>
      <div className="item-marker-stack">
        <div className="item-marker">{markerLabel}</div>
        <PlaceIconBadge iconEmoji={item.place.iconEmoji} onClick={handleBadgeClick} />
      </div>
      <div className="item-body">
        {showArrivalInline && (
          <div className="item-big-time">{item.arrivalTime}</div>
        )}
        <div className="item-head-row">
          <span
            ref={nameRef as React.RefObject<HTMLSpanElement>}
            className="item-name item-name-clickable"
            style={{ fontSize: `${dynamicNameSize.toFixed(2)}px` }}
            onClick={() => openDetail(item.place.placeId, 'itinerary')}
            title="點擊查看地點詳細資訊"
          >
            {item.place.name}
          </span>
          <div className="item-card-actions" onClick={(e) => e.stopPropagation()}>
            <div className="item-copy-wrap" ref={copyRef}>
              <button
                className="item-icon-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setCopyOpen((o) => !o);
                }}
                title="複製到其他天"
                aria-label="複製"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
              {copyOpen && trip && (
                <div className="item-copy-menu">
                  <div className="item-copy-menu-label">複製到</div>
                  {trip.days.map((d) => (
                    <button
                      key={d.id}
                      className={`item-copy-menu-item${d.id === dayId ? ' current' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        copyItemToDay(dayId, item.id, d.id);
                        setCopyOpen(false);
                      }}
                    >
                      <span className="item-copy-menu-day">Day {d.dayIndex}</span>
                      <span className="item-copy-menu-date">{formatWithWeekday(d.date)}</span>
                      {d.id === dayId && <span className="item-copy-menu-today">今日</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className="item-icon-btn item-icon-btn-danger"
              onClick={handleDelete}
              title="刪除此行程"
              aria-label="刪除"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                <path d="M10 11v6M14 11v6"></path>
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>

        <div className="item-stay-line">{formatStayDuration(item.stayMinutes)}</div>

        {timeExpanded && (
          <div className="item-time-inputs">
            <div className="item-time-row" onClick={(e) => e.stopPropagation()}>
              <select
                className="item-duration-mode"
                value={row1Mode}
                onChange={(e) => setRow1Mode(e.target.value as Row1Mode)}
                onClick={(e) => e.stopPropagation()}
              >
                <option value="arrival">抵達</option>
                <option value="stay">停留</option>
              </select>
              {row1Mode === 'arrival' ? (
                <TimeField
                  value={item.arrivalTime}
                  onCommit={commitArrival}
                  onEnterApplied={() => setTimeExpanded(false)}
                  placeholder="0900"
                  title="免打冒號，直接輸入四碼（例：1730）；Enter 套用"
                  ariaLabel="抵達時間"
                />
              ) : (
                <TimeField
                  value={stayHHMM}
                  onCommit={commitStay}
                  onEnterApplied={() => setTimeExpanded(false)}
                  placeholder="0100"
                  title="停留時長 時:分，直接輸入四碼（例：0100 = 1 小時）；Enter 套用"
                  ariaLabel="停留時長"
                />
              )}
              {item.arrivalManual && (
                <button
                  className="item-time-manual-tag"
                  title="目前抵達時間是手動設定，點擊改為自動推算"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetArrivalToSystem();
                  }}
                >
                  自訂 ↺
                </button>
              )}
            </div>

            <div className="item-time-row" onClick={(e) => e.stopPropagation()}>
              <span className="item-leave-label">離開</span>
              <TimeField
                value={leaveTime}
                onCommit={commitLeave}
                onEnterApplied={() => setTimeExpanded(false)}
                placeholder="1000"
                title="免打冒號，直接輸入四碼；會回算成停留時間。Enter 套用"
                ariaLabel="離開時間"
              />
            </div>
          </div>
        )}

        {hasNotes && !editingNotes && (
          <div className="item-notes" onClick={(e) => { e.stopPropagation(); setEditingNotes(true); }}>
            {item.notes!.map((n, i) => (
              <div key={i} className="item-note">{n}</div>
            ))}
          </div>
        )}
        {editingNotes && (
          <NoteEditor
            notes={item.notes ?? []}
            onChange={(next) => updateItem(dayId, item.id, { notes: next })}
          />
        )}

        <div className="item-footer-row" onClick={(e) => e.stopPropagation()}>
          {showAddNotesBtn && (
            <button
              className="footer-link"
              onClick={(e) => { e.stopPropagation(); setEditingNotes(true); }}
            >
              + 加備註
            </button>
          )}
          {showAddNotesBtn && showTimeToggle && <span className="footer-sep">·</span>}
          {showTimeToggle && (
            <button
              className="footer-link"
              onClick={(e) => { e.stopPropagation(); setTimeExpanded((v) => !v); }}
            >
              {timeExpanded ? '收起 ⌃' : '設定到達時間 ⌄'}
            </button>
          )}
        </div>
      </div>
      <IconPicker
        open={iconPickerOpen}
        currentEmoji={item.place.iconEmoji}
        onSelect={handleIconSelect}
        onClose={() => setIconPickerOpen(false)}
      />
    </div>
  );
}
