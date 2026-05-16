import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readShareHash, fetchTripById, type ShareTrip, type ShareDay, type ShareItem, type ShareLeg } from '../../services/share';
import { addDays, formatRange, formatWithWeekday, formatStayDuration } from '../../utils/date';
import { TRANSPORT_LABEL, formatDuration } from '../../utils/format';
import { buildStaticMapUrl, buildStaticMapWithPath, hasApiKey } from '../../services/googleMaps';

/** 嘗試把字串塞進剪貼簿。失敗回 false（給 caller 顯示 fallback）。 */
async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through
    }
  }
  // Fallback：用 textarea + execCommand
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * 開到 Google Maps 的地點頁面。
 *
 * Google 把舊格式 `?q=place_id:xxx` 廢了，現在會被當字面字串去搜，結果是「找不到結果，
 * 改用 Google 搜尋」。改用官方文件的格式：
 *
 *   https://www.google.com/maps/search/?api=1&query=<name>&query_place_id=<id>
 *
 * `query` 給名字當顯示與 fallback，`query_place_id` 才是真正的 place 對應依據。
 */
function placeUrl(placeId?: string, name?: string, lat?: number, lng?: number): string | null {
  if (name) {
    const params = new URLSearchParams({ api: '1', query: name });
    if (placeId) params.set('query_place_id', placeId);
    return `https://www.google.com/maps/search/?${params.toString()}`;
  }
  if (lat !== undefined && lng !== undefined) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
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

/**
 * 整段行程總覽 Modal。
 * 取每天「第一個非飯店點」當代表 → 用 Static Maps 畫所有代表點 + 連線。
 * Static Maps 的 label 只能顯示單字元，所以 Day 10+ 不放 label（節點還是會在）。
 */
function OverviewModal({
  payload,
  onClose,
}: {
  payload: ShareTrip;
  onClose: () => void;
}) {
  const endDate = addDays(payload.s, payload.d.length - 1);

  const data = useMemo(() => {
    const points: { lat: number; lng: number; dayIndex: number; name: string }[] = [];
    for (let i = 0; i < payload.d.length; i++) {
      const day = payload.d[i]!;
      const pick =
        day.i.find((it) => !it.h && Number.isFinite(it.la) && Number.isFinite(it.lo)) ??
        day.i.find((it) => Number.isFinite(it.la) && Number.isFinite(it.lo));
      if (!pick) continue;
      points.push({ lat: pick.la, lng: pick.lo, dayIndex: i + 1, name: pick.n });
    }
    // 列出每天的代表點座標，方便對照「跑去瑞典」的是哪一天
    // 紐西蘭合法範圍：lat ∈ [-47, -34]、lng ∈ [166, 179]
    console.log('[overview] day markers:', points);
    const suspicious = points.filter(
      (p) => p.lat > 0 || p.lat < -90 || p.lng < 0 || p.lng > 180,
    );
    if (suspicious.length > 0) {
      console.warn('[overview] 可疑座標（非南半球/異常經度）：', suspicious);
    }
    return points;
  }, [payload]);

  const mapUrl = useMemo(() => {
    if (!hasApiKey() || data.length === 0) return null;
    return buildStaticMapWithPath(
      data.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        // Static Maps 只認單 ASCII char。1–9 有 label，10+ 只剩圓點。
        label: p.dayIndex <= 9 ? String(p.dayIndex) : undefined,
      })),
      data.map((p) => ({ lat: p.lat, lng: p.lng })),
      '800x500',
    );
  }, [data]);

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="tv-overview-modal">
        <header className="tv-overview-head">
          <div>
            <div className="tv-overview-title">{payload.n}</div>
            <div className="tv-overview-sub">
              {formatRange(payload.s, endDate)}　·　共 {payload.d.length} 天
            </div>
          </div>
          <button className="tv-overview-close" onClick={onClose} aria-label="關閉">
            ×
          </button>
        </header>

        <div className="tv-overview-body">
          {mapUrl ? (
            <img
              className="tv-overview-map"
              src={mapUrl}
              alt="整段行程地圖"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="tv-overview-empty">沒有可顯示的地點座標</div>
          )}

          <ul className="tv-overview-daylist">
            {payload.d.map((d, i) => {
              const dDate = addDays(payload.s, i);
              const visible = d.i.filter((it) => !it.h);
              const first = visible[0]?.n ?? '（飯店日）';
              return (
                <li key={i} className="tv-overview-dayitem">
                  <span className="tv-overview-daynum">{i + 1}</span>
                  <div className="tv-overview-dayinfo">
                    <div className="tv-overview-dayline">{first}</div>
                    <div className="tv-overview-dayline-sub">
                      {formatWithWeekday(dDate)}　·　{visible.length} 點
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function DayBlock({
  day,
  dayIndex,
  startDate,
  onToast,
}: {
  day: ShareDay;
  dayIndex: number;
  startDate: string;
  onToast: (msg: string) => void;
}) {
  const date = addDays(startDate, dayIndex - 1);

  const staticMapUrl = useMemo(() => {
    if (!hasApiKey() || day.i.length === 0) return null;
    return buildStaticMapUrl(
      day.i
        .map((it, idx) => {
          const n = idx + 1;
          return {
            lat: it.la,
            lng: it.lo,
            // 1–9 顯示數字、10+ 無 label（Static Maps 單字元限制，廢除 H 字母）
            label: n <= 9 ? String(n) : undefined,
          };
        })
        // 過濾掉沒有合法座標的 item，避免 Google geocode 出隨機點
        .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng)),
      '600x320',
    );
  }, [day]);

  async function handleCopyAddress(addr: string) {
    if (!addr) return;
    const ok = await copyToClipboard(addr);
    onToast(ok ? '地址已複製' : '複製失敗，請手動長按選取');
  }

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

      {staticMapUrl && (
        <img
          className="tv-static-map"
          src={staticMapUrl}
          alt={`Day ${dayIndex} 地圖`}
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}

      <div className="tv-items">
        {day.i.map((it: ShareItem, idx) => {
          const leg: ShareLeg | undefined = idx > 0 ? day.l[idx - 1] : undefined;
          const legMode = leg?.m ?? 'driving';
          const prev = idx > 0 ? day.i[idx - 1] : null;
          const pUrl = placeUrl(it.p, it.n, it.la, it.lo);
          const navUrl = prev ? directionsUrl({ la: prev.la, lo: prev.lo }, { la: it.la, lo: it.lo, p: it.p }, legMode) : null;
          const label = String(idx + 1);
          const telHref = it.ph ? `tel:${it.ph.replace(/[^+\d]/g, '')}` : null;
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
                <div className="tv-marker">{label}</div>
                <div className="tv-card-body">
                  {idx > 0 && <div className="tv-time">{it.t}</div>}
                  <div className="tv-name-row">
                    {it.e && <span className="tv-icon" aria-hidden>{it.e}</span>}
                    {pUrl ? (
                      <a href={pUrl} target="_blank" rel="noreferrer" className="tv-name">
                        {it.n} <span className="tv-arrow">↗</span>
                      </a>
                    ) : (
                      <span className="tv-name">{it.n}</span>
                    )}
                  </div>
                  <div className="tv-stay">{formatStayDuration(it.s)}</div>
                  {it.a && (
                    <button
                      type="button"
                      className="tv-addr"
                      onClick={() => handleCopyAddress(it.a)}
                      title="點擊複製地址"
                    >
                      {it.a}
                    </button>
                  )}
                  {telHref && (
                    <a className="tv-phone" href={telHref}>
                      <span aria-hidden>📞</span>
                      <span>{it.ph}</span>
                    </a>
                  )}
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
  const [payload, setPayload] = useState<ShareTrip | null>(null);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [activeDay, setActiveDay] = useState(0);
  const [toastMsg, setToastMsg] = useState<string>('');
  const [overviewOpen, setOverviewOpen] = useState(false);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(''), 1600);
  }, []);

  const handleReshare = useCallback(async () => {
    if (!payload) return;
    const shareUrl = window.location.href;
    // 優先用系統原生分享面板（手機通常都支援、桌機 Safari/Edge 也部分支援）
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: payload.n,
          text: `${payload.n}　·　行程分享`,
          url: shareUrl,
        });
        return;
      } catch {
        // 使用者按取消 / 系統拒絕 → 退到複製連結
      }
    }
    const ok = await copyToClipboard(shareUrl);
    showToast(ok ? '連結已複製，貼給朋友吧' : '複製失敗，請手動長按網址複製');
  }, [payload, showToast]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFromHash() {
      const r = readShareHash();
      if (!r) {
        if (!cancelled) {
          setPayload(null);
          setLoadState('error');
          setErrorMsg('分享連結看起來不完整。請向分享者重新索取。');
        }
        return;
      }
      if (r.type === 'inline') {
        if (!cancelled) {
          setPayload(r.trip);
          setLoadState('idle');
        }
        return;
      }
      // type === 'id'，跟 KV 拿
      if (!cancelled) setLoadState('loading');
      const trip = await fetchTripById(r.id);
      if (cancelled) return;
      if (trip) {
        setPayload(trip);
        setLoadState('idle');
      } else {
        setLoadState('error');
        setErrorMsg('找不到該行程。可能已過期（180 天）或 ID 錯誤。');
      }
    }

    loadFromHash();
    function onHash() {
      loadFromHash();
    }
    window.addEventListener('hashchange', onHash);
    return () => {
      cancelled = true;
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  if (loadState === 'loading') {
    return (
      <div className="tv-root">
        <div className="tv-empty">
          <h2>讀取中…</h2>
          <p>正在從伺服器載入行程資料</p>
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="tv-root">
        <div className="tv-empty">
          <h2>無法載入行程</h2>
          <p>{errorMsg || '分享連結看起來不完整。請向分享者重新索取。'}</p>
        </div>
      </div>
    );
  }

  const day = payload.d[activeDay];
  const endDate = addDays(payload.s, payload.d.length - 1);

  return (
    <div className="tv-root">
      <header className="tv-header">
        <div className="tv-header-text">
          <h1 className="tv-trip-name">{payload.n}</h1>
          <div className="tv-trip-meta">
            {formatRange(payload.s, endDate)}　·　{payload.d.length} 天
          </div>
        </div>
        <div className="tv-header-actions">
          <button
            type="button"
            className="tv-header-btn"
            onClick={() => setOverviewOpen(true)}
            title="整段行程總覽地圖"
            aria-label="整段行程總覽"
          >
            <span aria-hidden>🗺</span>
          </button>
          <button
            type="button"
            className="tv-header-btn"
            onClick={handleReshare}
            title="再分享給其他人"
            aria-label="再分享"
          >
            <span aria-hidden>📤</span>
          </button>
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

      {day && (
        <DayBlock
          day={day}
          dayIndex={activeDay + 1}
          startDate={payload.s}
          onToast={showToast}
        />
      )}

      <footer className="tv-footer">
        由「胖齊肥柔去走走」分享 · 點地點名可看 Google Maps 介紹
      </footer>

      {overviewOpen && <OverviewModal payload={payload} onClose={() => setOverviewOpen(false)} />}

      {toastMsg && <div className="tv-toast" role="status">{toastMsg}</div>}
    </div>
  );
}
