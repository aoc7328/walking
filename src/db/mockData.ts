import type { Trip } from '../types/trip';
import type { Place } from '../types/place';

function place(id: string, name: string, address: string, lat: number, lng: number, rating: number, reviewCount: number): Place {
  return {
    id,
    placeId: id,
    name,
    address,
    coordinates: { lat, lng },
    rating,
    reviewCount,
    types: ['point_of_interest'],
  };
}

const hotelTaichung: Place = {
  ...place('h-tc-fuhua', '福華大飯店', '臺中市西屯區安和路 215 號', 24.166, 120.638, 4.3, 1200),
  types: ['lodging'],
};

const hotelTaipei: Place = {
  ...place('h-tp', '臺北凱撒大飯店', '臺北市中正區忠孝西路一段 38 號', 25.045, 121.518, 4.4, 2300),
  types: ['lodging'],
};

const hotelKaohsiung: Place = {
  ...place('h-ks', '高雄漢來大飯店', '高雄市前金區成功一路 266 號', 22.617, 120.301, 4.5, 1900),
  types: ['lodging'],
};

export const MOCK_TRIP: Trip = {
  id: 'demo-trip',
  name: '臺灣西部　七日行旅',
  startDate: '2026-06-01',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  favorites: [
    place('p-fav-1', '老王牛肉麵', '臺中市西區', 24.143, 120.66, 4.5, 412),
  ],
  days: [
    {
      id: 'day-1',
      dayIndex: 1,
      date: '2026-06-01',
      city: '臺北',
      items: [
        { id: 'i-1-1', place: hotelTaipei, arrivalTime: '09:00', stayMinutes: 60, isHotel: true, notes: ['含早餐'] },
        { id: 'i-1-2', place: place('p-1-2', '故宮博物院', '臺北市士林區至善路二段 221 號', 25.102, 121.548, 4.5, 5400), arrivalTime: '10:30', stayMinutes: 150, isHotel: false },
        { id: 'i-1-3', place: place('p-1-3', '士林夜市', '臺北市士林區', 25.088, 121.524, 4.2, 12000), arrivalTime: '18:00', stayMinutes: 120, isHotel: false },
        { id: 'i-1-4', place: hotelTaipei, arrivalTime: '21:00', stayMinutes: 30, isHotel: true },
      ],
      legs: [
        { mode: 'driving', durationMinutes: 25 },
        { mode: 'transit', durationMinutes: 40 },
        { mode: 'driving', durationMinutes: 20 },
      ],
    },
    {
      id: 'day-2',
      dayIndex: 2,
      date: '2026-06-02',
      city: '臺北',
      items: [
        { id: 'i-2-1', place: hotelTaipei, arrivalTime: '09:00', stayMinutes: 30, isHotel: true },
        { id: 'i-2-2', place: place('p-2-2', '中正紀念堂', '臺北市中正區', 25.035, 121.521, 4.4, 8000), arrivalTime: '10:00', stayMinutes: 90, isHotel: false },
        { id: 'i-2-3', place: place('p-2-3', '永康街', '臺北市大安區', 25.034, 121.529, 4.5, 3500), arrivalTime: '12:00', stayMinutes: 120, isHotel: false },
        { id: 'i-2-4', place: place('p-2-4', '臺北 101', '臺北市信義區', 25.034, 121.564, 4.5, 24000), arrivalTime: '15:00', stayMinutes: 180, isHotel: false },
        { id: 'i-2-5', place: hotelTaipei, arrivalTime: '20:00', stayMinutes: 30, isHotel: true },
      ],
      legs: [
        { mode: 'walking', durationMinutes: 15 },
        { mode: 'walking', durationMinutes: 10 },
        { mode: 'driving', durationMinutes: 20 },
        { mode: 'driving', durationMinutes: 25 },
      ],
    },
    {
      id: 'day-3',
      dayIndex: 3,
      date: '2026-06-03',
      city: '臺中',
      items: [
        { id: 'i-3-1', place: hotelTaichung, arrivalTime: '09:00', stayMinutes: 60, isHotel: true, notes: ['含早餐，自助式', '退房 11:00 前'] },
        { id: 'i-3-2', place: place('p-3-2', '國立自然科學博物館', '臺中市北區館前路 1 號', 24.158, 120.661, 4.5, 9800), arrivalTime: '10:00', stayMinutes: 120, isHotel: false },
        { id: 'i-3-3', place: place('p-3-3', '鼎泰豐臺中店', '臺中市西區公益路', 24.151, 120.654, 4.4, 1800), arrivalTime: '12:30', stayMinutes: 90, isHotel: false, notes: ['訂位代碼 A823', '點小籠包要等 30 分'] },
        { id: 'i-3-4', place: place('p-3-4', '草悟道', '臺中市西區', 24.151, 120.665, 4.4, 4200), arrivalTime: '14:00', stayMinutes: 90, isHotel: false },
        { id: 'i-3-5', place: place('p-3-5', '審計新村', '臺中市西區民生路 368 巷', 24.146, 120.666, 4.4, 5100), arrivalTime: '16:00', stayMinutes: 90, isHotel: false },
        { id: 'i-3-6', place: place('p-3-6', '逢甲夜市', '臺中市西屯區文華路', 24.179, 120.646, 4.3, 18000), arrivalTime: '18:00', stayMinutes: 120, isHotel: false, notes: ['必吃：明倫蛋餅、官芝霖大腸包小腸'] },
        { id: 'i-3-7', place: hotelTaichung, arrivalTime: '20:30', stayMinutes: 0, isHotel: true, notes: ['回飯店休息'] },
      ],
      legs: [
        { mode: 'driving', durationMinutes: 15 },
        { mode: 'walking', durationMinutes: 8 },
        { mode: 'driving', durationMinutes: 5 },
        { mode: 'walking', durationMinutes: 12 },
        { mode: 'driving', durationMinutes: 20 },
        { mode: 'driving', durationMinutes: 18 },
      ],
    },
    {
      id: 'day-4',
      dayIndex: 4,
      date: '2026-06-04',
      city: '臺中',
      items: [
        { id: 'i-4-1', place: hotelTaichung, arrivalTime: '09:00', stayMinutes: 30, isHotel: true },
        { id: 'i-4-2', place: place('p-4-2', '彩虹眷村', '臺中市南屯區春安路', 24.13, 120.611, 4.2, 6200), arrivalTime: '10:00', stayMinutes: 60, isHotel: false },
        { id: 'i-4-3', place: place('p-4-3', '高美濕地', '臺中市清水區', 24.31, 120.547, 4.5, 12000), arrivalTime: '16:00', stayMinutes: 120, isHotel: false },
        { id: 'i-4-4', place: hotelTaichung, arrivalTime: '20:00', stayMinutes: 0, isHotel: true },
      ],
      legs: [
        { mode: 'driving', durationMinutes: 20 },
        { mode: 'driving', durationMinutes: 60 },
        { mode: 'driving', durationMinutes: 60 },
      ],
    },
    {
      id: 'day-5',
      dayIndex: 5,
      date: '2026-06-05',
      city: '高雄',
      items: [
        { id: 'i-5-1', place: hotelKaohsiung, arrivalTime: '12:00', stayMinutes: 30, isHotel: true },
        { id: 'i-5-2', place: place('p-5-2', '駁二藝術特區', '高雄市鹽埕區大勇路 1 號', 22.621, 120.282, 4.5, 14000), arrivalTime: '13:00', stayMinutes: 150, isHotel: false },
        { id: 'i-5-3', place: place('p-5-3', '愛河', '高雄市前金區', 22.625, 120.295, 4.4, 9100), arrivalTime: '17:00', stayMinutes: 60, isHotel: false },
        { id: 'i-5-4', place: place('p-5-4', '六合夜市', '高雄市新興區六合二路', 22.632, 120.302, 4.2, 11000), arrivalTime: '18:30', stayMinutes: 120, isHotel: false },
        { id: 'i-5-5', place: place('p-5-5', '高雄展覽館夜景', '高雄市前鎮區成功二路', 22.595, 120.302, 4.4, 3200), arrivalTime: '21:00', stayMinutes: 45, isHotel: false },
        { id: 'i-5-6', place: hotelKaohsiung, arrivalTime: '22:30', stayMinutes: 0, isHotel: true },
      ],
      legs: [
        { mode: 'walking', durationMinutes: 15 },
        { mode: 'walking', durationMinutes: 12 },
        { mode: 'walking', durationMinutes: 8 },
        { mode: 'driving', durationMinutes: 15 },
        { mode: 'driving', durationMinutes: 12 },
      ],
    },
    {
      id: 'day-6',
      dayIndex: 6,
      date: '2026-06-06',
      city: '高雄',
      items: [
        { id: 'i-6-1', place: hotelKaohsiung, arrivalTime: '09:00', stayMinutes: 30, isHotel: true },
        { id: 'i-6-2', place: place('p-6-2', '蓮池潭', '高雄市左營區', 22.677, 120.293, 4.3, 6700), arrivalTime: '10:00', stayMinutes: 90, isHotel: false },
        { id: 'i-6-3', place: place('p-6-3', '旗津', '高雄市旗津區', 22.611, 120.273, 4.4, 8800), arrivalTime: '13:00', stayMinutes: 180, isHotel: false },
        { id: 'i-6-4', place: place('p-6-4', '英國領事館', '高雄市鼓山區', 22.62, 120.265, 4.4, 4500), arrivalTime: '17:00', stayMinutes: 60, isHotel: false },
        { id: 'i-6-5', place: hotelKaohsiung, arrivalTime: '19:00', stayMinutes: 0, isHotel: true },
      ],
      legs: [
        { mode: 'driving', durationMinutes: 25 },
        { mode: 'driving', durationMinutes: 40 },
        { mode: 'driving', durationMinutes: 20 },
        { mode: 'driving', durationMinutes: 20 },
      ],
    },
    {
      id: 'day-7',
      dayIndex: 7,
      date: '2026-06-07',
      city: '高雄',
      items: [
        { id: 'i-7-1', place: hotelKaohsiung, arrivalTime: '09:00', stayMinutes: 30, isHotel: true },
        { id: 'i-7-2', place: place('p-7-2', '佛光山', '高雄市大樹區', 22.831, 120.435, 4.5, 7200), arrivalTime: '11:00', stayMinutes: 180, isHotel: false },
        { id: 'i-7-3', place: place('p-7-3', '高鐵左營站', '高雄市左營區', 22.687, 120.308, 4.3, 4100), arrivalTime: '16:00', stayMinutes: 0, isHotel: false },
      ],
      legs: [
        { mode: 'driving', durationMinutes: 50 },
        { mode: 'driving', durationMinutes: 60 },
      ],
    },
  ],
};
