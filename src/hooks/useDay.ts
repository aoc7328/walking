import { useTripStore } from '../stores/tripStore';
import { useUIStore } from '../stores/uiStore';

export function useCurrentDay() {
  const trip = useTripStore((s) => s.trip);
  const currentDayId = useUIStore((s) => s.currentDayId);
  return trip?.days.find((d) => d.id === currentDayId) ?? null;
}
