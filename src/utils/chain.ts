import type { DayPlan, ItineraryItem, Leg } from '../types/trip';
import type { TransportMode } from '../types/place';
import { uuid } from './format';
import { addDays, addMinutesToTime, hhmmToMinutes } from './date';

/**
 * 行程時間鏈與「跨日銜接站」的純函數。
 *
 * 從 tripStore 抽出來的原因：這些是整個 App 最容易出「時間對不上／備註跑錯／飯店旗標不對」
 * 的地方，抽成純函數才能拿真實行程資料跑驗證（見 scripts/ 或臨時 probe），
 * 也才能保證電腦版與手機版套的是同一份邏輯。
 *
 * 規則總覽：
 * - 每天的 legs 長度永遠 = items.length - 1。
 * - 非手動鎖定的站：抵達 = 前站抵達 + 前站停留 + 該段交通時間。
 * - 空白天 / 天首不等於前一天最後站 → 自動補一個「銜接站」（autoFilled），
 *   承襲前一天最後站的地點與 isHotel，**不承襲備註**。
 * - 銜接站只能在 index 0；被拖到別處就不再是銜接站（清 autoFilled）。
 */

export function recalcLegsArray(items: ItineraryItem[], legs: Leg[]): Leg[] {
  const targetLen = Math.max(0, items.length - 1);
  if (legs.length === targetLen) return legs;
  if (legs.length < targetLen) {
    const padded = [...legs];
    while (padded.length < targetLen) padded.push({ mode: 'driving' });
    return padded;
  }
  return legs.slice(0, targetLen);
}

interface LegTravel {
  durationMinutes: number;
  distanceMeters?: number;
}

/** 用座標當鍵（一定有，且與 directions 服務的快取同語意）。 */
function legPairKey(from: ItineraryItem, to: ItineraryItem, mode: TransportMode): string {
  const f = from.place.coordinates;
  const t = to.place.coordinates;
  return `${f.lat.toFixed(5)},${f.lng.toFixed(5)}|${t.lat.toFixed(5)},${t.lng.toFixed(5)}|${mode}`;
}

/** 把目前已知的交通時間，以「地點對 + 交通方式」建成快取。 */
export function buildLegTravelCache(items: ItineraryItem[], legs: Leg[]): Map<string, LegTravel> {
  const cache = new Map<string, LegTravel>();
  for (let i = 0; i < legs.length && i + 1 < items.length; i++) {
    const leg = legs[i];
    if (!leg || leg.durationMinutes === undefined) continue;
    cache.set(legPairKey(items[i]!, items[i + 1]!, leg.mode), {
      durationMinutes: leg.durationMinutes,
      distanceMeters: leg.distanceMeters,
    });
  }
  return cache;
}

/**
 * 行程順序變動後，依「新順序」重接每段 leg：
 * - 交通方式沿用該位置原本的 mode
 * - 交通時間用「新的地點對 + mode」回查 cache；查不到就清空，交給 refreshLegsForDay 重抓。
 */
export function relinkLegs(items: ItineraryItem[], positionalLegs: Leg[], cache: Map<string, LegTravel>): Leg[] {
  const out: Leg[] = [];
  for (let i = 0; i + 1 < items.length; i++) {
    const mode = positionalLegs[i]?.mode ?? 'driving';
    const hit = cache.get(legPairKey(items[i]!, items[i + 1]!, mode));
    out.push(hit ? { mode, durationMinutes: hit.durationMinutes, distanceMeters: hit.distanceMeters } : { mode });
  }
  return out;
}

/**
 * 重算當日時間鏈。
 *
 * 抵達時間是 HH:MM，跨過午夜會繞回去（23:30 + 90 分 = 01:00），畫面上看起來像
 * 「時間倒退」。這裡順便算出 arrivalNextDay：一旦某站跨日，它跟後面所有自動算的站
 * 都標成隔天，UI 拿去顯示「翌日」。手動鎖定的站不動（使用者自己知道那是幾點）。
 */
export function recomputeChain(day: DayPlan): DayPlan {
  if (day.items.length === 0) return day;
  const items = [...day.items];
  // 第一站沒有前站可推，也不該殘留舊的跨日旗標
  if (items[0]!.arrivalNextDay) items[0] = { ...items[0]!, arrivalNextDay: undefined };
  for (let i = 1; i < items.length; i++) {
    const item = items[i]!;
    if (item.arrivalManual) continue;
    const prev = items[i - 1]!;
    const leg = day.legs[i - 1];
    const travel = leg?.durationMinutes ?? 0;
    const prevMin = hhmmToMinutes(prev.arrivalTime) ?? 0;
    const total = prevMin + prev.stayMinutes + travel;
    const newArrival = addMinutesToTime(prev.arrivalTime, prev.stayMinutes + travel);
    const nextDay = prev.arrivalNextDay === true || total >= 24 * 60 ? true : undefined;
    if (newArrival !== item.arrivalTime || nextDay !== item.arrivalNextDay) {
      items[i] = { ...item, arrivalTime: newArrival, arrivalNextDay: nextDay };
    }
  }
  return { ...day, items };
}

export function chainAll(days: DayPlan[]): DayPlan[] {
  return days.map(recomputeChain);
}

export function reindexDays(days: DayPlan[], startDate: string): DayPlan[] {
  return days.map((d, idx) => ({
    ...d,
    dayIndex: idx + 1,
    date: addDays(startDate, idx),
  }));
}

/** 銜接站：承襲前一天最後站的地點與「是不是飯店」，其餘一律預設。刻意不帶備註。 */
function seedFrom(prevLast: ItineraryItem): ItineraryItem {
  return {
    id: uuid(),
    place: prevLast.place,
    arrivalTime: '09:00',
    stayMinutes: 30,
    isHotel: prevLast.isHotel,
    autoFilled: true,
  };
}

/**
 * 銜接站只允許在 index 0。使用者把它拖到別的位置（最常見：拖到天尾當「回飯店」），
 * 那它就是使用者刻意放的真實站，不能再被下一輪 withAutoFill 當成可覆寫的銜接站——
 * 否則天首少了銜接站，程式又補一個，同一天就出現兩個 autoFilled 的飯店。
 */
export function clearStrayAutoFill(items: ItineraryItem[]): ItineraryItem[] {
  let changed = false;
  const out = items.map((it, i) => {
    if (i === 0 || !it.autoFilled) return it;
    changed = true;
    return { ...it, autoFilled: false };
  });
  return changed ? out : items;
}

/**
 * 把每個空白的日子自動填入前一天的最後一站，並標記為 autoFilled。Day 1 不處理。
 *
 * 連續空白天會「逐天接續」：Day N 接 Day N-1 的最後一站（用 next[i-1] 而不是 days[i-1]，
 * 前一天填好後下一輪自然接得上，連續住同一間飯店好幾天，每天開頭都會是那間飯店）。
 *
 * 純函數、可重複套用：autoFilled 的天若已對上前一天最後一站，下一次跑就跳過。
 *
 * 銜接站**不再複製前一天最後站的備註**：那些備註是寫給「前一晚回飯店」那一站的
 *（check-in、拿早餐券…），複製到隔天早上出發的同一間飯店就是備註跑錯地方的主因，
 * 而且會一天傳一天，把空字串也一路傳下去。
 */
export function withAutoFill(days: DayPlan[]): DayPlan[] {
  if (days.length <= 1) return days;
  const next: DayPlan[] = [];
  for (let i = 0; i < days.length; i++) {
    const d = days[i]!;
    const prev = next[i - 1];

    if (!prev || prev.items.length === 0) {
      next.push(d);
      continue;
    }

    const prevLast = prev.items[prev.items.length - 1]!;

    // 情況 1：空白天 → 填入前一天最後一站當銜接點
    if (d.items.length === 0) {
      next.push({ ...d, items: [seedFrom(prevLast)], legs: [] });
      continue;
    }

    const firstItem = d.items[0]!;

    // 當天第一站 === 前一天最後一站（用 placeId 比對）→ 已經銜接好，什麼都不做
    if (firstItem.place.placeId === prevLast.place.placeId) {
      next.push(d);
      continue;
    }

    if (firstItem.autoFilled) {
      // (a) 天首是先前自動補的銜接站，但前一天最後站已變 → 就地更新地點（不增加站數）。
      //     地點換了，銜接站→第二站那段交通時間就是舊地點的，要清掉讓它重抓。
      const updated: ItineraryItem = { ...firstItem, place: prevLast.place, isHotel: prevLast.isHotel };
      const legs = d.legs.length > 0 ? [{ mode: d.legs[0]!.mode }, ...d.legs.slice(1)] : d.legs;
      next.push({ ...d, items: [updated, ...d.items.slice(1)], legs });
    } else {
      // (b) 天首是使用者自排的真實地點 → 在最前面插入銜接站，原行程整段保留往後移
      next.push({
        ...d,
        items: [seedFrom(prevLast), ...d.items],
        legs: [{ mode: 'driving' as const }, ...d.legs],
      });
    }
  }
  return next;
}

/**
 * 「拿出來顯示之前」的正規化：補銜接站 + 重算時間鏈。
 *
 * ⚠️ KV 裡存的 arrivalTime 不一定等於實際要顯示的時間——任何要顯示行程的畫面
 *（電腦版、手機版）都必須套同一支，否則兩邊時間會對不起來。
 * 純函數、可重複套用，只影響顯示，不寫回雲端。
 */
export function normalizeDaysForView(days: DayPlan[]): DayPlan[] {
  return chainAll(withAutoFill(days));
}
