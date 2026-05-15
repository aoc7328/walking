import { useEffect, useMemo, useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useTripStore } from '../../stores/tripStore';
import { useSearchStore } from '../../stores/searchStore';
import { fetchPlaceDetails, getGoogleMapsPlaceUrl, getGoogleMapsReviewsUrl, searchNearby } from '../../services/googleMaps';
import type { Place, PlaceReview } from '../../types/place';
import { formatStars, uuid } from '../../utils/format';
import { haversineKm } from '../../utils/geo';

interface NearbyCategory {
  key: string;
  label: string;
  types: string[];
}

const NEARBY_CATEGORIES: NearbyCategory[] = [
  { key: 'restaurant', label: '餐廳', types: ['restaurant'] },
  { key: 'cafe', label: '咖啡店', types: ['cafe'] },
  { key: 'convenience', label: '便利商店', types: ['convenience_store'] },
  { key: 'lodging', label: '飯店', types: ['lodging'] },
  { key: 'transit', label: '車站', types: ['transit_station', 'train_station', 'subway_station', 'bus_station'] },
  { key: 'bank', label: 'ATM', types: ['atm', 'bank'] },
  { key: 'attraction', label: '景點', types: ['tourist_attraction'] },
  { key: 'pharmacy', label: '藥局', types: ['pharmacy'] },
];

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} 公尺`;
  return `${km.toFixed(1)} 公里`;
}

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
  const [nearbyKey, setNearbyKey] = useState<string | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyResults, setNearbyResults] = useState<Place[]>([]);
  const [nearbyError, setNearbyError] = useState<string | null>(null);

  // 切換地點時清空周邊結果
  useEffect(() => {
    setNearbyKey(null);
    setNearbyResults([]);
    setNearbyError(null);
  }, [placeId]);

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
    if (!placeId) {
      setDetail(null);
      return;
    }
    setDetail(seed);
    fetchPlaceDetails(placeId).then((more) => {
      if (cancelled || !more) return;
      if (seed) {
        setDetail({ ...seed, ...more });
      } else {
        // 沒有 seed（例如直接從地圖 POI 點擊進來）：用 Google 回傳組一個 Place
        if (!more.coordinates) return; // 沒座標就放棄
        const fetched: Place = {
          id: uuid(),
          placeId,
          name: more.name ?? '',
          address: more.address ?? '',
          coordinates: more.coordinates,
          types: more.types ?? [],
          rating: more.rating,
          reviewCount: more.reviewCount,
          phoneNumber: more.phoneNumber,
          website: more.website,
          openingHours: more.openingHours,
          priceLevel: more.priceLevel,
          photoUrls: more.photoUrls,
          reviews: more.reviews,
        };
        setDetail(fetched);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [seed, placeId]);

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

  async function handleNearby(cat: NearbyCategory) {
    if (!detail) return;
    if (nearbyKey === cat.key) {
      // 已選 → 再點一次收起
      setNearbyKey(null);
      setNearbyResults([]);
      return;
    }
    setNearbyKey(cat.key);
    setNearbyLoading(true);
    setNearbyError(null);
    setNearbyResults([]);
    try {
      const results = await searchNearby(detail.coordinates, cat.types, 2500);
      // 排除「自己」這個地點
      const filtered = results.filter((p) => p.placeId !== detail.placeId);
      setNearbyResults(filtered);
    } catch (err) {
      setNearbyError(err instanceof Error ? err.message : '搜尋失敗');
    } finally {
      setNearbyLoading(false);
    }
  }

  function handleNearbyAdd(e: React.MouseEvent, place: Place) {
    e.stopPropagation();
    if (!currentDay) return;
    addToDay(currentDay.id, place);
  }

  function handleNearbyClick(place: Place) {
    // 切到該地點的詳細視窗
    useUIStore.getState().openDetail(place.placeId, 'search');
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
                <a
                  className="detail-tel-link"
                  href={`tel:${detail.phoneNumber.replace(/[^+\d]/g, '')}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {detail.phoneNumber}
                </a>
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

          <div className="detail-section">
            <div className="detail-section-label">周邊地點（步行 30 分內）</div>
            <div className="nearby-tags">
              {NEARBY_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  className={`nearby-tag${nearbyKey === cat.key ? ' active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleNearby(cat);
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            {nearbyLoading && <div className="empty-search">搜尋周邊地點中…</div>}
            {nearbyError && <div className="empty-search">{nearbyError}</div>}
            {!nearbyLoading && !nearbyError && nearbyKey && nearbyResults.length === 0 && (
              <div className="empty-search">附近 2.5 公里內沒有結果</div>
            )}
            {!nearbyLoading && nearbyResults.length > 0 && (
              <div className="nearby-list">
                {nearbyResults.map((p) => {
                  const distKm = haversineKm(detail.coordinates, p.coordinates);
                  return (
                    <div
                      key={p.id}
                      className="nearby-item"
                      onClick={() => handleNearbyClick(p)}
                    >
                      <div className="nearby-item-main">
                        <div className="nearby-item-name">{p.name}</div>
                        <div className="nearby-item-meta">
                          {p.rating !== undefined && (
                            <span className="nearby-item-rating">★ {p.rating.toFixed(1)}</span>
                          )}
                          <span className="nearby-item-distance">距離 {formatDistance(distKm)}</span>
                        </div>
                        <div className="nearby-item-address">{p.address}</div>
                      </div>
                      <button
                        className="nearby-item-add"
                        onClick={(e) => handleNearbyAdd(e, p)}
                        title={currentDay ? `加入 Day ${currentDay.dayIndex}` : '請先選日期'}
                        disabled={!currentDay}
                      >
                        +
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
