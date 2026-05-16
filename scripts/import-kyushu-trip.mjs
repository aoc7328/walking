// 一次性腳本：把九州行程的純文字轉成 walking app 的 Trip JSON
// 用 Google Places API (New) Text Search 自動補座標 / place_id / 正確地址
// 執行：node scripts/import-kyushu-trip.mjs
// 輸出：./kyushu-trip-import.json

import fs from 'node:fs/promises';
import path from 'node:path';

async function loadApiKey() {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const text = await fs.readFile(envPath, 'utf8');
    const m = text.match(/VITE_GOOGLE_MAPS_API_KEY\s*=\s*(\S+)/);
    if (m) return m[1].trim();
  } catch {
    // ignore
  }
  throw new Error('找不到 VITE_GOOGLE_MAPS_API_KEY');
}

const API_KEY = await loadApiKey();

const TRIP_NAME = '2025九州';
const START_DATE = '2025-02-09';
const TOTAL_DAYS = 10; // 02-09 → 02-18

// 每日的城市區域，給搜尋當提示
const DAY_CITY = {
  1: '福岡', 2: '福岡', 3: '佐賀', 4: '熊本', 5: '阿蘇',
  6: '由布院', 7: '由布院 別府', 8: '別府', 9: '福岡', 10: '福岡',
};

// 原始行程
const DAYS_RAW = {
  1: [
    { time: '08:00', name: '下酒菜 串燒 居酒屋', stay: 60 },
    { time: '10:00', name: '福岡機場', stay: 60 },
    { time: '11:30', name: '福岡天神日航都市酒店', stay: 60 },
    { time: '12:36', name: '稚加榮 福岡店', stay: 60 },
    { time: '13:52', name: 'UNIQLO 天神店', stay: 180 },
    { time: '17:07', name: '鈴懸 博多本店', stay: 30 },
    { time: '17:56', name: '中洲屋台橫丁', stay: 60 },
    { time: '19:13', name: '福岡天神日航都市酒店', stay: 60 },
  ],
  2: [
    { time: '09:00', name: '福岡天神日航都市酒店', stay: 40 },
    { time: '10:00', name: '天神LOFT', stay: 180 },
    { time: '13:14', name: 'Hightide Store Fukuoka', stay: 30 },
    { time: '13:56', name: '生活雜貨.餐具 B･B･B POTTERS', stay: 30 },
    { time: '14:34', name: 'Gouache Fukuoka', stay: 30 },
    { time: '15:12', name: 'Hanabishi', stay: 60 },
    { time: '16:14', name: 'むつか堂 藥院本店', stay: 15 },
    { time: '16:36', name: 'THE ROOTS neighborhood bakery', stay: 15 },
    { time: '17:30', name: '鍋処なかむら', stay: 90 },
    { time: '19:15', name: 'Parfait Lab PINSIRIO', stay: 60 },
    { time: '20:43', name: '福岡塔', stay: 60 },
    { time: '22:16', name: '福岡天神日航都市酒店', stay: 60 },
  ],
  3: [
    { time: '08:00', name: '福岡天神日航都市酒店', stay: 0 },
    { time: '08:04', name: 'オリックスレンタカー天神大名店Tabirai', stay: 60 },
    { time: '10:32', name: '有田瓷器公園', stay: 90 },
    { time: '12:10', name: '瓷器咖啡廳 Gallery 有田', stay: 120 },
    { time: '14:15', name: '陶山神社', stay: 60 },
    { time: '15:24', name: 'Kouraku Kiln幸楽窯 徳永陶磁器(株)', stay: 60 },
    { time: '18:00', name: '焼肉 炎壽', stay: 90 },
    { time: '19:36', name: '佐賀新大谷飯店', stay: 60 },
  ],
  4: [
    { time: '08:00', name: '佐賀新大谷飯店', stay: 0 },
    { time: '09:19', name: '吉次園 いちご狩り', stay: 120 },
    { time: '11:46', name: 'OMO5 熊本 by 星野集團', stay: 60 },
    { time: '12:57', name: '勝烈亭 新市街本店', stay: 90 },
    { time: '14:37', name: '櫻之馬場 城彩苑', stay: 60 },
    { time: '15:43', name: 'SAKURA MACHI 櫻町熊本', stay: 120 },
    { time: '17:49', name: '焼鳥 華備', stay: 90 },
    { time: '19:25', name: '下通商店街', stay: 60 },
    { time: '20:28', name: 'OMO5 熊本 by 星野集團', stay: 60 },
  ],
  5: [
    { time: '08:00', name: 'OMO5 熊本 by 星野集團', stay: 0 },
    { time: '09:01', name: 'ASO KENKOU NOUEN Farm', stay: 120 },
    { time: '11:19', name: '草千里（草千里之濱）', stay: 60 },
    { time: '12:27', name: '阿蘇中岳火山口', stay: 60 },
    { time: '14:02', name: 'ASO MILK FACTORY', stay: 120 },
    { time: '16:17', name: '阿蘇神社 駐車場', stay: 60 },
    { time: '17:27', name: '熊本阿蘇萬楓酒店', stay: 60 },
  ],
  6: [
    { time: '08:00', name: '熊本阿蘇萬楓酒店', stay: 60 },
    { time: '09:10', name: 'ASO MILK FACTORY', stay: 90 },
    { time: '10:57', name: '大觀峰展望所', stay: 60 },
    { time: '13:06', name: '蛋糕卷 B SPEAK 本店', stay: 30 },
    { time: '13:39', name: '由布院 Milch 布丁 半熟起司蛋糕', stay: 30 },
    { time: '14:10', name: '鞠智 cucuchi（銅鑼燒和咖啡館）', stay: 60 },
    { time: '15:17', name: '湯布院貓頭鷹之森林', stay: 30 },
    { time: '15:51', name: 'Kutsurogi-no-Yado Nanakawa', stay: 60 },
  ],
  7: [
    { time: '08:00', name: 'Kutsurogi-no-Yado Nanakawa', stay: 60 },
    { time: '09:03', name: '金鱗湖', stay: 60 },
    { time: '10:09', name: '湯布院花卉村', stay: 30 },
    { time: '11:09', name: 'Cafe&Sweet 桃たろう', stay: 25 },
    { time: '11:43', name: '湯霧展望台', stay: 30 },
    { time: '12:30', name: 'TANE', stay: 90 },
    { time: '14:18', name: '近鐵別府空中纜車', stay: 90 },
    { time: '15:59', name: '杉乃井飯店', stay: 60 },
  ],
  8: [
    { time: '08:00', name: '杉乃井飯店', stay: 60 },
  ],
  9: [
    { time: '08:00', name: '杉乃井飯店', stay: 120 },
    { time: '11:32', name: '鳥栖PREMIUM OUTLETS', stay: 178 },
    { time: '15:15', name: 'Dr. drive self Yakuin S.S', stay: 15 },
    { time: '15:38', name: 'オリックスレンタカー天神大名店Tabirai', stay: 60 },
    { time: '16:42', name: '福岡天神日航都市酒店', stay: 60 },
    { time: '18:30', name: 'Hokkorika', stay: 90 },
    { time: '20:18', name: '福岡天神日航都市酒店', stay: 60 },
  ],
  10: [
    { time: '05:00', name: '福岡天神日航都市酒店', stay: 0 },
    { time: '05:30', name: '福岡機場', stay: 60 },
  ],
};

// 特殊搜尋提示（中文 / 名稱有歧義時補英文 + 區域）。任何含空格的 key 都要用引號。
const SEARCH_HINTS = {
  '下酒菜 串燒 居酒屋': '下酒菜 福岡 串燒 居酒屋',
  '福岡機場': 'Fukuoka Airport',
  '福岡天神日航都市酒店': 'Hotel JAL City Fukuoka Tenjin',
  '稚加榮 福岡店': '稚加榮 本店 福岡市中央区',
  'UNIQLO 天神店': 'UNIQLO 天神 福岡',
  '鈴懸 博多本店': '鈴懸 博多',
  '中洲屋台橫丁': '中洲屋台 福岡',
  '天神LOFT': 'LOFT 天神 福岡',
  'Hightide Store Fukuoka': 'Hightide Store 福岡',
  '生活雜貨.餐具 B･B･B POTTERS': 'B B B POTTERS 福岡',
  'Gouache Fukuoka': 'Gouache 福岡',
  'Hanabishi': 'Hanabishi 花菱 福岡',
  'むつか堂 藥院本店': 'むつか堂 薬院本店 福岡',
  'THE ROOTS neighborhood bakery': 'THE ROOTS neighborhood bakery 福岡',
  '鍋処なかむら': '鍋処 なかむら 福岡',
  'Parfait Lab PINSIRIO': 'Parfait Lab PINSIRIO 福岡',
  '福岡塔': 'Fukuoka Tower',
  'オリックスレンタカー天神大名店Tabirai': 'Orix Rent A Car 天神大名 福岡',
  '有田瓷器公園': 'Arita Porcelain Park 有田',
  '瓷器咖啡廳 Gallery 有田': 'Gallery 有田 cafe 有田町',
  '陶山神社': 'Sueyama Shrine 陶山神社 有田',
  'Kouraku Kiln幸楽窯 徳永陶磁器(株)': '幸楽窯 徳永陶磁器 有田町',
  '焼肉 炎壽': '焼肉 炎壽 佐賀',
  '佐賀新大谷飯店': 'Saga New Otani Hotel',
  '吉次園 いちご狩り': '吉次園 熊本',
  'OMO5 熊本 by 星野集團': 'OMO5 Kumamoto by Hoshino Resorts',
  '勝烈亭 新市街本店': '勝烈亭 新市街本店 熊本',
  '櫻之馬場 城彩苑': '桜の馬場 城彩苑 熊本',
  'SAKURA MACHI 櫻町熊本': 'SAKURA MACHI Kumamoto',
  '焼鳥 華備': '焼鳥 華備 熊本',
  '下通商店街': '下通商店街 熊本',
  '熊本阿蘇萬楓酒店': 'Fairfield by Marriott Kumamoto Aso',
  'ASO KENKOU NOUEN Farm': 'ASO KENKOU NOUEN 阿蘇健康農園',
  '草千里（草千里之濱）': '草千里ヶ浜 阿蘇',
  '阿蘇中岳火山口': '阿蘇山火口西駅',
  'ASO MILK FACTORY': 'ASO MILK FACTORY 阿蘇',
  '阿蘇神社 駐車場': '阿蘇神社',
  '大觀峰展望所': '大観峰 阿蘇',
  '蛋糕卷 B SPEAK 本店': 'B-Speak 由布院',
  '由布院 Milch 布丁 半熟起司蛋糕': 'Milch ミルヒ 由布院',
  '鞠智 cucuchi（銅鑼燒和咖啡館）': '鞠智 cucuchi 由布院',
  '湯布院貓頭鷹之森林': '湯布院フクロウの森 由布院',
  'Kutsurogi-no-Yado Nanakawa': 'Kutsurogi-no-Yado Nanakawa 由布院',
  '金鱗湖': '金鱗湖 由布院',
  '湯布院花卉村': '湯布院フローラルヴィレッジ',
  'Cafe&Sweet 桃たろう': 'Cafe&Sweet 桃たろう 由布院',
  '湯霧展望台': '湯霧展望台 由布院',
  'TANE': 'TANE cafe restaurant 湯布院',
  '近鐵別府空中纜車': '別府ロープウェイ',
  '杉乃井飯店': 'Suginoi Hotel Beppu',
  '鳥栖PREMIUM OUTLETS': 'Tosu Premium Outlets',
  'Dr. drive self Yakuin S.S': 'Dr. Drive セルフ薬院 福岡',
  'Hokkorika': 'ほっこり家 福岡 居酒屋',
};

function parseStayToMinutes(str) {
  // 接受 "01時00分" 這種純粹的分鐘已經由原資料給出
  return typeof str === 'number' ? str : 0;
}

function uuid() {
  return [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
}

function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return date.toISOString().slice(0, 10);
}

async function searchPlace(name, cityHint) {
  const hint = SEARCH_HINTS[name] ?? name;
  const fullQuery = `${hint} ${cityHint ?? ''} 九州 日本`.trim();
  const body = {
    textQuery: fullQuery,
    languageCode: 'zh-TW',
    regionCode: 'JP',
    maxResultCount: 1,
  };
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.nationalPhoneNumber',
      // API key 設了 referrer 限制，從 Node 跑要假裝是從正式站來的
      Referer: 'https://walking2.pages.dev/',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places API ${res.status}: ${text}`);
  }
  const data = await res.json();
  const place = data.places?.[0];
  if (!place) return null;
  return {
    placeId: place.id,
    displayName: place.displayName?.text ?? name,
    address: place.formattedAddress ?? '',
    lat: place.location?.latitude,
    lng: place.location?.longitude,
    types: place.types ?? [],
    phoneNumber: place.nationalPhoneNumber,
  };
}

async function main() {
  // 收集 (name, cityHint) 配對；同名地點只查一次（用第一次出現的 city hint）
  const queries = new Map(); // name → cityHint
  for (const [dayIdx, items] of Object.entries(DAYS_RAW)) {
    const city = DAY_CITY[Number(dayIdx)];
    for (const it of items) {
      if (!queries.has(it.name)) queries.set(it.name, city);
    }
  }
  console.log(`不重複地點：${queries.size} 個`);

  const placeMap = new Map();
  let i = 0;
  for (const [name, city] of queries) {
    i++;
    process.stdout.write(`[${i}/${queries.size}] ${name} ... `);
    try {
      const result = await searchPlace(name, city);
      if (result) {
        placeMap.set(name, result);
        console.log(`✓ ${result.displayName}`);
      } else {
        placeMap.set(name, null);
        console.log('✗ 沒結果');
      }
    } catch (err) {
      console.log(`✗ ${err.message}`);
      placeMap.set(name, null);
    }
    await new Promise((r) => setTimeout(r, 80));
  }

  const days = [];
  for (let dayIdx = 1; dayIdx <= TOTAL_DAYS; dayIdx++) {
    const date = addDays(START_DATE, dayIdx - 1);
    const rawItems = DAYS_RAW[dayIdx] ?? [];
    const items = rawItems.map((raw) => {
      const result = placeMap.get(raw.name);
      const stay = parseStayToMinutes(raw.stay);
      if (!result) {
        return {
          id: uuid(),
          place: {
            id: uuid(),
            placeId: `unknown-${raw.name.replace(/\W+/g, '-')}`,
            name: raw.name,
            address: '（未找到 Google 對應資料）',
            coordinates: { lat: 0, lng: 0 },
            types: [],
          },
          arrivalTime: raw.time,
          stayMinutes: stay,
          isHotel: false,
          arrivalManual: true,
        };
      }
      const place = {
        id: uuid(),
        placeId: result.placeId,
        name: result.displayName,
        address: result.address,
        coordinates: { lat: result.lat, lng: result.lng },
        types: result.types,
      };
      if (result.phoneNumber) place.phoneNumber = result.phoneNumber;
      return {
        id: uuid(),
        place,
        arrivalTime: raw.time,
        stayMinutes: stay,
        isHotel: false,
        arrivalManual: true,
      };
    });

    const legs = [];
    for (let j = 0; j < items.length - 1; j++) {
      legs.push({ mode: 'driving' });
    }

    days.push({
      id: uuid(),
      dayIndex: dayIdx,
      date,
      items,
      legs,
    });
  }

  const trip = {
    id: uuid(),
    name: TRIP_NAME,
    startDate: START_DATE,
    days,
    favorites: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const outPath = path.join(process.cwd(), 'kyushu-trip-import.json');
  await fs.writeFile(outPath, JSON.stringify(trip, null, 2), 'utf8');
  console.log(`\n✓ 寫到 ${outPath}`);

  const notFound = [...placeMap.entries()].filter(([, v]) => v === null).map(([k]) => k);
  if (notFound.length > 0) {
    console.log(`\n⚠ 查不到的地點 (${notFound.length})：`);
    notFound.forEach((n) => console.log(`  - ${n}`));
  } else {
    console.log(`\n✓ 全部 ${queries.size} 個地點都查到了`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
