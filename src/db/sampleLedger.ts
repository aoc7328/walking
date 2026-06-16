import type { Ledger } from '../types/ledger';

/**
 * Vincent 真實的九州行帳（2025/02/09–02/18），從他的「旅遊開銷」Google 試算表轉錄。
 * 用途：在帳本裡按「載入九州實帳」一鍵灌進目前行程，方便用真實資料檢視好不好用。
 * 金額除特別註明外皆為台幣；匯率 1 JPY = 0.21 TWD。
 */
export const SAMPLE_KYUSHU_LEDGER: Ledger = {
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
    { id: 'ac-1', paid: true, area: '福岡天神', name: '天神日航', checkIn: '2025-02-09', nights: 2, price: 10963, currency: 'TWD', meals: '早餐', platform: 'agoda', chargeDate: '已付款' },
    { id: 'ac-2', paid: true, area: '佐賀', name: '佐賀新大谷', checkIn: '2025-02-11', nights: 1, price: 4690, currency: 'TWD', meals: '早餐', platform: 'hotels.com', chargeDate: '現場付款' },
    { id: 'ac-3', paid: true, area: '熊本', name: 'OMO5', checkIn: '2025-02-12', nights: 1, price: 3034, currency: 'TWD', meals: '早餐', platform: 'AsiaYo', chargeDate: '已付款' },
    { id: 'ac-4', paid: true, area: '阿蘇', name: '阿蘇萬豪 Fairfield', checkIn: '2025-02-13', nights: 1, price: 4009, currency: 'TWD', platform: 'agoda', chargeDate: '現場付款' },
    { id: 'ac-5', paid: true, area: '由布院', name: '寛ぎの宿 由布院 七川', checkIn: '2025-02-14', nights: 1, price: 14828, currency: 'TWD', meals: '早餐、晚餐', platform: 'agoda', chargeDate: '已付款' },
    { id: 'ac-6', paid: true, area: '別府', name: '別府杉乃井', checkIn: '2025-02-15', nights: 2, price: 22120, currency: 'TWD', meals: '早餐、晚餐', platform: 'Booking.com', chargeDate: '已付款' },
    { id: 'ac-7', paid: true, area: '福岡天神', name: '天神日航', checkIn: '2025-02-17', nights: 1, price: 3748, currency: 'TWD', platform: 'Booking.com', chargeDate: '已付款' },
  ],

  restaurants: [
    { id: 'rs-1', date: '2025-02-09', time: '13:00', name: '稚加榮 福岡店', cuisine: '日料', status: 'walkin', estimated: 3000, amount: 2421, currency: 'TWD', paid: true, note: '不接受預約，午餐現場排隊' },
    { id: 'rs-2', date: '2025-02-10', time: '17:30', name: '鍋処なかむら', cuisine: '內臟鍋', status: 'reserved', estimated: 3000, amount: 1135, currency: 'TWD', paid: true },
    { id: 'rs-3', date: '2025-02-11', time: '12:30', name: '瓷器咖啡廳 Gallery 有田', cuisine: '定食', status: 'reserved', estimated: 2000, amount: 1982, currency: 'TWD', paid: true },
    { id: 'rs-4', date: '2025-02-11', time: '18:00', name: '焼肉 炎壽', cuisine: '燒肉', status: 'reserved', estimated: 3000, amount: 1599, currency: 'TWD', paid: true },
    { id: 'rs-5', date: '2025-02-12', time: '13:00', name: '勝烈亭 新市街本店', cuisine: '炸豬排', status: 'walkin', estimated: 2400, amount: 2277, currency: 'TWD', paid: true, note: '不需預約' },
    { id: 'rs-6', date: '2025-02-12', time: '18:00', name: '焼鳥 華備', cuisine: '串燒', status: 'reserved', estimated: 3000, amount: 1591, currency: 'TWD', paid: true },
    { id: 'rs-7', date: '2025-02-13', time: '13:00', name: 'ASO MILK FACTORY', cuisine: '起司料理', status: 'walkin', estimated: 1800, amount: 1133, currency: 'TWD', paid: true, note: '不需預約' },
    { id: 'rs-8', date: '2025-02-15', time: '12:00', name: 'TANE', cuisine: '印度咖哩', status: 'walkin', estimated: 1000, amount: 0, currency: 'TWD', paid: false, note: '不接受預約' },
    { id: 'rs-9', date: '2025-02-17', time: '18:30', name: 'ほっこり家', cuisine: '鐵板燒', status: 'cancelled', estimated: 4600, amount: 0, currency: 'TWD', paid: false, note: '取消預約' },
  ],

  expenses: [
    { id: 'ex-pre-1', phase: 'pre', category: '交通', title: '機票', amount: 20000, currency: 'TWD', paid: true },
    { id: 'ex-pre-2', phase: 'pre', category: '交通', title: '租車含 KEP（七日）', amount: 21501, currency: 'TWD', paid: true },
    { id: 'ex-pre-3', phase: 'pre', category: '交通', title: '油資', amount: 1692, currency: 'TWD', paid: true },
    { id: 'ex-pre-4', phase: 'pre', category: '其他', title: '換匯', amount: 22000, currency: 'TWD', paid: true, note: '換台幣 3 萬，此為實際花費' },
    { id: 'ex-pre-5', phase: 'pre', category: '其他', title: '保險', amount: 5852, currency: 'TWD', paid: true },
    { id: 'ex-pre-6', phase: 'pre', category: '其他', title: '網卡 eSIM', amount: 1080, currency: 'TWD', paid: true, note: 'klook' },
    { id: 'ex-pre-7', phase: 'pre', category: '其他', title: '門票 · 福岡塔', amount: 350, currency: 'TWD', paid: false, note: 'klook' },
    { id: 'ex-pre-8', phase: 'pre', category: '其他', title: '門票 · 別府空中纜車', amount: 800, currency: 'TWD', paid: false, note: '現場購票' },
  ],
};
