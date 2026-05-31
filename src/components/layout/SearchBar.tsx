import { useEffect, useRef, useState } from 'react';
import { useSearchStore } from '../../stores/searchStore';
import { useUIStore } from '../../stores/uiStore';
import { useTripStore } from '../../stores/tripStore';
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

  const currentDay = trip?.days.find((d) => d.id === currentDayId) ?? null;

  // 打字 400ms 後自動搜尋。但若輸入看起來是座標，不自動觸發
  //（否則打字打到一半就跳 prompt 很煩）——等使用者按 Enter 再處理。
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    if (parseLatLng(q)) return;
    const t = setTimeout(() => {
      runSearch(q, currentDay?.city);
    }, 400);
    return () => clearTimeout(t);
  }, [query, currentDay?.city, runSearch]);

  function triggerSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setHistoryOpen(false);
    // 座標格式 → 走手動加入（prompt 名稱）
    const coord = parseLatLng(trimmed);
    if (coord) {
      addByCoordinates(coord.lat, coord.lng);
      return;
    }
    runSearch(trimmed, currentDay?.city);
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && query.trim()) {
      triggerSearch(query);
    } else if (e.key === 'Escape') {
      setHistoryOpen(false);
    }
  }

  function handleHistoryClick(q: string) {
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
