/**
 * 把 Google Places 的 types 陣列對應到代表性 emoji。
 * 多個 type 命中時，越前面越優先（特定 > 一般）。
 */

const ICON_MAP: Array<[string, string, string]> = [
  // 住宿
  ['lodging', '🏨', '住宿'],
  ['campground', '⛺', '露營地'],
  // 宗教
  ['church', '⛪', '教堂'],
  ['mosque', '🕌', '清真寺'],
  ['hindu_temple', '🛕', '寺廟'],
  ['place_of_worship', '⛩️', '宗教場所'],
  // 文化
  ['museum', '🏛️', '博物館'],
  ['art_gallery', '🎨', '美術館'],
  ['library', '📚', '圖書館'],
  // 娛樂
  ['aquarium', '🐠', '水族館'],
  ['zoo', '🦁', '動物園'],
  ['amusement_park', '🎢', '遊樂園'],
  ['stadium', '🏟️', '體育場'],
  ['movie_theater', '🎬', '電影院'],
  ['casino', '🎰', '賭場'],
  ['night_club', '🎵', '夜店'],
  // 購物
  ['supermarket', '🛒', '超市'],
  ['convenience_store', '🏪', '便利商店'],
  ['shopping_mall', '🛍️', '購物中心'],
  ['department_store', '🏬', '百貨'],
  ['book_store', '📖', '書店'],
  ['clothing_store', '👗', '服飾店'],
  ['pharmacy', '💊', '藥局'],
  ['store', '🛍️', '商店'],
  // 餐飲
  ['cafe', '☕', '咖啡店'],
  ['bakery', '🥐', '麵包店'],
  ['bar', '🍺', '酒吧'],
  ['meal_takeaway', '🥡', '外帶'],
  ['meal_delivery', '🛵', '外送'],
  ['restaurant', '🍽️', '餐廳'],
  ['food', '🍽️', '餐飲'],
  // 戶外
  ['park', '🌳', '公園'],
  ['natural_feature', '⛰️', '自然景觀'],
  ['campground', '⛺', '露營地'],
  // 交通
  ['airport', '✈️', '機場'],
  ['train_station', '🚆', '火車站'],
  ['subway_station', '🚇', '地鐵站'],
  ['bus_station', '🚌', '巴士站'],
  ['transit_station', '🚇', '車站'],
  ['parking', '🅿️', '停車場'],
  ['gas_station', '⛽', '加油站'],
  // 醫療
  ['hospital', '🏥', '醫院'],
  ['doctor', '🩺', '診所'],
  ['dentist', '🦷', '牙醫'],
  // 服務
  ['bank', '🏦', '銀行'],
  ['atm', '🏧', 'ATM'],
  ['post_office', '📮', '郵局'],
  ['school', '🎓', '學校'],
  ['university', '🎓', '大學'],
  ['gym', '💪', '健身房'],
  ['spa', '💆', 'SPA'],
  // 一般
  ['tourist_attraction', '📷', '景點'],
];

/**
 * 名稱關鍵字 fallback：Google 對「夜市」「教堂」這類沒有專屬 type，但名字常含關鍵字。
 */
const NAME_PATTERNS: Array<[RegExp, string, string]> = [
  [/夜市|night\s*market/i, '🎪', '夜市'],
  [/教堂|cathedral|church/i, '⛪', '教堂'],
  [/博物館|museum/i, '🏛️', '博物館'],
  [/老街|old\s*street/i, '🏘️', '老街'],
  [/溫泉|hot\s*spring/i, '♨️', '溫泉'],
  [/海灘|beach/i, '🏖️', '海灘'],
  [/瀑布|waterfall/i, '🏞️', '瀑布'],
  [/燈塔|lighthouse/i, '🗼', '燈塔'],
  [/夜景|觀景台/i, '🌃', '觀景'],
];

export interface PlaceIcon {
  icon: string;
  label: string;
}

export function getPlaceIcon(types: string[] | undefined, name?: string): PlaceIcon | null {
  if (types && types.length > 0) {
    for (const [type, icon, label] of ICON_MAP) {
      if (types.includes(type)) return { icon, label };
    }
  }
  if (name) {
    for (const [pattern, icon, label] of NAME_PATTERNS) {
      if (pattern.test(name)) return { icon, label };
    }
  }
  return null;
}
