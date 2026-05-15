import { useEffect } from 'react';
import { useSearchStore } from '../../stores/searchStore';
import { useUIStore } from '../../stores/uiStore';
import { useTripStore } from '../../stores/tripStore';
import SearchIcon from '../common/icons/SearchIcon';
import { useSearch } from '../../hooks/useSearch';

export default function SearchBar() {
  const collapsed = useUIStore((s) => s.collapse.searchBar);
  const toggle = useUIStore((s) => s.toggleCollapse);
  const query = useSearchStore((s) => s.query);
  const setQuery = useSearchStore((s) => s.setQuery);
  const clear = useSearchStore((s) => s.clear);
  const currentDayId = useUIStore((s) => s.currentDayId);
  const trip = useTripStore((s) => s.trip);
  const { runSearch } = useSearch();

  const currentDay = trip?.days.find((d) => d.id === currentDayId) ?? null;

  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim()) runSearch(query.trim(), currentDay?.city);
    }, 400);
    return () => clearTimeout(t);
  }, [query, currentDay?.city, runSearch]);

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && query.trim()) {
      runSearch(query.trim(), currentDay?.city);
    }
  }

  return (
    <div className={`search-bar-wrap${collapsed ? ' collapsed' : ''}`}>
      <div className="search-content">
        <div className="search-input-wrap">
          <SearchIcon />
          <input
            className="search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="搜尋地點、餐廳、景點　·　或貼上 Google Maps 連結"
          />
          {query && (
            <button className="search-clear" onClick={clear}>
              ✕　清除
            </button>
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
