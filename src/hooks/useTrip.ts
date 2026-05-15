import { useTripStore } from '../stores/tripStore';

export function useTrip() {
  return useTripStore((s) => s.trip);
}
