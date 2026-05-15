import type { Place } from '../../types/place';
import { useTripStore } from '../../stores/tripStore';
import { useUIStore } from '../../stores/uiStore';

const TYPE_LABELS: Record<string, string> = {
  lodging: '住宿',
  restaurant: '餐廳',
  cafe: '咖啡店',
  bar: '酒吧',
  bakery: '麵包店',
  meal_takeaway: '外帶',
  meal_delivery: '外送',
  food: '餐廳',
  tourist_attraction: '景點',
  museum: '博物館',
  park: '公園',
  shopping_mall: '購物中心',
  store: '商店',
  convenience_store: '便利商店',
  point_of_interest: '景點',
};

function translateType(types: string[]): string | null {
  for (const t of types) {
    if (TYPE_LABELS[t]) return TYPE_LABELS[t]!;
  }
  return null;
}

export default function SearchResultCard({ place, dayIndex }: { place: Place; dayIndex: number | null }) {
  const addToDay = useTripStore((s) => s.addItemToDay);
  const toggleFavorite = useTripStore((s) => s.toggleFavorite);
  const isFavorited = useTripStore((s) => s.isFavorited);
  const currentDayId = useUIStore((s) => s.currentDayId);
  const openDetail = useUIStore((s) => s.openDetail);

  const fav = isFavorited(place.placeId);
  const photoUrl = place.photoUrls?.[0];
  const typeLabel = translateType(place.types);

  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation();
    if (!currentDayId) return;
    addToDay(currentDayId, place);
  }

  function handleFav(e: React.MouseEvent) {
    e.stopPropagation();
    toggleFavorite(place);
  }

  return (
    <div className="place-card-row" onClick={() => openDetail(place.placeId, 'search')}>
      <div className="place-card-row-body">
        <div className="place-card-row-name">{place.name}</div>
        <div className="place-card-row-meta">
          {place.rating !== undefined && (
            <span className="place-card-row-rating">★ {place.rating.toFixed(1)}</span>
          )}
          {place.reviewCount !== undefined && (
            <span className="place-card-row-reviews">({place.reviewCount})</span>
          )}
          {typeLabel && <span className="place-card-row-type">{typeLabel}</span>}
        </div>
        <div className="place-card-row-address" title={place.address}>
          {place.address || '地址未提供'}
        </div>
        <div className="place-card-row-actions">
          <button
            className={`icon-btn${fav ? ' favorited' : ''}`}
            onClick={handleFav}
            title={fav ? '已收藏' : '收藏'}
          >
            {fav ? '♥' : '♡'}
          </button>
          <button
            className="icon-btn add"
            onClick={handleAdd}
            title={dayIndex !== null ? `加入 Day ${dayIndex}` : '請先選擇日期'}
            disabled={dayIndex === null}
          >
            +
          </button>
        </div>
      </div>
      {photoUrl && (
        <div
          className="place-card-row-thumb"
          style={{ backgroundImage: `url(${photoUrl})` }}
        />
      )}
    </div>
  );
}
