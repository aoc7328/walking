import type { Ledger } from '../types/ledger';

/**
 * Vincent 真實旅遊帳，從他的「旅遊開銷」Google 試算表轉錄。
 * 每趟各自一份 ledger；在帳本裡用「匯入範例帳本」選單，把對應那趟匯入到目前行程。
 * 金額除特別標 currency 外皆為台幣。
 */

export interface SampleLedgerEntry {
  key: string;
  name: string;
  ledger: Ledger;
}

/** 九州 7 日行（2025/02/09–02/18）。匯率 1 JPY = 0.21 TWD。 */
const KYUSHU: Ledger = {
  localCurrency: 'JPY',
  fxRate: 0.21,
  paymentMethods: [
    { id: 'pm-cathay', name: '國泰無限', kind: 'card' },
    { id: 'pm-sinopac', name: '永豐', kind: 'card' },
    { id: 'pm-fubon-j', name: '富邦 J 卡', kind: 'card' },
    { id: 'pm-jihe', name: '吉鶴', kind: 'card' },
    { id: 'pm-paypay', name: 'PayPay', kind: 'mobile' },
    { id: 'pm-cash', name: '現金', kind: 'cash' },
  ],
  channels: ['TabeLog', '秘書', '白金秘書'],
  budgets: [
    { category: '飲食', amount: 23800 },
    { category: '其他', amount: 30000 },
  ],
  accommodations: [
    { id: 'ky-ac-1', paid: true, area: '福岡天神', name: '天神日航', checkIn: '2025-02-09', nights: 2, price: 10963, currency: 'TWD', meals: '早餐', platform: 'agoda', chargeDate: '已付款' },
    { id: 'ky-ac-2', paid: true, area: '佐賀', name: '佐賀新大谷', checkIn: '2025-02-11', nights: 1, price: 4690, currency: 'TWD', meals: '早餐', platform: 'hotels.com', chargeDate: '現場付款' },
    { id: 'ky-ac-3', paid: true, area: '熊本', name: 'OMO5', checkIn: '2025-02-12', nights: 1, price: 3034, currency: 'TWD', meals: '早餐', platform: 'AsiaYo', chargeDate: '已付款' },
    { id: 'ky-ac-4', paid: true, area: '阿蘇', name: '阿蘇萬豪 Fairfield', checkIn: '2025-02-13', nights: 1, price: 4009, currency: 'TWD', platform: 'agoda', chargeDate: '現場付款' },
    { id: 'ky-ac-5', paid: true, area: '由布院', name: '寛ぎの宿 由布院 七川', checkIn: '2025-02-14', nights: 1, price: 14828, currency: 'TWD', meals: '早餐、晚餐', platform: 'agoda', chargeDate: '已付款' },
    { id: 'ky-ac-6', paid: true, area: '別府', name: '別府杉乃井', checkIn: '2025-02-15', nights: 2, price: 22120, currency: 'TWD', meals: '早餐、晚餐', platform: 'Booking.com', chargeDate: '已付款' },
    { id: 'ky-ac-7', paid: true, area: '福岡天神', name: '天神日航', checkIn: '2025-02-17', nights: 1, price: 3748, currency: 'TWD', platform: 'Booking.com', chargeDate: '已付款' },
  ],
  restaurants: [
    { id: 'ky-rs-1', date: '2025-02-09', time: '13:00', name: '稚加榮 福岡店', cuisine: '日料', status: 'walkin', estimated: 3000, amount: 2421, currency: 'TWD', paid: true, note: '不接受預約，午餐現場排隊' },
    { id: 'ky-rs-2', date: '2025-02-10', time: '17:30', name: '鍋処なかむら', cuisine: '內臟鍋', status: 'reserved', estimated: 3000, amount: 1135, currency: 'TWD', paid: true },
    { id: 'ky-rs-3', date: '2025-02-11', time: '12:30', name: '瓷器咖啡廳 Gallery 有田', cuisine: '定食', status: 'reserved', estimated: 2000, amount: 1982, currency: 'TWD', paid: true },
    { id: 'ky-rs-4', date: '2025-02-11', time: '18:00', name: '焼肉 炎壽', cuisine: '燒肉', status: 'reserved', estimated: 3000, amount: 1599, currency: 'TWD', paid: true },
    { id: 'ky-rs-5', date: '2025-02-12', time: '13:00', name: '勝烈亭 新市街本店', cuisine: '炸豬排', status: 'walkin', estimated: 2400, amount: 2277, currency: 'TWD', paid: true, note: '不需預約' },
    { id: 'ky-rs-6', date: '2025-02-12', time: '18:00', name: '焼鳥 華備', cuisine: '串燒', status: 'reserved', estimated: 3000, amount: 1591, currency: 'TWD', paid: true },
    { id: 'ky-rs-7', date: '2025-02-13', time: '13:00', name: 'ASO MILK FACTORY', cuisine: '起司料理', status: 'walkin', estimated: 1800, amount: 1133, currency: 'TWD', paid: true, note: '不需預約' },
    { id: 'ky-rs-8', date: '2025-02-15', time: '12:00', name: 'TANE', cuisine: '印度咖哩', status: 'walkin', estimated: 1000, amount: 0, currency: 'TWD', paid: false, note: '不接受預約' },
    { id: 'ky-rs-9', date: '2025-02-17', time: '18:30', name: 'ほっこり家', cuisine: '鐵板燒', status: 'cancelled', estimated: 4600, amount: 0, currency: 'TWD', paid: false, note: '取消預約' },
  ],
  expenses: [
    { id: 'ky-pre-1', phase: 'pre', category: '交通', title: '機票', amount: 20000, currency: 'TWD', paid: true },
    { id: 'ky-pre-2', phase: 'pre', category: '交通', title: '租車含 KEP（七日）', amount: 21501, currency: 'TWD', paid: true },
    { id: 'ky-pre-3', phase: 'pre', category: '交通', title: '油資', amount: 1692, currency: 'TWD', paid: true },
    { id: 'ky-pre-4', phase: 'pre', category: '其他', title: '換匯', amount: 22000, currency: 'TWD', paid: true, note: '換台幣 3 萬，此為實際花費' },
    { id: 'ky-pre-5', phase: 'pre', category: '其他', title: '保險', amount: 5852, currency: 'TWD', paid: true },
    { id: 'ky-pre-6', phase: 'pre', category: '其他', title: '網卡 eSIM', amount: 1080, currency: 'TWD', paid: true, note: 'klook' },
    { id: 'ky-pre-7', phase: 'pre', category: '其他', title: '門票 · 福岡塔', amount: 350, currency: 'TWD', paid: false, note: 'klook' },
    { id: 'ky-pre-8', phase: 'pre', category: '其他', title: '門票 · 別府空中纜車', amount: 800, currency: 'TWD', paid: false, note: '現場購票' },
  ],
};

/** 東京 7 日行（2025/01/08–01/14）。匯率 1 JPY = 0.205 TWD。餐廳金額記日幣。 */
const TOKYO: Ledger = {
  localCurrency: 'JPY',
  fxRate: 0.205,
  paymentMethods: [
    { id: 'tk-feixing', name: '飛行之極', kind: 'card' },
    { id: 'tk-fubon-j', name: '富邦 J 卡', kind: 'card' },
    { id: 'tk-cash', name: '日幣現金', kind: 'cash' },
  ],
  channels: ['TabeLog', '秘書'],
  budgets: [],
  accommodations: [],
  restaurants: [
    { id: 'tk-rs-1', date: '2025-01-08', time: '12:30', name: '淺草今半', cuisine: '壽喜燒', status: 'walkin', amount: 29403, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing', note: '午餐只能現場排隊' },
    { id: 'tk-rs-2', date: '2025-01-09', time: '12:00', name: '麥當勞', cuisine: '', status: 'impromptu', amount: 520, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-rs-3', date: '2025-01-09', time: '19:00', name: '神樂壽司 本店', cuisine: '連鎖壽司店', status: 'reserved', amount: 38720, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing', channel: '秘書', bookingName: 'Mr. Chang', contact: '+886-911-195-855' },
    { id: 'tk-rs-4', date: '2025-01-10', time: '12:00', name: '拉麵', cuisine: '', status: 'impromptu', amount: 3130, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing', note: '費用分開刷了兩筆日幣 1650+1480' },
    { id: 'tk-rs-5', date: '2025-01-10', time: '14:00', name: '北齋茶房', cuisine: '', status: 'impromptu', amount: 2610, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-rs-6', date: '2025-01-10', time: '18:00', name: 'asahi', cuisine: '鐵板燒', status: 'reserved', amount: 63063, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing', bookingRef: '4KTWV8NRCF', channel: 'TabeLog' },
    { id: 'tk-rs-7', date: '2025-01-11', time: '12:00', name: 'Grill Swiss', cuisine: '豬排蛋包飯', status: 'walkin', amount: 6400, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing', note: '午餐只能排隊，最好開店前去排' },
    { id: 'tk-rs-8', date: '2025-01-11', time: '19:00', name: '酒とやきとり とりごろ', cuisine: '現代居酒屋', status: 'reserved', amount: 7876, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing', bookingRef: '3RWFS5TZ8C', channel: 'TabeLog' },
    { id: 'tk-rs-9', date: '2025-01-12', time: '08:00', name: '飯店早午餐', cuisine: '', status: 'impromptu', amount: 8000, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-rs-10', date: '2025-01-12', time: '18:00', name: '豐洲站 迴轉壽司 銀一', cuisine: '壽司', status: 'impromptu', amount: 6897, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-rs-11', date: '2025-01-13', time: '11:45', name: '壽司郎', cuisine: '連鎖壽司店', status: 'impromptu', amount: 5480, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-rs-12', date: '2025-01-13', time: '17:00', name: '豐洲站 一間洞飯拉麵店', cuisine: '拉麵', status: 'impromptu', amount: 1900, currency: 'JPY', paid: true, paymentMethodId: 'tk-cash' },
    { id: 'tk-rs-13', date: '2025-01-14', time: '11:45', name: '客美多咖啡 上野廣小路店', cuisine: '咖啡', status: 'walkin', amount: 4920, currency: 'JPY', paid: true, paymentMethodId: 'tk-cash', note: '聽說 11:45 前到一定有位置' },
    { id: 'tk-rs-14', date: '2025-01-14', time: '11:45', name: '機場 元祖壽司', cuisine: '壽司', status: 'impromptu', amount: 2303, currency: 'JPY', paid: true, paymentMethodId: 'tk-cash' },
  ],
  expenses: [
    { id: 'tk-pre-1', phase: 'pre', category: '交通', title: '機票', amount: 26636, currency: 'TWD', paid: true },
    { id: 'tk-pre-2', phase: 'pre', category: '住宿', title: '飯店（全程）', amount: 35064, currency: 'TWD', paid: true },
    { id: 'tk-pre-3', phase: 'pre', category: '交通', title: '行李接送', amount: 3154, currency: 'TWD', paid: true },
    { id: 'tk-pre-4', phase: 'pre', category: '交通', title: '機場快線來回', amount: 1870, currency: 'TWD', paid: true },
    { id: 'tk-pre-5', phase: 'pre', category: '交通', title: '機場接送加值', amount: 300, currency: 'TWD', paid: true },
    { id: 'tk-pre-6', phase: 'pre', category: '其他', title: 'eSIM', amount: 1820, currency: 'TWD', paid: true },
    { id: 'tk-pre-7', phase: 'pre', category: '其他', title: '旅平險', amount: 1970, currency: 'TWD', paid: true },
    // 出發後流水帳（金額記日幣；台幣由匯率換算）
    { id: 'tk-d-1', phase: 'during', date: '2025-01-08', category: '交通', title: '鈺柔西瓜卡儲值', amount: 4000, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-2', phase: 'during', date: '2025-01-08', category: '購物', title: '藥妝', amount: 6743, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-3', phase: 'during', date: '2025-01-08', category: '購物', title: '藥妝', amount: 1095, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-4', phase: 'during', date: '2025-01-08', category: '飲食', title: '獺祭 23', amount: 5742, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-5', phase: 'during', date: '2025-01-08', category: '飲食', title: '大福', amount: 2000, currency: 'JPY', paid: true, paymentMethodId: 'tk-cash' },
    { id: 'tk-d-6', phase: 'during', date: '2025-01-08', category: '飲食', title: '甜度 11 度的小番茄', amount: 4104, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-7', phase: 'during', date: '2025-01-08', category: '住宿', title: '住宿税', amount: 1200, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-8', phase: 'during', date: '2025-01-08', category: '飲食', title: '超市', amount: 2426, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-9', phase: 'during', date: '2025-01-08', category: '購物', title: '皮帶', amount: 6930, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-10', phase: 'during', date: '2025-01-08', category: '其他', title: '洗衣服', amount: 600, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-11', phase: 'during', date: '2025-01-08', category: '其他', title: '烘衣服', amount: 600, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-12', phase: 'during', date: '2025-01-08', category: '交通', title: '思齊西瓜卡儲值', amount: 10000, currency: 'JPY', paid: true, paymentMethodId: 'tk-fubon-j' },
    { id: 'tk-d-13', phase: 'during', date: '2025-01-09', category: '購物', title: 'ecco', amount: 34300, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-14', phase: 'during', date: '2025-01-09', category: '購物', title: 'GALLARDAGALANTE', amount: 54720, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-15', phase: 'during', date: '2025-01-09', category: '其他', title: '不知道是啥', amount: 1480, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-16', phase: 'during', date: '2025-01-09', category: '購物', title: 'Aesop', amount: 6500, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-17', phase: 'during', date: '2025-01-09', category: '交通', title: '思齊西瓜卡儲值', amount: 10000, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-18', phase: 'during', date: '2025-01-09', category: '飲食', title: '櫻井焙茶研究所訂金', amount: 5000, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-19', phase: 'during', date: '2025-01-10', category: '購物', title: '小王子專賣店', amount: 4515, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-20', phase: 'during', date: '2025-01-10', category: '購物', title: '伴手禮', amount: 6480, currency: 'JPY', paid: true, paymentMethodId: 'tk-cash' },
    { id: 'tk-d-21', phase: 'during', date: '2025-01-10', category: '飲食', title: '鈴懸', amount: 2501, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-22', phase: 'during', date: '2025-01-10', category: '飲食', title: '福砂屋', amount: 4536, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-23', phase: 'during', date: '2025-01-10', category: '購物', title: '老松', amount: 20844, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-24', phase: 'during', date: '2025-01-10', category: '購物', title: 'uniqlo', amount: 14455, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-25', phase: 'during', date: '2025-01-10', category: '交通', title: '鈺柔西瓜卡儲值', amount: 2000, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-26', phase: 'during', date: '2025-01-11', category: '購物', title: '伊東屋', amount: 15592, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-27', phase: 'during', date: '2025-01-11', category: '飲食', title: '文明堂', amount: 5300, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-28', phase: 'during', date: '2025-01-11', category: '購物', title: '襪子', amount: 9020, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-29', phase: 'during', date: '2025-01-11', category: '購物', title: 'balcony', amount: 5830, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-30', phase: 'during', date: '2025-01-11', category: '其他', title: 'big echo', amount: 4020, currency: 'JPY', paid: true, paymentMethodId: 'tk-cash' },
    { id: 'tk-d-31', phase: 'during', date: '2025-01-12', category: '其他', title: '洗衣服', amount: 600, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-32', phase: 'during', date: '2025-01-12', category: '其他', title: '烘衣服', amount: 900, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-33', phase: 'during', date: '2025-01-12', category: '交通', title: '鈺柔西瓜卡儲值', amount: 2000, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-34', phase: 'during', date: '2025-01-12', category: '交通', title: '思齊西瓜卡儲值', amount: 10000, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-35', phase: 'during', date: '2025-01-12', category: '飲食', title: '超市', amount: 6247, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-36', phase: 'during', date: '2025-01-12', category: '其他', title: '秀德 no show 罰金', amount: 22000, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-37', phase: 'during', date: '2025-01-12', category: '交通', title: '鈺柔西瓜卡儲值', amount: 2000, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-38', phase: 'during', date: '2025-01-13', category: '飲食', title: '甜甜圈', amount: 1034, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-39', phase: 'during', date: '2025-01-13', category: '飲食', title: '甜甜圈', amount: 990, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-40', phase: 'during', date: '2025-01-13', category: '其他', title: '奉獻', amount: 5000, currency: 'JPY', paid: true, paymentMethodId: 'tk-cash' },
    { id: 'tk-d-41', phase: 'during', date: '2025-01-13', category: '購物', title: '剪刀', amount: 2750, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-42', phase: 'during', date: '2025-01-13', category: '購物', title: '小串珠', amount: 880, currency: 'JPY', paid: true, paymentMethodId: 'tk-cash' },
    { id: 'tk-d-43', phase: 'during', date: '2025-01-13', category: '飲食', title: '超市', amount: 8659, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-44', phase: 'during', date: '2025-01-13', category: '其他', title: '某筆退稅', amount: -200, currency: 'JPY', paid: true },
    { id: 'tk-d-45', phase: 'during', date: '2025-01-14', category: '購物', title: 'etre relie', amount: 38665, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-46', phase: 'during', date: '2025-01-14', category: '購物', title: 'asics 皮鞋', amount: 28215, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-47', phase: 'during', date: '2025-01-14', category: '購物', title: 'fitfit', amount: 10890, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
    { id: 'tk-d-48', phase: 'during', date: '2025-01-14', category: '其他', title: '不知道是啥', amount: 1650, currency: 'JPY', paid: true, paymentMethodId: 'tk-feixing' },
  ],
};

/** 紐西蘭南島（規劃中，未出發）。住宿價為台幣；當地幣 NZD，匯率 1 NZD = 19.5 TWD。 */
const NEW_ZEALAND: Ledger = {
  localCurrency: 'NZD',
  fxRate: 19.5,
  paymentMethods: [{ id: 'nz-cash', name: '現金', kind: 'cash' }],
  channels: [],
  budgets: [],
  accommodations: [
    { id: 'nz-ac-1', paid: false, area: '基督城', name: 'Sudima Christchurch Airport', nights: 1, price: 4000, currency: 'TWD', platform: '' },
    { id: 'nz-ac-2', paid: false, area: '凱庫拉', name: 'The Hamptons', nights: 1, price: 6000, currency: 'TWD', meals: '早餐', platform: '' },
    { id: 'nz-ac-3', paid: false, area: '漢默溫泉', name: 'Edit Hanmer Springs', nights: 2, price: 10000, currency: 'TWD', platform: '' },
    { id: 'nz-ac-4', paid: false, area: '傑拉爾丁', name: 'The Vicarage Geraldine', nights: 1, price: 8000, currency: 'TWD', platform: '' },
    { id: 'nz-ac-5', paid: false, area: '庫克山', name: 'The Hermitage Hotel', nights: 2, price: 36000, currency: 'TWD', platform: '' },
    { id: 'nz-ac-6', paid: false, area: '玻璃屋住宿', name: 'SkyScape', nights: 2, price: 40000, currency: 'TWD', platform: '' },
    { id: 'nz-ac-7', paid: false, area: '瓦納卡', name: 'Matai Cottage and Studio', nights: 2, price: 18000, currency: 'TWD', platform: '' },
    { id: 'nz-ac-8', paid: false, area: '黑鼻羊之家', name: 'Rose Creek Farm', nights: 2, price: 12000, currency: 'TWD', platform: '' },
    { id: 'nz-ac-9', paid: false, area: '蒂阿瑙', name: 'Parklands Motel and Apartments Te Anau', nights: 1, price: 3000, currency: 'TWD', platform: '' },
    { id: 'nz-ac-10', paid: false, area: '米爾福德峽灣', name: '米佛峽灣小屋', nights: 2, price: 30000, currency: 'TWD', platform: '' },
    { id: 'nz-ac-11', paid: false, area: '卡特林斯', name: 'Seascape Accommodation（Kaka Point）', nights: 2, price: 15000, currency: 'TWD', platform: '' },
    { id: 'nz-ac-12', paid: false, area: '奧塔哥半島', name: 'Roselle Farm Cottage', nights: 1, price: 5000, currency: 'TWD', platform: '' },
  ],
  restaurants: [],
  expenses: [
    { id: 'nz-pre-1', phase: 'pre', category: '交通', title: '機票', amount: 320000, currency: 'TWD', paid: false },
    { id: 'nz-pre-2', phase: 'pre', category: '交通', title: '租車', amount: 80000, currency: 'TWD', paid: false },
    { id: 'nz-pre-3', phase: 'pre', category: '交通', title: '簽證', amount: 4500, currency: 'TWD', paid: false },
    { id: 'nz-pre-4', phase: 'pre', category: '其他', title: 'eSIM', amount: 4400, currency: 'TWD', paid: false },
  ],
};

export const SAMPLE_LEDGERS: SampleLedgerEntry[] = [
  { key: 'kyushu', name: '九州', ledger: KYUSHU },
  { key: 'tokyo', name: '東京', ledger: TOKYO },
  { key: 'nz', name: '紐西蘭', ledger: NEW_ZEALAND },
];
