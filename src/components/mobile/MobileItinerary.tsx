import { useEffect, useMemo, useRef, useState } from 'react';
import type { DayPlan, Trip } from '../../types/trip';
import { formatStayDuration, formatWithWeekday, hhmmToMinutes, toISODate } from '../../utils/date';
import { cleanNotes } from '../../utils/itemNotes';
import { formatDuration, TRANSPORT_LABEL } from '../../utils/format';
import { printableDayNote } from '../../utils/dayNote';
import { getPlaceIcon } from '../../utils/placeIcon';
import { markKey } from '../../data/markPalette';
import { navigateUrl, placeUrl } from '../../utils/gmaps';
import { copyToClipboard } from '../../utils/clipboard';
import MarkGlyph from '../day/MarkGlyph';

/**
 * 手機版「看行程」：一次看一天，每一站可以直接開 Google 導航 / 打電話 / 複製地址。
 * 純唯讀——手機上不改行程（改一律回電腦版）。
 */

interface Props {
  trip: Trip;
  dayIdx: number;
  onSelectDay: (idx: number) => void;
  onToast: (msg: string) => void;
}

/** 現在幾點（分鐘）。用來標「現在在這站 / 下一站」。 */
function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export default function MobileItinerary({ trip, dayIdx, onSelectDay, onToast }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0);

  const day: DayPlan | undefined = trip.days[dayIdx];
  const todayISO = toISODate(new Date());
  const isToday = day?.date === todayISO;
  const todayIdx = trip.days.findIndex((d) => d.date === todayISO);

  // 符號 → 說明文字（日期卡上蓋的標記，在這裡直接顯示成文字比較好懂）
  const legendMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of trip.markLegend ?? []) {
      if (e.label.trim()) m.set(markKey(e.glyph, e.color), e.label.trim());
    }
    return m;
  }, [trip.markLegend]);

  // 換日：選到的日期卡滑進可視範圍，內容回到最上面
  useEffect(() => {
    const el = barRef.current?.querySelector<HTMLElement>(`[data-day="${dayIdx}"]`);
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    // 直接把捲動容器歸零；用 scrollIntoView 會被 sticky 的日期列擋住標題
    const scroller = barRef.current?.closest('.mv-scroll');
    if (scroller) scroller.scrollTop = 0;
  }, [dayIdx]);

  // 看的是今天時，每分鐘重算一次「現在在哪一站」
  useEffect(() => {
    if (!isToday) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, [isToday]);

  /** 目前所在站的 index（最後一個抵達時間已經過去的站）；不是今天就回 -1。 */
  const currentIdx = useMemo(() => {
    void tick; // 讓每分鐘的 tick 觸發重算
    if (!isToday || !day) return -1;
    const now = nowMinutes();
    let idx = -1;
    day.items.forEach((it, i) => {
      const m = hhmmToMinutes(it.arrivalTime);
      if (m !== null && m <= now) idx = i;
    });
    return idx;
  }, [isToday, day, tick]);

  async function copyAddress(addr: string) {
    if (!addr) return;
    const ok = await copyToClipboard(addr);
    onToast(ok ? '地址已複製' : '複製失敗，請長按文字手動選取');
  }

  if (!day) {
    return <div className="mv-empty">這份行程沒有任何日期</div>;
  }

  const dayNote = printableDayNote(day);
  const marks = day.marks ?? [];

  return (
    <>
      <div className="mv-daybar" ref={barRef}>
        {trip.days.map((d, i) => {
          const count = d.items.filter((it) => !it.isHotel).length;
          return (
            <button
              key={d.id}
              data-day={i}
              className={`mv-daychip${i === dayIdx ? ' active' : ''}${d.date === todayISO ? ' today' : ''}`}
              onClick={() => onSelectDay(i)}
            >
              <span className="mv-daychip-top">
                <span className="mv-daychip-num">Day {d.dayIndex}</span>
                {(d.marks ?? []).map((m, k) => (
                  <span key={k} className="mv-daychip-mark" style={{ color: m.color }}>
                    <MarkGlyph glyph={m.glyph} />
                  </span>
                ))}
              </span>
              <span className="mv-daychip-date">{formatWithWeekday(d.date)}</span>
              <span className="mv-daychip-count">{count} 點</span>
            </button>
          );
        })}
      </div>

      <div className="mv-day">
        <div className="mv-day-head">
          <div className="mv-day-title">
            Day <em>{day.dayIndex}</em>
            {isToday && <span className="mv-today-tag">今天</span>}
          </div>
          <div className="mv-day-meta">
            {formatWithWeekday(day.date)}
            {day.city ? `　·　${day.city}` : ''}
          </div>
          {marks.length > 0 && (
            <div className="mv-day-marks">
              {marks.map((m, i) => {
                const label = legendMap.get(markKey(m.glyph, m.color));
                return (
                  <span key={i} className="mv-mark-chip">
                    <span style={{ color: m.color }}>
                      <MarkGlyph glyph={m.glyph} />
                    </span>
                    {label && <span className="mv-mark-label">{label}</span>}
                  </span>
                );
              })}
            </div>
          )}
          {todayIdx >= 0 && todayIdx !== dayIdx && (
            <button className="mv-jump-today" onClick={() => onSelectDay(todayIdx)}>
              跳到今天（Day {trip.days[todayIdx]?.dayIndex}）
            </button>
          )}
        </div>

        {dayNote && (
          <div className="mv-daynote">
            {dayNote.iconEmoji && (
              <span className="mv-daynote-icon" aria-hidden>
                {dayNote.iconEmoji}
              </span>
            )}
            <span className="mv-daynote-text">{dayNote.text}</span>
          </div>
        )}

        {day.items.length === 0 && !dayNote && <div className="mv-empty">這天還沒安排行程</div>}

        {day.items.map((item, idx) => {
          const legIn = idx > 0 ? day.legs[idx - 1] : undefined;
          const mode = legIn?.mode ?? 'driving';
          const { coordinates: c, placeId, name, address, phoneNumber } = item.place;
          const auto = getPlaceIcon(item.place.types, name);
          const emoji = item.place.iconEmoji ?? (item.isHotel ? '🏨' : auto?.icon);
          const pUrl = placeUrl(placeId, name, c.lat, c.lng);
          const nUrl = navigateUrl({ lat: c.lat, lng: c.lng, placeId }, mode);
          const tel = phoneNumber ? `tel:${phoneNumber.replace(/[^+\d]/g, '')}` : null;
          const state = idx === currentIdx ? 'now' : idx === currentIdx + 1 && currentIdx >= 0 ? 'next' : '';

          return (
            <div key={item.id}>
              {legIn && (
                <div className="mv-leg">
                  <span className="mv-leg-line" />
                  <span className="mv-leg-text">
                    {`${TRANSPORT_LABEL[legIn.mode] ?? legIn.mode}　·　${formatDuration(legIn.durationMinutes)}`}
                  </span>
                </div>
              )}

              <article className={`mv-card${state ? ` ${state}` : ''}`}>
                <div className="mv-card-side">
                  <span className="mv-num">{idx + 1}</span>
                  <span className="mv-time">
                    {item.arrivalTime}
                    {item.arrivalNextDay && <span className="mv-nextday">翌日</span>}
                  </span>
                </div>

                <div className="mv-card-body">
                  {state === 'now' && <span className="mv-state-tag now">現在</span>}
                  {state === 'next' && <span className="mv-state-tag next">下一站</span>}

                  <div className="mv-name-row">
                    {emoji && (
                      <span className="mv-place-icon" aria-hidden>
                        {emoji}
                      </span>
                    )}
                    {pUrl ? (
                      <a className="mv-name" href={pUrl} target="_blank" rel="noreferrer">
                        {name}
                        <span className="mv-arrow" aria-hidden>
                          ↗
                        </span>
                      </a>
                    ) : (
                      <span className="mv-name">{name}</span>
                    )}
                  </div>

                  <div className="mv-stay">{formatStayDuration(item.stayMinutes)}</div>

                  {address && (
                    <button className="mv-addr" onClick={() => copyAddress(address)} title="點一下複製地址">
                      {address}
                    </button>
                  )}

                  {cleanNotes(item.notes).length > 0 && (
                    <ul className="mv-notes">
                      {cleanNotes(item.notes).map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  )}

                  <div className="mv-card-actions">
                    <a className="mv-nav-btn" href={nUrl} target="_blank" rel="noreferrer">
                      <span aria-hidden>🧭</span> Google 導航
                    </a>
                    {tel && (
                      <a className="mv-call-btn" href={tel}>
                        <span aria-hidden>📞</span> 撥號
                      </a>
                    )}
                  </div>
                </div>
              </article>
            </div>
          );
        })}
      </div>
    </>
  );
}
