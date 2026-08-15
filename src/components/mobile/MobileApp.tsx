import { useCallback, useEffect, useRef, useState } from 'react';
import type { Trip } from '../../types/trip';
import { listAllTrips, loadActiveTrip, loadTripById, setActiveTripId } from '../../db/repository';
import { normalizeDaysForView } from '../../stores/tripStore';
import { addDays, formatRange, toISODate } from '../../utils/date';
import { setUIMode } from '../../utils/device';
import MobileItinerary from './MobileItinerary';
import MobileLedger from './MobileLedger';
import MobileCards from './MobileCards';
import MobileInfo from './MobileInfo';

/**
 * 手機版外殼。
 *
 * 定位：手機進來做四件事——看行程（然後開 Google 導航）、現場出示手牌（入境 QR /
 * 票券 / 餐廳訂位牌）、查住宿與固定支出這類「不常看但需要時一定要看得到」的資料、記流水帳。
 * 排行程一律回電腦版，所以這裡刻意沒有任何編輯行程的入口，也不載 Google Maps SDK
 * （不畫地圖 = 不產生 Maps API 費用；導航是丟給手機上的 Google Maps App 處理）。
 *
 * 寫入方面只有記帳會寫 KV，而且是「按一次『記一筆』才寫一次」，不是每打一個字寫一次。
 */

type Tab = 'trip' | 'cards' | 'info' | 'ledger';
type LoadState = 'loading' | 'ready' | 'error';

/** 離線快取：只留「目前這一份」行程，出國沒訊號時至少看得到。 */
const CACHE_KEY = 'walking.mobileTrip';

function readCache(): Trip | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as Trip;
    return t && Array.isArray(t.days) ? t : null;
  } catch {
    return null;
  }
}

function writeCache(trip: Trip): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(trip));
  } catch {
    // 空間不足 / 無痕模式：快取失敗不影響主流程
  }
}

/** 預設停在「今天」那一天；今天不在行程區間內就回第 1 天。 */
function defaultDayIndex(trip: Trip): number {
  const today = toISODate(new Date());
  const i = trip.days.findIndex((d) => d.date === today);
  return i >= 0 ? i : 0;
}

function tripRange(trip: Trip): string {
  if (trip.days.length === 0) return trip.startDate;
  return formatRange(trip.startDate, addDays(trip.startDate, trip.days.length - 1));
}

export default function MobileApp() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState<Tab>('trip');
  const [dayIdx, setDayIdx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [tripsLoading, setTripsLoading] = useState(false);

  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 1800);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  /**
   * 套用一份行程：正規化 → 更新畫面 + 寫離線快取 + 把日期挪到今天。
   *
   * 一定要先過 normalizeDaysForView：KV 存的抵達時間是「還沒重算」的原始值，
   * 電腦版載入時也會重算一次才畫。少了這步手機上每一站的時間都會跟電腦版對不起來。
   * 只影響顯示，不會把重算結果寫回雲端。
   */
  const applyTrip = useCallback((t: Trip, opts?: { keepDay?: boolean }) => {
    const normalized: Trip = { ...t, days: normalizeDaysForView(t.days) };
    setTrip(normalized);
    writeCache(normalized);
    if (!opts?.keepDay) setDayIdx(defaultDayIndex(normalized));
  }, []);

  // 開場載入：跟 KV 拿目前這份行程；拿不到就退到離線快取
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await loadActiveTrip();
      if (cancelled) return;
      if (loaded) {
        setOffline(false);
        applyTrip(loaded);
        setLoadState('ready');
        return;
      }
      const cached = readCache();
      if (cached) {
        setOffline(true);
        applyTrip(cached);
        setLoadState('ready');
      } else {
        setLoadState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyTrip]);

  async function handleRefresh() {
    if (!trip || refreshing) return;
    setRefreshing(true);
    const fresh = await loadTripById(trip.id);
    setRefreshing(false);
    if (fresh) {
      setOffline(false);
      applyTrip(fresh, { keepDay: true });
      showToast('已更新到最新版本');
    } else {
      showToast('連不上伺服器，顯示的是上次載入的內容');
      setOffline(true);
    }
  }

  async function openSheet() {
    setSheetOpen(true);
    if (trips !== null || tripsLoading) return;
    setTripsLoading(true);
    const all = await listAllTrips();
    setTripsLoading(false);
    setTrips(all);
  }

  function pickTrip(t: Trip) {
    setActiveTripId(t.id);
    setOffline(false);
    applyTrip(t);
    setSheetOpen(false);
    setTab('trip');
  }

  function toDesktop() {
    setUIMode('desktop');
    window.location.reload();
  }

  if (loadState === 'loading') {
    return (
      <div className="mv-root">
        <div className="mv-fullmsg">
          <div className="mv-fullmsg-title">讀取行程中…</div>
          <div className="mv-fullmsg-sub">正在跟雲端拿最新的行程</div>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="mv-root">
        <div className="mv-fullmsg">
          <div className="mv-fullmsg-title">還沒有行程</div>
          <div className="mv-fullmsg-sub">
            這個帳號在雲端還沒有任何行程，或是目前連不上網路。
            <br />
            行程請在電腦版建立與編輯。
          </div>
          <div className="mv-fullmsg-actions">
            <button className="mv-btn" onClick={() => window.location.reload()}>
              重新載入
            </button>
            <button className="mv-btn" onClick={toDesktop}>
              切換到電腦版
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mv-root">
      <header className="mv-header">
        <button className="mv-header-main" onClick={openSheet} title="切換行程">
          <span className="mv-trip-name">
            {trip.name}
            <span className="mv-caret" aria-hidden>
              ⌄
            </span>
          </span>
          <span className="mv-trip-meta">
            {tripRange(trip)}　·　{trip.days.length} 天
            {offline && <span className="mv-offline-tag">離線</span>}
          </span>
        </button>
        <button
          className="mv-icon-btn"
          onClick={handleRefresh}
          disabled={refreshing}
          title="重新抓最新行程"
          aria-label="重新整理"
        >
          <span aria-hidden className={refreshing ? 'mv-spin' : ''}>
            ↻
          </span>
        </button>
      </header>

      <div className="mv-scroll">
        {tab === 'trip' && (
          <MobileItinerary
            trip={trip}
            dayIdx={dayIdx}
            onSelectDay={setDayIdx}
            onToast={showToast}
          />
        )}
        {tab === 'cards' && <MobileCards trip={trip} />}
        {tab === 'info' && <MobileInfo trip={trip} />}
        {tab === 'ledger' && (
          <MobileLedger trip={trip} onTripChange={(t) => applyTrip(t, { keepDay: true })} onToast={showToast} />
        )}
      </div>

      <nav className="mv-tabbar">
        <button
          className={`mv-tab${tab === 'trip' ? ' active' : ''}`}
          onClick={() => setTab('trip')}
        >
          <span className="mv-tab-icon" aria-hidden>
            🧭
          </span>
          <span>行程</span>
        </button>
        <button
          className={`mv-tab${tab === 'cards' ? ' active' : ''}`}
          onClick={() => setTab('cards')}
        >
          <span className="mv-tab-icon" aria-hidden>
            🪪
          </span>
          <span>手牌</span>
        </button>
        <button
          className={`mv-tab${tab === 'info' ? ' active' : ''}`}
          onClick={() => setTab('info')}
        >
          <span className="mv-tab-icon" aria-hidden>
            🏨
          </span>
          <span>資料</span>
        </button>
        <button
          className={`mv-tab${tab === 'ledger' ? ' active' : ''}`}
          onClick={() => setTab('ledger')}
        >
          <span className="mv-tab-icon" aria-hidden>
            🧾
          </span>
          <span>記帳</span>
        </button>
      </nav>

      {sheetOpen && (
        <div
          className="mv-sheet-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSheetOpen(false);
          }}
        >
          <div className="mv-sheet">
            <div className="mv-sheet-head">
              <span>切換行程</span>
              <button className="mv-sheet-close" onClick={() => setSheetOpen(false)} aria-label="關閉">
                ×
              </button>
            </div>
            <div className="mv-sheet-body">
              {tripsLoading && <div className="mv-sheet-hint">讀取中…</div>}
              {!tripsLoading && trips !== null && trips.length === 0 && (
                <div className="mv-sheet-hint">雲端沒有其他行程</div>
              )}
              {!tripsLoading &&
                trips?.map((t) => (
                  <button
                    key={t.id}
                    className={`mv-sheet-item${t.id === trip.id ? ' current' : ''}`}
                    onClick={() => pickTrip(t)}
                  >
                    <span className="mv-sheet-item-name">{t.name}</span>
                    <span className="mv-sheet-item-meta">
                      {tripRange(t)}　·　{t.days.length} 天
                    </span>
                  </button>
                ))}
            </div>
            <div className="mv-sheet-foot">
              <button className="mv-btn" onClick={toDesktop}>
                切換到電腦版（排行程用）
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="mv-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
