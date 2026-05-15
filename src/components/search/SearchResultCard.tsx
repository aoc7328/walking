import type { Place } from '../../types/place';
import { useTripStore } from '../../stores/tripStore';
import { useUIStore } from '../../stores/uiStore';

const GRADIENT_CLASSES = ['warm', 'dusty', 'green', 'blue', ''];

function pickGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % GRADIENT_CLASSES.length;
  return GRADIENT_CLASSES[idx]!;
}

export default function SearchResultCard({ place, dayIndex }: { place: Place; dayIndex: number | null }) {
  const addToDay = useTripStore((s) => s.addItemToDay);
  const toggleFavorite = useTripStore((s) => s.toggleFavorite);
  const isFavorited = useTripStore((s) => s.isFavorited);
  const currentDayId = useUIStore((s) => s.currentDayId);
  const openDetail = useUIStore((s) => s.openDetail);

  const fav = isFavorited(place.placeId);
  const photoUrl = place.photoUrls?.[0];

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
    <div className="place-card" onClick={() => openDetail(place.placeId, 'search')}>
      <div
        className={`place-card-image ${pickGradient(place.name)}`}
        style={photoUrl ? { backgroundImage: `url(${photoUrl})` } : undefined}
      >
        {!photoUrl && <span className="place-card-image-label">photograph</span>}
      </div>
      <div className="place-card-body">
        <div className="place-card-name">{place.name}</div>
        <div className="place-card-meta">
          {place.rating !== undefined && <span className="place-card-star">★ {place.rating.toFixed(1)}</span>}
          {place.rating !== undefined && place.address && '　·　'}
          {place.address.split(/[縣市區]/).filter(Boolean).slice(-1)[0]?.slice(0, 6) ?? place.address.slice(0, 8)}
          {place.reviewCount ? `　·　${place.reviewCount} 評` : ''}
        </div>
        <div className="place-card-actions">
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
    </div>
  );
}
