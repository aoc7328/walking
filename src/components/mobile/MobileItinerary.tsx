import { useEffect, useMemo, useRef, useState } from 'react';
import type { DayPlan, Trip } from '../../types/trip';
import { formatStayDuration, formatWithWeekday, hhmmToMinutes, toISODate } from '../../utils/date';
import { cleanNotes } from '../../utils/itemNotes';
import { formatDuration, TRANSPORT_LABEL } from '../../utils/format';
import { printableDayNote } from '../../utils/dayNote';
import { getPlaceIcon } from '../../utils/placeIcon';
import { getLedger, RESERVATION_LABEL } from '../../utils/ledger';
import { matchDayReservations, type ReservationMap } from '../../utils/reservationMatch';
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
  /** 點訂位燈號 → 跳到手牌分頁打開那張訂位牌。沒給就只顯示、不可點。 */
  onOpenReservation?: (restaurantId: string) => void;
}

/** 現在幾點（分鐘）。用來標「現在在這站 / 下一站」。 */
function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export default function MobileItinerary({ trip, dayIdx, onSelectDay, onToast, onOpenReservation }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0);

  const day: DayPlan | undefined = trip.days[dayIdx];
  const todayISO = toISODate(new Date());
  const isToday = day?.date === todayISO;
  const todayIdx = trip.days.findIndex((d) => d.date === todayISO);

  /**
   * 這天每一站對到的餐廳訂位（帳本 → 行程）。
   * 依賴用 day?.id 與訂位筆數，不用 day / ledger 物件：trip 只要有任何變動就是新物件，
   * 拿物件當依賴等於每次重繪都重算一次配對。
   */
  const ledger = getLedger(trip);
  const resvCount = ledger.restaurants.length;
  const resvMap = useMemo<ReservationMap>(
    () => (day ? matchDayReservations(day, ledger) : new Map()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [day?.id, day?.items.length, resvCount],
  );

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

  // 看的是今天時，每分鐘重算一次「現在在哪一站」。
  // ⚠️ 手機把背景分頁的計時器凍結，所以口袋裡放兩小時再打開，光靠 interval
  // 標記會停在收起來的那一刻。回到前景 / 視窗取得焦點時一定要再算一次。
  useEffect(() => {
    if (!isToday) return;
    const bump = () => setTick((t) => t + 1);
    const id = window.setInterval(bump, 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') bump();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', bump);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', bump);
    };
  }, [isToday]);

  /**
   * 「現在人在哪一站」與「下一站是哪一站」。不是今天就都回 -1。
   *
   * hereIdx 一定要看停留時間，不能只看「抵達時間過了沒」：
   * 09:34 到、待 60 分的一站，如果下一站排在 17:45，光看抵達時間會讓它整個下午
   * 都掛著「現在」，看起來像程式卡住（實際回報過）。離開之後就不算在那一站，
   * 這時候沒有任何站是「現在」，只顯示下一站還有多久——那才是真正有用的資訊。
   */
  const { hereIdx, nextIdx, nextInMin } = useMemo(() => {
    void tick; // 讓每分鐘的 tick 與回到前景觸發重算
    if (!isToday || !day) return { hereIdx: -1, nextIdx: -1, nextInMin: 0 };
    const now = nowMinutes();
    /** 跨過午夜的站算隔天，時間要加一整天才比得對。 */
    const arrivalOf = (it: (typeof day.items)[number]): number | null => {
      const m = hhmmToMinutes(it.arrivalTime);
      if (m === null) return null;
      return it.arrivalNextDay ? m + 24 * 60 : m;
    };
    let here = -1;
    let next = -1;
    for (let i = 0; i < day.items.length; i++) {
      const it = day.items[i]!;
      const arr = arrivalOf(it);
      if (arr === null) continue;
      if (arr <= now && now < arr + Math.max(1, it.stayMinutes)) here = i;
      if (next === -1 && arr > now) next = i;
    }
    const nextArr = next >= 0 ? arrivalOf(day.items[next]!) : null;
    return { hereIdx: here, nextIdx: next, nextInMin: nextArr === null ? 0 : nextArr - now };
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
          const state = idx === hereIdx ? 'now' : idx === nextIdx ? 'next' : '';
          const resv = resvMap.get(item.id);
          // 排的抵達時間比訂位時間還晚就要提醒（早到沒關係，遲到才是問題）
          const resvArr = resv?.time ? hhmmToMinutes(item.arrivalTime) : null;
          const resvSet = resv?.time ? hhmmToMinutes(resv.time) : null;
          const lateBy = resvArr !== null && resvSet !== null ? resvArr - resvSet : 0;
          // 每家店沒各自填人數時，用帳本的訂位預設（訂位牌本身也是這樣 fallback）
          const resvPax = resv ? resv.partySize ?? ledger.reservation?.partySize : undefined;

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
                  {state === 'next' && (
                    <span className="mv-state-tag next">
                      下一站{nextInMin > 0 ? `　·　${nextInMin >= 60 ? `${Math.floor(nextInMin / 60)} 小時${nextInMin % 60 ? ` ${nextInMin % 60} 分` : ''}` : `${nextInMin} 分`}後` : ''}
                    </span>
                  )}

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

                  {resv &&
                    (onOpenReservation ? (
                      <button
                        type="button"
                        className={`mv-resv-flag tappable s-${resv.status}`}
                        onClick={() => onOpenReservation(resv.id)}
                        title="打開訂位牌（給店家看的那一張）"
                      >
                        <span className="mv-resv-dot" aria-hidden />
                        <span className="mv-resv-label">{RESERVATION_LABEL[resv.status]}</span>
                        {resv.time && <span className="mv-resv-time">{resv.time}</span>}
                        {resvPax !== undefined && <span className="mv-resv-pax">{resvPax} 位</span>}
                        {lateBy > 10 && <span className="mv-resv-late">行程比訂位晚 {lateBy} 分</span>}
                        <span className="mv-resv-go" aria-hidden>訂位牌 ›</span>
                      </button>
                    ) : (
                      <div className={`mv-resv-flag s-${resv.status}`}>
                        <span className="mv-resv-dot" aria-hidden />
                        <span className="mv-resv-label">{RESERVATION_LABEL[resv.status]}</span>
                        {resv.time && <span className="mv-resv-time">{resv.time}</span>}
                        {resvPax !== undefined && <span className="mv-resv-pax">{resvPax} 位</span>}
                        {resv.bookingRef && <span className="mv-resv-ref">No. {resv.bookingRef}</span>}
                        {lateBy > 10 && <span className="mv-resv-late">行程比訂位晚 {lateBy} 分</span>}
                      </div>
                    ))}

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
