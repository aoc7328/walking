import type { DayPlan } from '../types/trip';
import type { Place, TransportMode } from '../types/place';
import { haversineKm } from '../utils/geo';

/**
 * 找出新點插入到當天 items 中的最佳位置。
 *
 * 限制：
 * - 飯店（isHotel）視為起終點，新點不能插在 index 0 之前或 last index 之後
 * - 當天沒有任何點：回 0
 * - 當天只有飯店（起終點兩個 hotel item）：插在兩飯店之間
 */
export function findBestInsertPosition(
  newPoint: Place,
  currentDay: DayPlan,
  _legMode: TransportMode = 'driving',
): number {
  const items = currentDay.items;
  if (items.length === 0) return 0;
  if (items.length === 1) return 1;

  // 允許的插入範圍：避開 0（飯店起點）與 last（飯店終點）
  const firstIsHotel = items[0]?.isHotel === true;
  const lastIsHotel = items[items.length - 1]?.isHotel === true;
  const minIdx = firstIsHotel ? 1 : 0;
  const maxIdx = lastIsHotel ? items.length - 1 : items.length;

  if (minIdx >= maxIdx) {
    return minIdx;
  }

  let bestIdx = minIdx;
  let bestDelta = Infinity;

  for (let i = minIdx; i <= maxIdx; i++) {
    const before = items[i - 1]?.place.coordinates;
    const after = items[i]?.place.coordinates;
    let delta = 0;
    if (before && after) {
      const original = haversineKm(before, after);
      const viaNew =
        haversineKm(before, newPoint.coordinates) +
        haversineKm(newPoint.coordinates, after);
      delta = viaNew - original;
    } else if (before) {
      delta = haversineKm(before, newPoint.coordinates);
    } else if (after) {
      delta = haversineKm(newPoint.coordinates, after);
    }
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIdx = i;
    }
  }

  return bestIdx;
}
