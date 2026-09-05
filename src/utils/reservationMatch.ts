import type { DayPlan, ItineraryItem } from '../types/trip';
import type { Restaurant, Ledger } from '../types/ledger';
import { hhmmToMinutes } from './date';

/**
 * 把帳本的餐廳訂位對到行程裡的站，讓行程上可以直接標「這家有訂位」。
 *
 * 麻煩的地方：Restaurant 沒有 placeId，只有店名。而店名兩邊常常不一樣——
 * 同一家店在 Google 上叫「San Annex」、帳本裡寫「すき焼き松山　燦別館」；
 * 行程叫「鮨人 宮古島店」、帳本只寫「鮨人」；還有「炉端」與「爐端」這種字形差異。
 *
 * 所以採多層比對，全部限定在同一天之內（跨日不比，寧可漏標也不要標錯）：
 *   1. 店名完全相同
 *   2. 正規化（去空白/標點、簡繁常見異體、小寫）後相同
 *   3. 正規化後互為子字串（其中一邊比較長，例如多了分店名）
 *   4. 這一站是餐飲場所，而且抵達時間跟訂位時間很接近
 *      （使用者通常會把抵達時間手動設成訂位時間，這是很強的訊號）
 *
 * 一張訂位只會配到一站，一站也只會配到一張：分數高的先配，避免同一天兩家店互搶。
 */

/** 常見異體字：帳本手打與 Google 名稱常常一個用舊字形一個用新字形。 */
const VARIANTS: Record<string, string> = {
  爐: '炉', 邊: '辺', 邉: '辺', 澤: '沢', 齋: '斎', 觀: '観', 廣: '広',
  竜: '龍', 桜: '櫻', 條: '条', 屋: '屋', 舖: '舗', 鋪: '舗',
};

function normalize(s: string): string {
  let out = '';
  for (const ch of String(s ?? '').toLowerCase()) {
    // 空白與各種標點一律拿掉：「すき焼き松山　燦別館」vs「すき焼き松山 燦別館」
    if (/[\s　・･·、,，.。「」『』()（）[\]【】〔〕\-−ー–—_/／\\|:：;；'’"“”!！?？&＆]/.test(ch)) continue;
    out += VARIANTS[ch] ?? ch;
  }
  return out;
}

/** 這一站看起來是吃飯的地方嗎（用 Google 的 types 判斷）。 */
function isFoodPlace(item: ItineraryItem): boolean {
  return (item.place.types ?? []).some((t) =>
    /restaurant|_bar$|^bar$|cafe|coffee|food|bakery|izakaya|pub|bistro|diner|night_club|meal_/.test(t),
  );
}

/** 分數越高越確定；0 代表不算配對。 */
function score(item: ItineraryItem, r: Restaurant): number {
  const a = item.place.name ?? '';
  const b = r.name ?? '';
  if (a && b && a === b) return 100;
  const na = normalize(a);
  const nb = normalize(b);
  if (na && nb && na === nb) return 90;
  // 子字串至少要兩個字，不然「The」之類的短詞會亂配
  if (na.length >= 2 && nb.length >= 2 && (na.includes(nb) || nb.includes(na))) return 70;

  // 名字完全對不上時，靠「同一天 + 餐飲場所 + 時間相近」補
  if (!isFoodPlace(item) || !r.time) return 0;
  const ia = hhmmToMinutes(item.arrivalTime);
  const ib = hhmmToMinutes(r.time);
  if (ia === null || ib === null) return 0;
  const gap = Math.abs(ia - ib);
  if (gap <= 15) return 60;
  if (gap <= 45) return 40;
  return 0;
}

const MIN_SCORE = 40;

/** 配對結果：itemId → 那一站對到的訂位。 */
export type ReservationMap = Map<string, Restaurant>;

/**
 * 算出這一天每一站對到的訂位。
 * 只看 `day.date` 當天的訂位；已取消的仍然回傳（要讓使用者看到「這家取消了」）。
 */
export function matchDayReservations(day: DayPlan, ledger: Ledger): ReservationMap {
  const out: ReservationMap = new Map();
  const sameDay = ledger.restaurants.filter((r) => r.date === day.date);
  if (sameDay.length === 0 || day.items.length === 0) return out;

  // 先把所有 (訂位, 站) 的可能配對算出來，分數高的優先，確保 1 對 1
  const pairs: { r: Restaurant; item: ItineraryItem; s: number }[] = [];
  for (const r of sameDay) {
    for (const item of day.items) {
      const s = score(item, r);
      if (s >= MIN_SCORE) pairs.push({ r, item, s });
    }
  }
  pairs.sort((x, y) => y.s - x.s);

  const usedItems = new Set<string>();
  const usedRes = new Set<string>();
  for (const p of pairs) {
    if (usedItems.has(p.item.id) || usedRes.has(p.r.id)) continue;
    usedItems.add(p.item.id);
    usedRes.add(p.r.id);
    out.set(p.item.id, p.r);
  }
  return out;
}
