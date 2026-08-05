import { useTripStore } from '../../stores/tripStore';
import SearchResultCard, { THUMB_LIMIT } from './SearchResultCard';
import { useUIStore } from '../../stores/uiStore';

export default function FavoriteList() {
  const trip = useTripStore((s) => s.trip);
  const currentDayId = useUIStore((s) => s.currentDayId);
  const day = trip?.days.find((d) => d.id === currentDayId) ?? null;

  if (!trip || trip.favorites.length === 0) return null;
  return (
    <div className="left-panel-list thin-scroll">
      {trip.favorites.map((place, idx) => (
        <SearchResultCard
          key={place.id}
          place={place}
          dayIndex={day?.dayIndex ?? null}
          showThumb={idx < THUMB_LIMIT}
        />
      ))}
    </div>
  );
}
