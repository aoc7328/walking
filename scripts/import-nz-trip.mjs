// 一次性腳本：把 Chictrip 的純文字行程轉成 walking app 的 Trip JSON
// 用 Google Places API (New) Text Search 自動補座標 / place_id / 正確地址。
// 執行：node scripts/import-nz-trip.mjs
// 輸出：./nz-trip-import.json

import fs from 'node:fs/promises';
import path from 'node:path';

// 從 .env.local 讀 API Key（避免明文寫死 push 到 GitHub）
async function loadApiKey() {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const text = await fs.readFile(envPath, 'utf8');
    const m = text.match(/VITE_GOOGLE_MAPS_API_KEY\s*=\s*(\S+)/);
    if (m) return m[1].trim();
  } catch {
    // ignore
  }
  throw new Error('找不到 VITE_GOOGLE_MAPS_API_KEY，請確認 .env.local 存在');
}

const API_KEY = await loadApiKey();

// 行程原始資料（手動解析自 Chictrip 純文字）
const TRIP_NAME = '2027紐西蘭';
const START_DATE = '2027-09-21';
const TOTAL_DAYS = 32; // 09-21 → 10-22

// 每個 item：{ time, name, stay }（stay 為總分鐘）
const DAYS_RAW = {
  1: [
    { time: '13:00', name: '基督城國際機場', stay: 120 },
    { time: '15:07', name: 'Sudima Christchurch Airport', stay: 60 },
  ],
  2: [
    { time: '09:00', name: 'Sudima Christchurch Airport', stay: 0 },
    { time: '09:06', name: 'Touchdown Car Rentals, Christchurch', stay: 90 },
    { time: '11:15', name: "Nor' Wester Cafe", stay: 60 },
    { time: '13:59', name: 'The Hamptons', stay: 91 },
    { time: '15:34', name: 'Kaikoura Seafood BBQ Kiosk', stay: 60 },
    { time: '16:44', name: 'New World Kaikoura', stay: 60 },
    { time: '17:50', name: 'The Hamptons', stay: 60 },
  ],
  3: [
    { time: '10:00', name: 'The Hamptons', stay: 0 },
    { time: '11:54', name: 'Powerhouse Cafe & Restaurant', stay: 90 },
    { time: '13:27', name: 'Edit Hanmer Springs', stay: 60 },
    { time: '14:32', name: 'Hanmer Springs Thermal Pools', stay: 120 },
    { time: '16:35', name: 'Saints Cafe, Restaurant & Bar', stay: 90 },
    { time: '18:09', name: 'Edit Hanmer Springs', stay: 60 },
  ],
  4: [
    { time: '10:00', name: 'Edit Hanmer Springs', stay: 0 },
    { time: '12:03', name: 'MK Restaurant', stay: 90 },
    { time: '13:42', name: 'Conical Hill Walking Track- start point', stay: 120 },
    { time: '15:50', name: 'Edit Hanmer Springs', stay: 60 },
    { time: '18:00', name: 'No.31 Restaurant and Bar', stay: 90 },
    { time: '19:37', name: 'Edit Hanmer Springs', stay: 60 },
  ],
  5: [
    { time: '09:00', name: 'Edit Hanmer Springs', stay: 0 },
    { time: '09:51', name: 'Weka Pass', stay: 15 },
    { time: '11:51', name: 'Rakaia Gorge Walkway', stay: 15 },
    { time: '12:25', name: 'The Staveley Store', stay: 90 },
    { time: '14:33', name: 'Geraldine Farmshop & Cafe', stay: 60 },
    { time: '15:36', name: 'The Vicarage Geraldine', stay: 40 },
    { time: '16:16', name: "Barker's Foodstore & Eatery", stay: 60 },
    { time: '17:17', name: 'Geraldine Cheese Company', stay: 40 },
    { time: '17:59', name: 'The Village Inn', stay: 100 },
    { time: '19:41', name: 'The Vicarage Geraldine', stay: 60 },
  ],
  6: [
    { time: '09:00', name: 'The Vicarage Geraldine', stay: 0 },
    { time: '09:56', name: 'Burkes Pass', stay: 15 },
    { time: '10:25', name: 'Lake Tekapo Lookout', stay: 15 },
    { time: '11:22', name: "Peter's Lookout", stay: 15 },
    { time: '11:48', name: 'Mount Cook Road', stay: 15 },
    { time: '12:09', name: 'Tasman Delta Cafe', stay: 90 },
    { time: '13:59', name: 'The Hermitage Hotel', stay: 60 },
  ],
  7: [
    { time: '08:00', name: 'The Hermitage Hotel', stay: 60 },
    { time: '09:11', name: 'Glacier Explorers', stay: 60 },
  ],
  8: [
    { time: '11:00', name: 'The Hermitage Hotel', stay: 0 },
    { time: '11:43', name: 'Mt Cook Alpine Salmon Shop', stay: 60 },
    { time: '12:54', name: 'Four Square Twizel', stay: 60 },
    { time: '14:06', name: 'SkyScape', stay: 60 },
  ],
  9: [
    { time: '10:00', name: 'SkyScape', stay: 0 },
    { time: '10:50', name: '好牧羊人教堂', stay: 60 },
    { time: '11:57', name: 'Kohan Restaurant', stay: 60 },
    { time: '13:12', name: 'Mount John', stay: 60 },
    { time: '14:20', name: '約翰山大學天文臺', stay: 30 },
    { time: '15:40', name: 'Four Square Twizel', stay: 60 },
    { time: '16:52', name: 'SkyScape', stay: 60 },
  ],
  10: [
    { time: '10:00', name: 'SkyScape', stay: 0 },
    { time: '10:52', name: '林迪斯隘口景觀台', stay: 15 },
    { time: '11:50', name: 'Clay Cliffs', stay: 15 },
    { time: '12:26', name: 'The Wrinkly Rams', stay: 90 },
    { time: '15:24', name: '848J+RF', stay: 60 },
  ],
  11: [
    { time: '08:00', name: '848J+RF', stay: 60 },
    { time: '09:00', name: '848J+RF', stay: 60 },
  ],
  12: [
    { time: '10:00', name: '848J+RF', stay: 0 },
    { time: '10:42', name: 'Rose Creek Farm - Central Otago', stay: 60 },
  ],
  13: [
    { time: '08:00', name: 'Rose Creek Farm - Central Otago', stay: 60 },
  ],
  14: [
    { time: '08:00', name: 'Rose Creek Farm - Central Otago', stay: 60 },
  ],
  32: [
    { time: '08:00', name: '基督城國際機場', stay: 60 },
  ],
};

// 飯店判斷拿掉：所有項目都標 isHotel: false，
// UI 統一用 idx+1 編號顯示，不再有 S/E/H 與紫色區分。

// 搜尋時的特殊提示（中文地點補上英文／加上地區 bias，避免 Google 找不到）
const SEARCH_HINTS = {
  基督城國際機場: 'Christchurch International Airport',
  好牧羊人教堂: 'Church of the Good Shepherd Lake Tekapo',
  約翰山大學天文臺: 'Mount John Observatory Lake Tekapo',
  林迪斯隘口景觀台: 'Lindis Pass Lookout',
  '848J+RF': '848J+RF Central Otago New Zealand', // Plus Code with regional context
};

function uuid() {
  return (
    [...crypto.getRandomValues(new Uint8Array(16))]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
  );
}

function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return date.toISOString().slice(0, 10);
}

async function searchPlace(name) {
  const query = SEARCH_HINTS[name] ?? name;
  const fullQuery = /[A-Za-z]/.test(query) ? `${query} New Zealand` : `${query} 紐西蘭`;
  const body = {
    textQuery: fullQuery,
    languageCode: 'zh-TW',
    regionCode: 'NZ',
    maxResultCount: 1,
  };
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places API ${res.status}: ${text}`);
  }
  const data = await res.json();
  const place = data.places?.[0];
  if (!place) {
    return null;
  }
  return {
    placeId: place.id,
    displayName: place.displayName?.text ?? name,
    address: place.formattedAddress ?? '',
    lat: place.location?.latitude,
    lng: place.location?.longitude,
    types: place.types ?? [],
  };
}

async function main() {
  // 1. 收集所有不重複的地點名稱
  const uniqueNames = new Set();
  for (const items of Object.values(DAYS_RAW)) {
    for (const it of items) uniqueNames.add(it.name);
  }
  const names = [...uniqueNames];
  console.log(`不重複地點：${names.length} 個`);

  // 2. 批次查 Google Places
  const placeMap = new Map();
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    process.stdout.write(`[${i + 1}/${names.length}] ${name} ... `);
    try {
      const result = await searchPlace(name);
      if (result) {
        placeMap.set(name, result);
        console.log(`✓ ${result.address}`);
      } else {
        placeMap.set(name, null);
        console.log('✗ 沒結果');
      }
    } catch (err) {
      console.log(`✗ ${err.message}`);
      placeMap.set(name, null);
    }
    // 輕微 throttle，避免太密集
    await new Promise((r) => setTimeout(r, 80));
  }

  // 3. 組裝 Trip JSON
  const days = [];
  for (let dayIdx = 1; dayIdx <= TOTAL_DAYS; dayIdx++) {
    const date = addDays(START_DATE, dayIdx - 1);
    const rawItems = DAYS_RAW[dayIdx] ?? [];
    const items = rawItems
      .map((raw) => {
        const result = placeMap.get(raw.name);
        if (!result) {
          // 查不到，丟一個座標 0,0 的 placeholder，使用者匯入後可以手動修
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
            stayMinutes: raw.stay,
            isHotel: false,
            arrivalManual: true,
          };
        }
        return {
          id: uuid(),
          place: {
            id: uuid(),
            placeId: result.placeId,
            name: result.displayName,
            address: result.address,
            coordinates: { lat: result.lat, lng: result.lng },
            types: result.types,
          },
          arrivalTime: raw.time,
          stayMinutes: raw.stay,
          isHotel: false,
          arrivalManual: true,
        };
      })
      .filter(Boolean);

    // legs：每兩個 item 之間一段，預設 driving，duration 留空（匯入後 walking app 會自動跑 Directions）
    const legs = [];
    for (let i = 0; i < items.length - 1; i++) {
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

  const outPath = path.join(process.cwd(), 'nz-trip-import.json');
  await fs.writeFile(outPath, JSON.stringify(trip, null, 2), 'utf8');
  console.log(`\n✓ 寫到 ${outPath}`);

  // 報告
  const notFound = [...placeMap.entries()].filter(([, v]) => v === null).map(([k]) => k);
  if (notFound.length > 0) {
    console.log(`\n⚠ 查不到的地點 (${notFound.length})：`);
    notFound.forEach((n) => console.log(`  - ${n}`));
  } else {
    console.log('\n✓ 全部 41 個地點都查到了');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
