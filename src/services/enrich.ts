import type { Trip } from '../types/trip';
import { fetchPlaceDetails } from './googleMaps';

/**
 * 分享前的「補資料」：掃描行程裡所有「有 placeId 但缺電話」的地點，
 * 透過 Places Details API 補抓 phoneNumber 並寫回 trip。
 *
 * 為什麼需要這個：
 * - textSearch 回傳的 PLACE_LIST_FIELDS 不包含 nationalPhoneNumber（為了省 API 額度）。
 * - 使用者如果是從搜尋結果直接加入景點（沒先點開 detail modal），那個 place 就只會有
 *   名稱、地址、座標，沒有電話。
 * - 想在分享頁面上顯示電話，就得補資料。
 *
 * 同一個 placeId 出現多次只 fetch 一次。Google 真的回沒有電話 → 也算「處理過」，
 * 下次 share 不再重複呼叫（但我們沒辦法區分「沒打過 API」vs「打過但沒電話」，
 * 所以下次還是會再嘗試一次。這個成本可接受。
 *
 * 回傳：enriched trip + 實際抓到電話的地點數（給 UI 顯示用）。
 */
export async function enrichTripPhones(trip: Trip): Promise<{ trip: Trip; fetched: number }> {
  // 1. 收集所有「有 placeId 但缺 phone」的 placeId（去重）
  const missingPlaceIds = new Set<string>();
  for (const day of trip.days) {
    for (const item of day.items) {
      if (item.place.placeId && !item.place.phoneNumber) {
        missingPlaceIds.add(item.place.placeId);
      }
    }
  }
  if (missingPlaceIds.size === 0) {
    return { trip, fetched: 0 };
  }

  // 2. 平行抓所有缺的
  const phoneMap = new Map<string, string>();
  await Promise.all(
    [...missingPlaceIds].map(async (pid) => {
      try {
        const more = await fetchPlaceDetails(pid);
        if (more?.phoneNumber) {
          phoneMap.set(pid, more.phoneNumber);
        }
      } catch {
        // 單一地點失敗不擋整批
      }
    }),
  );

  if (phoneMap.size === 0) {
    return { trip, fetched: 0 };
  }

  // 3. 把抓到的電話寫回 trip（保持其他欄位不動）
  const enrichedDays = trip.days.map((day) => ({
    ...day,
    items: day.items.map((item) => {
      if (item.place.phoneNumber) return item;
      const newPhone = item.place.placeId ? phoneMap.get(item.place.placeId) : undefined;
      if (!newPhone) return item;
      return {
        ...item,
        place: { ...item.place, phoneNumber: newPhone },
      };
    }),
  }));

  return {
    trip: { ...trip, days: enrichedDays, updatedAt: Date.now() },
    fetched: phoneMap.size,
  };
}
