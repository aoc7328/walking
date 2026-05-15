import { useMemo } from 'react';
import { useSearchStore } from '../../stores/searchStore';
import { useUIStore } from '../../stores/uiStore';
import { useTripStore } from '../../stores/tripStore';
import SearchResultCard from '../search/SearchResultCard';

export default function LeftPanel() {
  const collapsed = useUIStore((s) => s.collapse.leftPanel);
  const toggle = useUIStore((s) => s.toggleCollapse);
  const results = useSearchStore((s) => s.results);
  const isLoading = useSearchStore((s) => s.isLoading);
  const error = useSearchStore((s) => s.error);
  const query = useSearchStore((s) => s.query);
  const currentDayId = useUIStore((s) => s.currentDayId);
  const trip = useTripStore((s) => s.trip);

  const currentDay = trip?.days.find((d) => d.id === currentDayId) ?? null;
  const favorites = trip?.favorites ?? [];
  const isSearching = query.trim() !== '' || results.length > 0 || isLoading || !!error;

  const favoritePlaceIds = useMemo(
    () => new Set(favorites.map((f) => f.placeId)),
    [favorites],
  );

  const sortedResults = useMemo(() => {
    if (!results.length) return results;
    const favored = results.filter((p) => favoritePlaceIds.has(p.placeId));
    const others = results.filter((p) => !favoritePlaceIds.has(p.placeId));
    return [...favored, ...others];
  }, [results, favoritePlaceIds]);

  // 標題與資料來源依「是否在搜尋」切換
  const title = isSearching ? '搜尋結果' : '我的收藏';
  const count = isSearching ? results.length : favorites.length;
  const listData = isSearching ? sortedResults : favorites;

  return (
    <>
      <aside className={`left-panel${collapsed ? ' collapsed' : ''}`}>
        <div className="left-panel-header">
          <span className="left-panel-title">{title}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="left-panel-count">{count} 筆</span>
            <button
              className="collapse-toggle"
              onClick={() => toggle('leftPanel')}
              style={{ width: 18, height: 18, fontSize: 13 }}
              title="收合左欄"
            >
              ◂
            </button>
          </div>
        </div>
        <div className="left-panel-list thin-scroll">
          {isLoading && <div className="empty-search">搜尋中…</div>}
          {error && <div className="empty-search">{error}</div>}
          {!isLoading && !error && listData.length === 0 && (
            <div className="empty-search">
              {isSearching ? '沒有結果' : '還沒有收藏的地點　·　點搜尋結果上的 ♡ 來收藏'}
            </div>
          )}
          {listData.map((place) => (
            <SearchResultCard key={place.id} place={place} dayIndex={currentDay?.dayIndex ?? null} />
          ))}
        </div>
      </aside>
      {collapsed && (
        <button className="expand-btn expand-left" onClick={() => toggle('leftPanel')} title="展開左欄">
          ▸
        </button>
      )}
    </>
  );
}
