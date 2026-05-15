import { useEffect, useMemo, useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useTripStore } from '../../stores/tripStore';
import { useSearchStore } from '../../stores/searchStore';
import { fetchPlaceDetails, getGoogleMapsPlaceUrl, getGoogleMapsReviewsUrl } from '../../services/googleMaps';
import type { Place, PlaceReview } from '../../types/place';
import { formatStars } from '../../utils/format';

export default function PlaceDetailModal() {
  const placeId = useUIStore((s) => s.detailModalPlaceId);
  const source = useUIStore((s) => s.detailModalSource);
  const close = useUIStore((s) => s.closeDetail);
  const trip = useTripStore((s) => s.trip);
  const currentDayId = useUIStore((s) => s.currentDayId);
  const addToDay = useTripStore((s) => s.addItemToDay);
  const removeItem = useTripStore((s) => s.removeItem);
  const searchResults = useSearchStore((s) => s.results);

  const [detail, setDetail] = useState<Place | null>(null);

  // 從 store 找出對應 Place（行程或搜尋結果）
  const seed: Place | null = useMemo(() => {
    if (!placeId || !trip) return null;
    for (const d of trip.days) {
      for (const it of d.items) {
        if (it.place.placeId === placeId) return it.place;
      }
    }
    const inSearch = searchResults.find((p) => p.placeId === placeId);
    if (inSearch) return inSearch;
    const inFav = trip.favorites.find((f) => f.placeId === placeId);
    if (inFav) return inFav;
    return null;
  }, [placeId, trip, searchResults]);

  useEffect(() => {
    let cancelled = false;
    setDetail(seed);
    if (seed) {
      fetchPlaceDetails(seed.placeId).then((more) => {
        if (!cancelled && more) {
          setDetail({ ...seed, ...more });
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [seed]);

  if (!placeId || !detail || !trip) return null;

  // 找出該 place 目前在哪天的行程裡
  let dayWithItem: { dayIndex: number; dayId: string; itemId: string } | null = null;
  for (const d of trip.days) {
    for (const it of d.items) {
      if (it.place.placeId === placeId) {
        dayWithItem = { dayIndex: d.dayIndex, dayId: d.id, itemId: it.id };
        break;
      }
    }
    if (dayWithItem) break;
  }

  const currentDay = trip.days.find((d) => d.id === currentDayId) ?? null;

  function handleAdd() {
    if (!currentDay || !detail) return;
    addToDay(currentDay.id, detail);
    close();
  }

  function handleRemove() {
    if (!dayWithItem) return;
    removeItem(dayWithItem.dayId, dayWithItem.itemId);
    close();
  }

  const photos = detail.photoUrls ?? [];
  const heroUrl = photos[0];

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal modal-large">
        <div
          className="detail-hero"
          style={heroUrl ? { backgroundImage: `url(${heroUrl})` } : undefined}
        >
          <div className="detail-actions">
            <div className="detail-action-left">
              {source === 'search' && currentDay && !dayWithItem && (
                <button className="detail-add-btn" onClick={handleAdd}>
                  +　加入 Day {currentDay.dayIndex}
                </button>
              )}
              {dayWithItem && (
                <>
                  <span className="detail-status-btn">✓ 已在 Day {dayWithItem.dayIndex}</span>
                  <button className="detail-remove-btn" onClick={handleRemove}>
                    ✕ 從行程移除
                  </button>
                </>
              )}
            </div>
            <button className="detail-close" onClick={close}>
              ✕
            </button>
          </div>
          {!heroUrl && <span className="detail-hero-label">photograph</span>}
        </div>
        <div className="detail-body thin-scroll">
          <h2 className="detail-name">{detail.name}</h2>
          <div className="detail-meta">
            {detail.rating !== undefined && <span className="detail-rating">★ {detail.rating.toFixed(1)}</span>}
            {detail.types[0] && (
              <>
                <span>·</span>
                <span>{translateType(detail.types[0])}</span>
              </>
            )}
            {detail.priceLevel !== undefined && (
              <>
                <span>·</span>
                <span>{'$'.repeat(Math.max(1, detail.priceLevel))}</span>
              </>
            )}
            {detail.reviewCount !== undefined && (
              <>
                <span>·</span>
                <span>{detail.reviewCount} 則評論</span>
              </>
            )}
          </div>

          <a
            className="detail-gmaps-link"
            href={getGoogleMapsPlaceUrl(detail.placeId)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            📍 在 Google Maps 開啟　<span className="arrow">↗</span>
          </a>

          <div className="detail-section">
            <div className="detail-section-label">資訊</div>
            <div className="detail-row">
              <span className="detail-row-label">地址</span>
              <span>{detail.address}</span>
            </div>
            {detail.phoneNumber && (
              <div className="detail-row">
                <span className="detail-row-label">電話</span>
                <span>{detail.phoneNumber}</span>
              </div>
            )}
            {detail.website && (
              <div className="detail-row">
                <span className="detail-row-label">網站</span>
                <a href={detail.website} target="_blank" rel="noreferrer">
                  {detail.website}
                </a>
              </div>
            )}
            {detail.openingHours && detail.openingHours.length > 0 && (
              <div className="detail-row">
                <span className="detail-row-label">營業時間</span>
                <div className="detail-hours">
                  {detail.openingHours.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {photos.length > 1 && (
            <div className="detail-section">
              <div className="detail-section-label">照片</div>
              <div className="detail-photos">
                {photos.slice(0, 6).map((url, i) => (
                  <div key={i} className="detail-photo" style={{ backgroundImage: `url(${url})` }} />
                ))}
              </div>
            </div>
          )}
          {photos.length === 0 && (
            <div className="detail-section">
              <div className="detail-section-label">照片</div>
              <div className="detail-photos">
                <div className="detail-photo empty" />
                <div className="detail-photo empty" />
                <div className="detail-photo empty" />
                <div className="detail-photo empty" />
              </div>
            </div>
          )}

          {detail.reviews && detail.reviews.length > 0 && (
            <div className="detail-section">
              <div className="detail-section-label">
                熱門評論
                <a
                  className="detail-section-more"
                  href={getGoogleMapsReviewsUrl(detail.placeId)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  看全部評論 ↗
                </a>
              </div>
              {detail.reviews.slice(0, 5).map((r: PlaceReview, i) => (
                <a
                  key={i}
                  className="review"
                  href={getGoogleMapsReviewsUrl(detail.placeId)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="review-head">
                    <span className="review-author">{r.author}</span>
                    <span className="review-stars">{formatStars(r.rating)}</span>
                    <span className="review-jump">↗</span>
                  </div>
                  <div className="review-text">{r.text}</div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function translateType(type: string): string {
  const map: Record<string, string> = {
    lodging: '住宿',
    restaurant: '餐廳',
    cafe: '咖啡店',
    bar: '酒吧',
    tourist_attraction: '景點',
    museum: '博物館',
    park: '公園',
    point_of_interest: '景點',
    shopping_mall: '購物中心',
    store: '商店',
    food: '餐廳',
  };
  return map[type] ?? type;
}
