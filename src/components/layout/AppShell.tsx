import { useEffect } from 'react';
import Header from './Header';
import SearchBar from './SearchBar';
import LeftPanel from './LeftPanel';
import MapPanel from './MapPanel';
import RightPanel from './RightPanel';
import DayStrip from './DayStrip';
import PlaceDetailModal from '../detail/PlaceDetailModal';
import ChangeStartDateModal from '../day/ChangeStartDateModal';
import NewTripModal from './NewTripModal';
import ShareModal from '../share/ShareModal';
import TripOverviewModal from '../overview/TripOverviewModal';
import DownloadModal from '../download/DownloadModal';
import LedgerPage from '../ledger/LedgerPage';
import NotesModal from '../notes/NotesModal';
import { useTripStore } from '../../stores/tripStore';
import { useUIStore } from '../../stores/uiStore';
import { useSearchStore } from '../../stores/searchStore';
import { loadActiveTrip, recordDailyBackup, migrateAccountData, persistTripKeepalive } from '../../db/repository';

export default function AppShell() {
  const trip = useTripStore((s) => s.trip);
  const setTrip = useTripStore((s) => s.setTrip);
  const reset = useTripStore((s) => s.reset);
  const currentDayId = useUIStore((s) => s.currentDayId);
  const setCurrentDay = useUIStore((s) => s.setCurrentDay);
  const collapse = useUIStore((s) => s.collapse);
  const closeDetail = useUIStore((s) => s.closeDetail);
  const closeDateModal = useUIStore((s) => s.closeDateModal);
  const closeLedgerModal = useUIStore((s) => s.closeLedgerModal);
  const searchResults = useSearchStore((s) => s.results);
  const searchQuery = useSearchStore((s) => s.query);
  const toggleCollapse = useUIStore((s) => s.toggleCollapse);

  // 啟動載入：先把 IndexedDB 舊資料遷移到 KV (一次性)，再從 KV 拉
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await migrateAccountData();
      if (cancelled) return;
      const loaded = await loadActiveTrip();
      if (cancelled) return;
      if (loaded) {
        setTrip(loaded);
      } else {
        reset();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setTrip, reset]);

  // 預設選第一天
  useEffect(() => {
    if (trip && !currentDayId && trip.days.length > 0) {
      const today = new Date();
      const todayItem = trip.days.find((d) => d.date === toISO(today));
      setCurrentDay(todayItem?.id ?? trip.days[0]!.id);
    }
  }, [trip, currentDayId, setCurrentDay]);

  // 每次變動：只做本地每日備份（Dexie，不耗 KV 次數）。
  // KV 寫入改成手動——使用者按 Header 的「儲存」鍵才寫，避免每動一下就燒 KV。
  useEffect(() => {
    if (!trip) return;
    recordDailyBackup(trip);
  }, [trip]);

  // 自動收合左欄：沒搜尋（無 query 無 results）且沒收藏 → 收合；有任一就展開
  useEffect(() => {
    const hasContent =
      searchResults.length > 0 || searchQuery.trim() !== '' || (trip?.favorites.length ?? 0) > 0;
    if (!hasContent && !collapse.leftPanel) {
      toggleCollapse('leftPanel');
    } else if (hasContent && collapse.leftPanel) {
      toggleCollapse('leftPanel');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchResults.length, searchQuery, trip?.favorites.length]);

  // 關閉分頁 / 離開頁面時的存檔保險（解決「忘了按儲存就關分頁，變更丟掉」）。
  // 事件當下才用 getState() 取最新狀態，所以這個監聽只需掛一次。
  // - 已存過的行程有未存變更 → keepalive 靜默把最新內容送回 KV，不打擾。
  // - 只有 mock 範例被改過（沒有可覆寫的目標，必須先取名另存）→ 跳瀏覽器原生「尚未儲存」確認框攔一下。
  //   註：beforeunload 的提示文字由瀏覽器決定，無法自訂（安全限制）。
  useEffect(() => {
    function flush() {
      const { trip: t, dirty, persisted } = useTripStore.getState();
      if (t && dirty && persisted) {
        persistTripKeepalive(t);
      }
    }
    function onBeforeUnload(e: BeforeUnloadEvent) {
      const { dirty, persisted } = useTripStore.getState();
      if (dirty && !persisted) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);

  // ESC 關閉 modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeDetail();
        closeDateModal();
        closeLedgerModal();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeDetail, closeDateModal, closeLedgerModal]);

  const mainClass = ['main', collapse.leftPanel ? 'no-left' : '', collapse.rightPanel ? 'no-right' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className="app">
      <Header />
      <SearchBar />
      <main className={mainClass}>
        <LeftPanel />
        <MapPanel />
        <RightPanel />
      </main>
      <DayStrip />
      <PlaceDetailModal />
      <ChangeStartDateModal />
      <NewTripModal />
      <ShareModal />
      <TripOverviewModal />
      <DownloadModal />
      <LedgerPage />
      <NotesModal />
    </div>
  );
}

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
