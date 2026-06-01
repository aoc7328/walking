import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchStore } from '../../stores/searchStore';
import { useUIStore } from '../../stores/uiStore';
import { useTripStore } from '../../stores/tripStore';
import type { DayPlan } from '../../types/trip';
import SearchIcon from '../common/icons/SearchIcon';
import { useSearch, parseLatLng } from '../../hooks/useSearch';

export default function SearchBar() {
  const collapsed = useUIStore((s) => s.collapse.searchBar);
  const toggle = useUIStore((s) => s.toggleCollapse);
  const query = useSearchStore((s) => s.query);
  const setQuery = useSearchStore((s) => s.setQuery);
  const clear = useSearchStore((s) => s.clear);
  const history = useSearchStore((s) => s.history);
  const removeFromHistory = useSearchStore((s) => s.removeFromHistory);
  const clearHistory = useSearchStore((s) => s.clearHistory);
  const currentDayId = useUIStore((s) => s.currentDayId);
  const trip = useTripStore((s) => s.trip);
  const { runSearch, addByCoordinates } = useSearch();

  const [historyOpen, setHistoryOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  // 自動搜尋的 debounce timer；手動搜尋（Enter / 點歷史）前要先清掉它，避免重複觸發
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 點歷史會 setQuery 又手動搜尋；標記「下一次 effect 若是這字串就跳過」避免搜兩次
  const skipNextRef = useRef<string | null>(null);

  // 搜尋的地理「偏好」中心：優先取目前這天第一個有座標的點，否則整個行程第一個。
  // 只用來把附近結果往前排，不會排除遠處／海外的地點。沒有任何座標就不偏好（全域搜）。
  const biasCenter = useMemo<{ lat: number; lng: number } | undefined>(() => {
    if (!trip) return undefined;
    const pick = (day: DayPlan | undefined) =>
      day?.items.find((it) => Number.isFinite(it.place.coordinates.lat))?.place.coordinates;
    return pick(trip.days.find((d) => d.id === currentDayId)) ?? trip.days.map(pick).find(Boolean);
  }, [trip, currentDayId]);
  const biasRef = useRef(biasCenter);
  biasRef.current = biasCenter;

  // 打字 400ms 後自動搜尋。但若輸入看起來是座標，不自動觸發
  //（否則打字打到一半就跳 prompt 很煩）——等使用者按 Enter 再處理。
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    if (parseLatLng(q)) return;
    if (skipNextRef.current === q) {
      // 這次是剛剛手動搜尋過的字串，別再自動搜一次
      skipNextRef.current = null;
      return;
    }
    debounceRef.current = setTimeout(() => {
      runSearch(q, biasRef.current);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, currentDayId, runSearch]);

  function triggerSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    // 先取消還在排隊的自動搜尋，避免等一下又搜一次
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setHistoryOpen(false);
    // 座標格式 → 走手動加入（prompt 名稱）
    const coord = parseLatLng(trimmed);
    if (coord) {
      addByCoordinates(coord.lat, coord.lng);
      return;
    }
    runSearch(trimmed, biasRef.current);
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && query.trim()) {
      triggerSearch(query);
    } else if (e.key === 'Escape') {
      setHistoryOpen(false);
    }
  }

  function handleHistoryClick(q: string) {
    // setQuery 會觸發 debounce effect，先標記讓它跳過，避免和下面的手動搜尋重複
    skipNextRef.current = q.trim();
    setQuery(q);
    triggerSearch(q);
  }

  // 點外面關掉下拉
  useEffect(() => {
    if (!historyOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setHistoryOpen(false);
      }
    }
    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, [historyOpen]);

  const showHistory = historyOpen && history.length > 0 && query.trim() === '';

  return (
    <div className={`search-bar-wrap${collapsed ? ' collapsed' : ''}`}>
      <div className="search-content">
        <div className="search-input-wrap" ref={wrapRef}>
          <SearchIcon />
          <input
            className="search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            onFocus={() => setHistoryOpen(true)}
            onClick={() => setHistoryOpen(true)}
            placeholder="搜尋地點、餐廳、景點　·　貼 Google Maps 連結　·　或貼經緯度（如 -45.03, 168.66）"
          />
          {query && (
            <button
              className="search-clear"
              onMouseDown={(e) => {
                e.preventDefault();
                clear();
                setHistoryOpen(false);
              }}
            >
              ✕　清除
            </button>
          )}
          {showHistory && (
            <div className="search-history-dropdown">
              <div className="search-history-header">
                <span>最近搜尋</span>
                <button className="search-history-clear" onMouseDown={(e) => { e.preventDefault(); clearHistory(); }}>
                  全部清除
                </button>
              </div>
              {history.map((h) => (
                <div
                  key={h}
                  className="search-history-item"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleHistoryClick(h);
                  }}
                >
                  <span className="search-history-icon">🔍</span>
                  <span className="search-history-text">{h}</span>
                  <button
                    className="search-history-remove"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeFromHistory(h);
                    }}
                    title="從歷史移除"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <button className="collapse-toggle" onClick={() => toggle('searchBar')} title="收合搜尋列">
          ▴
        </button>
      </div>
      {collapsed && (
        <button className="expand-btn expand-search" onClick={() => toggle('searchBar')} title="展開搜尋列">
          ▾
        </button>
      )}
    </div>
  );
}
