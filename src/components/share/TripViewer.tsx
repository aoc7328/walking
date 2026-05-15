import { useEffect, useMemo, useState } from 'react';
import { decodeShareFromHash, type SharePayload, type ShareDay, type ShareItem, type ShareLeg } from '../../services/share';
import { addDays, formatWithWeekday, formatStayDuration } from '../../utils/date';
import { TRANSPORT_LABEL, formatDuration } from '../../utils/format';
import { buildStaticMapUrl, hasApiKey } from '../../services/googleMaps';

function placeUrl(placeId?: string, name?: string, lat?: number, lng?: number): string | null {
  if (placeId) {
    return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
  }
  if (name && lat !== undefined && lng !== undefined) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=&z=16&center=${lat},${lng}`;
  }
  return null;
}

function directionsUrl(
  origin: { la: number; lo: number },
  dest: { la: number; lo: number; p?: string },
  mode: string,
): string {
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.la},${origin.lo}`,
    destination: `${dest.la},${dest.lo}`,
    travelmode: mode,
  });
  if (dest.p) params.set('destination_place_id', dest.p);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function DayBlock({ day, dayIndex, startDate }: { day: ShareDay; dayIndex: number; startDate: string }) {
  const date = addDays(startDate, dayIndex - 1);

  const staticMapUrl = useMemo(() => {
    if (!hasApiKey() || day.i.length === 0) return null;
    return buildStaticMapUrl(
      day.i.map((it, idx) => ({
        lat: it.la,
        lng: it.lo,
        label: it.h ? 'H' : String(idx + 1),
        color: it.h ? 'purple' : 'green',
      })),
      '600x320',
    );
  }, [day]);

  let nonHotelCount = 0;
  return (
    <section className="tv-day">
      <header className="tv-day-head">
        <div className="tv-day-title">
          Day <em>{dayIndex}</em>
        </div>
        <div className="tv-day-meta">
          {formatWithWeekday(date)}
          {day.c ? `　·　${day.c}` : ''}
        </div>
      </header>

      {staticMapUrl && <img className="tv-static-map" src={staticMapUrl} alt={`Day ${dayIndex} 地圖`} />}

      <div className="tv-items">
        {day.i.map((it: ShareItem, idx) => {
          const leg: ShareLeg | undefined = idx > 0 ? day.l[idx - 1] : undefined;
          const legMode = leg?.m ?? 'driving';
          const prev = idx > 0 ? day.i[idx - 1] : null;
          const pUrl = placeUrl(it.p, it.n, it.la, it.lo);
          const navUrl = prev ? directionsUrl({ la: prev.la, lo: prev.lo }, { la: it.la, lo: it.lo, p: it.p }, legMode) : null;
          let label: string;
          if (it.h) {
            const isFirstHotel = idx === 0;
            const isLastHotel = idx === day.i.length - 1;
            label = isFirstHotel ? 'S' : isLastHotel ? 'E' : 'H';
          } else {
            nonHotelCount += 1;
            label = String(nonHotelCount);
          }
          return (
            <div key={idx}>
              {leg && (
                <div className="tv-leg">
                  <span className="tv-leg-line" />
                  <span className="tv-leg-mode">{TRANSPORT_LABEL[legMode] ?? legMode}</span>
                  <span className="tv-leg-divider">·</span>
                  <span>{formatDuration(leg.t)}</span>
                </div>
              )}
              <article className="tv-card">
                <div className={`tv-marker${it.h ? ' hotel' : ''}`}>{label}</div>
                <div className="tv-card-body">
                  {!it.h && idx > 0 && <div className="tv-time">{it.t}</div>}
                  <div className="tv-name-row">
                    {pUrl ? (
                      <a href={pUrl} target="_blank" rel="noreferrer" className="tv-name">
                        {it.n} <span className="tv-arrow">↗</span>
                      </a>
                    ) : (
                      <span className="tv-name">{it.n}</span>
                    )}
                  </div>
                  <div className="tv-stay">{formatStayDuration(it.s)}</div>
                  <div className="tv-addr">{it.a}</div>
                  {it.no && it.no.length > 0 && (
                    <ul className="tv-notes">
                      {it.no.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  )}
                  {navUrl && (
                    <a className="tv-nav-btn" href={navUrl} target="_blank" rel="noreferrer">
                      🧭 導航到這裡
                    </a>
                  )}
                </div>
              </article>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function TripViewer() {
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [activeDay, setActiveDay] = useState(0);

  useEffect(() => {
    const decoded = decodeShareFromHash();
    setPayload(decoded);
    function onHash() {
      setPayload(decodeShareFromHash());
    }
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (!payload) {
    return (
      <div className="tv-root">
        <div className="tv-empty">
          <h2>無法載入行程</h2>
          <p>分享連結看起來不完整。請向分享者重新索取。</p>
        </div>
      </div>
    );
  }

  const day = payload.d[activeDay];

  return (
    <div className="tv-root">
      <header className="tv-header">
        <h1 className="tv-trip-name">{payload.n}</h1>
        <div className="tv-trip-meta">
          {payload.s}　·　{payload.d.length} 天
        </div>
      </header>

      <nav className="tv-day-tabs">
        {payload.d.map((d, i) => {
          const dDate = addDays(payload.s, i);
          return (
            <button
              key={i}
              className={`tv-day-tab${i === activeDay ? ' active' : ''}`}
              onClick={() => setActiveDay(i)}
            >
              <span className="tv-day-tab-date">{formatWithWeekday(dDate)}</span>
              <span className="tv-day-tab-num">
                Day <em>{i + 1}</em>
              </span>
              <span className="tv-day-tab-count">{d.i.filter((it) => !it.h).length} 點</span>
            </button>
          );
        })}
      </nav>

      {day && <DayBlock day={day} dayIndex={activeDay + 1} startDate={payload.s} />}

      <footer className="tv-footer">
        由「胖齊肥柔去走走」分享 · 點地點名可看 Google Maps 介紹
      </footer>
    </div>
  );
}
