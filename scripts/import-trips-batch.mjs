// 一次性腳本：批次匯入多個行程到 KV。
// 用 Google Places API 自動補座標 / place_id / 地址 / 電話。
// 執行：node scripts/import-trips-batch.mjs
// 為每個 trip 個別寫 *.import.json 並上傳到 KV。

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

async function loadApiKey() {
  const text = await fs.readFile(path.resolve(process.cwd(), '.env.local'), 'utf8');
  const m = text.match(/VITE_GOOGLE_MAPS_API_KEY\s*=\s*(\S+)/);
  if (!m) throw new Error('找不到 VITE_GOOGLE_MAPS_API_KEY');
  return m[1].trim();
}
const API_KEY = await loadApiKey();

const ACCOUNT_HASH = 'a027ebb481b39a614003191d591dc5bbd370bb7798bc7bb13c39507a57e12a72';
const ORIGIN = 'https://walking2.pages.dev';

// ============ 三個 trip 的資料 ============

const TRIPS = [
  {
    name: '2026 說走就走去東京',
    startDate: '2026-01-08',
    totalDays: 7,
    regionCode: 'JP',
    bias: '東京 日本',
    dayCity: { 1: '東京 淺草 銀座', 2: '東京 新宿 表參道 澀谷', 3: '東京 新宿', 4: '東京 銀座 麻布台', 5: '東京 銀座 築地', 6: '東京 押上 幕張', 7: '東京 上野' },
    hints: {
      '成田國際機場': 'Narita International Airport',
      '東京灣潮見王子大飯店': 'Tokyo Bay Shiomi Prince Hotel',
      'Daikoku Drug Asakusa Chuo': 'Daikoku Drug Asakusa 大國藥妝 淺草',
      'IMADEYA GINZA': 'IMADEYA 銀座',
      'Matsuba Zushi Tatsumi': '松葉鮨 辰巳 江東区',
      'Map Camera': 'Map Camera 新宿',
      "McDonald's 麥當勞新宿西口店": "McDonald's 新宿西口",
      '表參道Hills': 'Omotesando Hills',
      '45RBadou-R Flagship Store': '45R 青山旗艦店',
      'Curensology 青山': 'Curensology 青山店',
      'Whim Gazette Aoyama': 'Whim Gazette 青山',
      'mizuiro ind 青山店': 'mizuiro ind 青山',
      'TOMORROWLAND Shibuya Flag Ship Shop': 'TOMORROWLAND 澀谷旗艦店',
      'UNITED ARROWS 澀谷SCRAMBLE SQAURE店': 'UNITED ARROWS Shibuya Scramble Square',
      'Spick & Span Shibuya Hikarie ShinQs': 'Spick & Span Hikarie ShinQs 澀谷',
      'Tsukiji Kagura Sushi': '築地 神楽寿司',
      'Somen': '神楽坂 そめん 蕎麦',
      'Hokusai Sabō': '北齋茶房 押上',
      '伊勢丹 新宿店': 'Isetan 新宿',
      '東京聖瑪利亞主教座堂': 'St. Mary\'s Cathedral Tokyo 東京カテドラル',
      'asahi': '澀谷 朝日 居酒屋',
      '銀座 伊東屋 本店': 'Itoya Ginza 伊東屋',
      '煉瓦亭': '煉瓦亭 銀座',
      'On 東京銀座旗艦店': 'On Tokyo Ginza 銀座',
      '銀座文明堂 BUNMEIDO CAFE GINZA': 'Bunmeido Cafe 銀座',
      '麻布台之丘': 'Azabudai Hills 麻布台',
      '王子芝公園': '芝公園',
      'Torigoro': '鳥五郎 麻布台 居酒屋',
      'The Room': 'The Room 麻布台 bar',
      'bills Ginza': 'bills 銀座',
      'Okuno Building': 'Okuno Building 銀座 奥野ビル',
      'HIGASHIYA 銀座': 'HIGASHIYA 銀座',
      '歌舞伎座屋上庭園': 'Kabukiza 屋上庭園',
      '築地場外市場': 'Tsukiji Outer Market 築地場外',
      'Shutoku No. 2 store': '寿徳 二号店 築地',
      '墨田水族館': 'Sumida Aquarium 墨田',
      'Mukojima Shichifuku Suzume-no-Oyado': '向島七福神 雀の宿',
      '三井OUTLET PARK 幕張': 'Mitsui Outlet Park 幕張',
      'Café Lapin': 'Cafe Lapin 上野',
      '2k540 Aki-Oka Artisan': '2k540 Aki-Oka Artisan 秋葉原',
      '客美多咖啡 上野廣小路店': 'Komeda Coffee 上野広小路',
      '松坂屋上野店': 'Matsuzakaya 上野',
      'Ueno Station': '上野駅 JR',
    },
    days: {
      1: [
        { time: '08:00', name: '成田國際機場', stay: 210 },
        { time: '12:28', name: '淺草今半 國際通本店', stay: 90 },
        { time: '14:06', name: 'Daikoku Drug Asakusa Chuo', stay: 40 },
        { time: '15:14', name: 'IMADEYA GINZA', stay: 40 },
        { time: '16:16', name: '東京灣潮見王子大飯店', stay: 20 },
        { time: '17:00', name: 'Matsuba Zushi Tatsumi', stay: 60 },
        { time: '18:24', name: '東京灣潮見王子大飯店', stay: 60 },
      ],
      2: [
        { time: '08:00', name: '東京灣潮見王子大飯店', stay: 135 },
        { time: '10:51', name: 'Map Camera', stay: 90 },
        { time: '12:23', name: "McDonald's 麥當勞新宿西口店", stay: 30 },
        { time: '13:06', name: '表參道Hills', stay: 60 },
        { time: '14:15', name: '45RBadou-R Flagship Store', stay: 30 },
        { time: '14:52', name: 'Curensology 青山', stay: 30 },
        { time: '15:24', name: 'Whim Gazette Aoyama', stay: 30 },
        { time: '15:57', name: 'mizuiro ind 青山店', stay: 30 },
        { time: '16:44', name: 'TOMORROWLAND Shibuya Flag Ship Shop', stay: 30 },
        { time: '17:22', name: 'UNITED ARROWS 澀谷SCRAMBLE SQAURE店', stay: 30 },
        { time: '17:55', name: 'Spick & Span Shibuya Hikarie ShinQs', stay: 30 },
        { time: '18:52', name: 'Tsukiji Kagura Sushi', stay: 60 },
        { time: '20:19', name: '東京灣潮見王子大飯店', stay: 60 },
      ],
      3: [
        { time: '08:00', name: '東京灣潮見王子大飯店', stay: 120 },
        { time: '10:33', name: 'Somen', stay: 60 },
        { time: '11:39', name: 'Hokusai Sabō', stay: 60 },
        { time: '13:18', name: '伊勢丹 新宿店', stay: 60 },
        { time: '14:40', name: '東京聖瑪利亞主教座堂', stay: 60 },
        { time: '16:15', name: '東京灣潮見王子大飯店', stay: 15 },
        { time: '18:00', name: 'asahi', stay: 120 },
        { time: '20:36', name: '東京灣潮見王子大飯店', stay: 60 },
      ],
      4: [
        { time: '08:00', name: '東京灣潮見王子大飯店', stay: 90 },
        { time: '09:52', name: '銀座 伊東屋 本店', stay: 120 },
        { time: '11:55', name: '煉瓦亭', stay: 90 },
        { time: '13:29', name: 'On 東京銀座旗艦店', stay: 60 },
        { time: '14:34', name: '銀座文明堂 BUNMEIDO CAFE GINZA', stay: 90 },
        { time: '16:25', name: '麻布台之丘', stay: 60 },
        { time: '17:38', name: '王子芝公園', stay: 20 },
        { time: '18:15', name: 'Torigoro', stay: 60 },
        { time: '19:38', name: 'The Room', stay: 120 },
        { time: '22:13', name: '東京灣潮見王子大飯店', stay: 60 },
      ],
      5: [
        { time: '08:00', name: '東京灣潮見王子大飯店', stay: 135 },
        { time: '10:50', name: 'bills Ginza', stay: 90 },
        { time: '12:25', name: 'Okuno Building', stay: 60 },
        { time: '13:29', name: 'HIGASHIYA 銀座', stay: 30 },
        { time: '14:11', name: '歌舞伎座屋上庭園', stay: 30 },
        { time: '14:52', name: '築地場外市場', stay: 60 },
        { time: '16:50', name: 'Shutoku No. 2 store', stay: 120 },
        { time: '19:10', name: '東京灣潮見王子大飯店', stay: 60 },
      ],
      6: [
        { time: '08:00', name: '東京灣潮見王子大飯店', stay: 90 },
        { time: '10:06', name: '墨田水族館', stay: 120 },
        { time: '12:21', name: 'Mukojima Shichifuku Suzume-no-Oyado', stay: 90 },
        { time: '14:57', name: '三井OUTLET PARK 幕張', stay: 140 },
        { time: '18:03', name: '東京灣潮見王子大飯店', stay: 60 },
      ],
      7: [
        { time: '08:00', name: '東京灣潮見王子大飯店', stay: 60 },
        { time: '09:25', name: 'Café Lapin', stay: 60 },
        { time: '10:31', name: '2k540 Aki-Oka Artisan', stay: 60 },
        { time: '11:42', name: '客美多咖啡 上野廣小路店', stay: 60 },
        { time: '12:45', name: '松坂屋上野店', stay: 60 },
        { time: '13:53', name: 'Ueno Station', stay: 10 },
        { time: '15:30', name: '成田國際機場', stay: 60 },
      ],
    },
  },

  {
    name: '2026北海道',
    startDate: '2026-10-04',
    totalDays: 21,
    regionCode: 'JP',
    bias: '北海道 日本',
    dayCity: { 1: '札幌', 2: '札幌', 4: '富良野', 6: '富良野 美瑛', 8: '美瑛 旭川', 10: '旭川', 12: '層雲峽', 14: '層雲峽 阿寒', 20: '札幌', 21: '札幌' },
    hints: {
      '新千歲機場 國際線航廈': 'New Chitose Airport International Terminal',
      '札幌王子飯店': 'Sapporo Prince Hotel',
      '北海道蟹將軍 札幌本店': 'Kani Shogun 札幌本店',
      '富田農場': 'Farm Tomita 富良野',
      'Campana Rokkatei': 'Campana 六花亭 富良野',
      '富良野農夫市集': 'Furano Marche',
      '富良野起司工房': 'Furano Cheese Factory',
      '新富良野王子大飯店': 'New Furano Prince Hotel',
      '森林精靈露台': '森林精霊テラス 富良野',
      'ジェットコースターの路': 'Jet Coaster Road 美馬牛',
      '四季彩之丘': 'Shikisai-no-Oka 美瑛',
      'Hoshi no Anne': 'Hoshi no Anne 美瑛 hotel',
      'マイルドセブンの丘': 'Mild Seven Hill 美瑛',
      'マイルドセブンの木': 'Mild Seven Tree 美瑛',
      '就實之丘 (就実の丘)': '就実の丘 美瑛',
      'Patchwork Biei': 'Patchwork Road Biei 美瑛',
      '旭川平和通買物公園': '旭川 平和通買物公園',
      '北海道立旭川美術館': '北海道立旭川美術館',
      'MI PLAZA': 'MI PLAZA 旭川',
      'OMO7 旭川 by 星野集團': 'OMO7 Asahikawa by Hoshino Resorts',
      '旭山動物園': 'Asahiyama Zoo 旭川',
      'もみ処 爽快家': 'もみ処 爽快家 旭川',
      '大雪山層雲峽 黑岳口纜車 層雲峽站': '大雪山層雲峡 黒岳ロープウェイ',
      '層雲峽': '層雲峡 上川',
      '大雪飯店': '大雪 ホテル 層雲峡',
      '狸小路6丁目': '狸小路6丁目 札幌',
      'Akan Yuku no Sato Tsuruga': '鶴雅 阿寒湖 yuku no sato',
      '三井OUTLET PARK 札幌北廣島': 'Mitsui Outlet Park Sapporo Kitahiroshima',
    },
    days: {
      1: [
        { time: '15:30', name: '新千歲機場 國際線航廈', stay: 90 },
        { time: '17:59', name: '札幌王子飯店', stay: 60 },
        { time: '19:16', name: '北海道蟹將軍 札幌本店', stay: 90 },
        { time: '21:03', name: '札幌王子飯店', stay: 60 },
      ],
      2: [{ time: '08:00', name: '札幌王子飯店', stay: 60 }],
      4: [
        { time: '08:00', name: '富田農場', stay: 60 },
        { time: '09:15', name: 'Campana Rokkatei', stay: 60 },
        { time: '10:25', name: '富良野農夫市集', stay: 60 },
        { time: '11:30', name: '富良野起司工房', stay: 60 },
        { time: '12:36', name: '新富良野王子大飯店', stay: 60 },
        { time: '13:41', name: '森林精靈露台', stay: 60 },
      ],
      6: [
        { time: '08:00', name: '新富良野王子大飯店', stay: 60 },
        { time: '09:35', name: 'ジェットコースターの路', stay: 60 },
        { time: '10:44', name: '四季彩之丘', stay: 60 },
        { time: '12:01', name: 'Hoshi no Anne', stay: 60 },
        { time: '13:04', name: 'マイルドセブンの丘', stay: 60 },
        { time: '14:08', name: 'マイルドセブンの木', stay: 60 },
      ],
      8: [
        { time: '08:00', name: 'Hoshi no Anne', stay: 60 },
        { time: '09:20', name: '就實之丘 (就実の丘)', stay: 60 },
        { time: '10:38', name: 'Patchwork Biei', stay: 60 },
        { time: '12:07', name: '旭川平和通買物公園', stay: 60 },
        { time: '13:11', name: '北海道立旭川美術館', stay: 60 },
        { time: '14:19', name: 'MI PLAZA', stay: 60 },
        { time: '15:25', name: 'OMO7 旭川 by 星野集團', stay: 60 },
      ],
      10: [
        { time: '08:00', name: 'OMO7 旭川 by 星野集團', stay: 60 },
        { time: '09:22', name: '旭山動物園', stay: 60 },
        { time: '10:47', name: 'もみ処 爽快家', stay: 60 },
        { time: '11:54', name: 'OMO7 旭川 by 星野集團', stay: 60 },
      ],
      12: [
        { time: '08:00', name: 'OMO7 旭川 by 星野集團', stay: 60 },
        { time: '10:19', name: '大雪山層雲峽 黑岳口纜車 層雲峽站', stay: 60 },
        { time: '11:37', name: '層雲峽', stay: 60 },
        { time: '12:56', name: '大雪飯店', stay: 60 },
      ],
      14: [
        { time: '08:00', name: '狸小路6丁目', stay: 60 },
        { time: '11:45', name: '大雪飯店', stay: 60 },
        { time: '15:27', name: 'Akan Yuku no Sato Tsuruga', stay: 60 },
      ],
      20: [{ time: '08:00', name: '三井OUTLET PARK 札幌北廣島', stay: 60 }],
      21: [{ time: '08:00', name: '新千歲機場 國際線航廈', stay: 60 }],
    },
  },

  {
    name: '台北輕旅行',
    startDate: '2025-09-14',
    totalDays: 6,
    regionCode: 'TW',
    bias: '台灣 台北',
    dayCity: { 1: '台北 士林', 2: '台北 陽明山 金山', 3: '金山 金瓜石 基隆', 4: '基隆 金瓜石', 5: '金瓜石', 6: '金瓜石 台北' },
    hints: {
      '財團法人天主教上智文教基金會': '上智文教基金會 台北',
      '士林官邸正館': '士林官邸 正館 台北',
      '有誠商旅': '有誠商旅 士林 台北',
      'ACME｜Cafe Bar & Restaurant 臺北表演藝術中心': 'ACME 臺北表演藝術中心 士林',
      '士林夜市': '士林夜市',
      '陽明書屋': '陽明書屋 陽明山',
      '青菜園': '青菜園 陽明山',
      '擎天崗環形步道': '擎天崗 陽明山',
      '金包里街14巷11號': '金包里街 14巷 金山',
      '金山大碗螃蟹': '金山大碗螃蟹',
      '金山冰芝林': '金山冰芝林',
      '跳石瞭望平台': '跳石海岸 金山',
      '朱銘美術館': 'Juming Museum 金山',
      '貪心咖啡': '貪心咖啡 金山',
      '野柳遊客中心': '野柳遊客中心 萬里',
      '長榮桂冠酒店（基隆）': 'Evergreen Laurel Hotel Keelung',
      '基隆廟口夜市': '基隆廟口夜市',
      '和平島地質公園 Heping Island GeoPark': 'Heping Island Park 和平島地質公園',
      '定置漁場三代目 The Fishery 正濱漁港': '定置漁場三代目 正濱漁港 基隆',
      '大坪海岸': '大坪海岸 萬里',
      '陰陽海景觀台': '陰陽海觀景台 水湳洞',
      '黃金瀑布': '黃金瀑布 水湳洞',
      '緩慢民宿 金瓜石 Adagio Jinquashi': 'Adagio Jinquashi 緩慢 金瓜石',
      '寬哥的關於咖啡': '寬哥的關於咖啡 金瓜石',
      '九份夜間導覽的開創者九份金礦博物館Jiufen cultural tour（參觀需預約喔，Reservation Only!）': '九份金礦博物館',
      '金瓜石(黃金博物館)': '黃金博物館 金瓜石',
      '祈堂老街': '祈堂老街 金瓜石',
      '無耳茶壺山登山口': '無耳茶壺山登山口 金瓜石',
      '散散步': '散散步 金瓜石 咖啡',
      '本山五坑': '本山五坑 金瓜石',
      '報時山棧道': '報時山棧道 金瓜石',
      '報時山觀景臺': '報時山觀景台 金瓜石',
    },
    days: {
      1: [
        { time: '09:00', name: '財團法人天主教上智文教基金會', stay: 120 },
        { time: '13:30', name: '士林官邸正館', stay: 90 },
        { time: '15:06', name: '有誠商旅', stay: 60 },
        { time: '18:30', name: 'ACME｜Cafe Bar & Restaurant 臺北表演藝術中心', stay: 120 },
        { time: '20:35', name: '士林夜市', stay: 60 },
        { time: '21:48', name: '有誠商旅', stay: 60 },
      ],
      2: [
        { time: '08:00', name: '有誠商旅', stay: 60 },
        { time: '09:26', name: '陽明書屋', stay: 150 },
        { time: '12:06', name: '青菜園', stay: 60 },
        { time: '13:26', name: '擎天崗環形步道', stay: 150 },
        { time: '16:34', name: '金包里街14巷11號', stay: 60 },
        { time: '17:38', name: '金山大碗螃蟹', stay: 60 },
        { time: '18:40', name: '金山冰芝林', stay: 60 },
        { time: '19:45', name: '金包里街14巷11號', stay: 60 },
      ],
      3: [
        { time: '08:00', name: '金包里街14巷11號', stay: 60 },
        { time: '09:17', name: '跳石瞭望平台', stay: 30 },
        { time: '09:57', name: '朱銘美術館', stay: 120 },
        { time: '12:08', name: '貪心咖啡', stay: 90 },
        { time: '13:54', name: '野柳遊客中心', stay: 60 },
        { time: '15:29', name: '長榮桂冠酒店（基隆）', stay: 60 },
        { time: '16:36', name: '基隆廟口夜市', stay: 60 },
      ],
      4: [
        { time: '08:00', name: '長榮桂冠酒店（基隆）', stay: 120 },
        { time: '10:13', name: '和平島地質公園 Heping Island GeoPark', stay: 90 },
        { time: '11:50', name: '定置漁場三代目 The Fishery 正濱漁港', stay: 60 },
        { time: '12:59', name: '大坪海岸', stay: 30 },
        { time: '13:45', name: '陰陽海景觀台', stay: 30 },
        { time: '14:18', name: '黃金瀑布', stay: 15 },
        { time: '14:37', name: '緩慢民宿 金瓜石 Adagio Jinquashi', stay: 143 },
        { time: '17:03', name: '寬哥的關於咖啡', stay: 60 },
        { time: '18:06', name: '緩慢民宿 金瓜石 Adagio Jinquashi', stay: 54 },
        { time: '19:30', name: '九份夜間導覽的開創者九份金礦博物館Jiufen cultural tour（參觀需預約喔，Reservation Only!）', stay: 170 },
        { time: '22:33', name: '緩慢民宿 金瓜石 Adagio Jinquashi', stay: 60 },
      ],
      5: [
        { time: '08:00', name: '緩慢民宿 金瓜石 Adagio Jinquashi', stay: 0 },
        { time: '08:06', name: '金瓜石(黃金博物館)', stay: 30 },
        { time: '08:43', name: '祈堂老街', stay: 60 },
        { time: '09:52', name: '無耳茶壺山登山口', stay: 180 },
        { time: '13:06', name: '散散步', stay: 90 },
        { time: '14:46', name: '本山五坑', stay: 60 },
        { time: '15:54', name: '緩慢民宿 金瓜石 Adagio Jinquashi', stay: 81 },
        { time: '17:23', name: '報時山棧道', stay: 0 },
        { time: '17:26', name: '報時山觀景臺', stay: 20 },
        { time: '17:51', name: '緩慢民宿 金瓜石 Adagio Jinquashi', stay: 60 },
      ],
      6: [
        { time: '08:00', name: '緩慢民宿 金瓜石 Adagio Jinquashi', stay: 60 },
        { time: '11:28', name: '財團法人天主教上智文教基金會', stay: 60 },
      ],
    },
  },
];

// ============ 共用 helpers ============

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

async function searchPlace(name, cityHint, hints, bias, regionCode) {
  const hinted = hints[name] ?? name;
  const fullQuery = `${hinted} ${cityHint ?? ''} ${bias}`.trim();
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.nationalPhoneNumber',
      Referer: 'https://walking2.pages.dev/',
    },
    body: JSON.stringify({
      textQuery: fullQuery,
      languageCode: 'zh-TW',
      regionCode,
      maxResultCount: 1,
    }),
  });
  if (!res.ok) throw new Error(`Places API ${res.status}: ${await res.text()}`);
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

async function processTrip(trip) {
  console.log(`\n=== ${trip.name} ===`);
  const queries = new Map();
  for (const [dayIdx, items] of Object.entries(trip.days)) {
    const city = trip.dayCity[Number(dayIdx)];
    for (const it of items) {
      if (!queries.has(it.name)) queries.set(it.name, city);
    }
  }
  console.log(`不重複地點：${queries.size} 個`);

  const placeMap = new Map();
  let i = 0;
  for (const [name, city] of queries) {
    i++;
    process.stdout.write(`  [${i}/${queries.size}] ${name} ... `);
    try {
      const r = await searchPlace(name, city, trip.hints, trip.bias, trip.regionCode);
      if (r) {
        placeMap.set(name, r);
        console.log(`✓ ${r.displayName}`);
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
  for (let dayIdx = 1; dayIdx <= trip.totalDays; dayIdx++) {
    const date = addDays(trip.startDate, dayIdx - 1);
    const rawItems = trip.days[dayIdx] ?? [];
    const items = rawItems.map((raw) => {
      const r = placeMap.get(raw.name);
      if (!r) {
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
      const place = {
        id: uuid(),
        placeId: r.placeId,
        name: r.displayName,
        address: r.address,
        coordinates: { lat: r.lat, lng: r.lng },
        types: r.types,
      };
      if (r.phoneNumber) place.phoneNumber = r.phoneNumber;
      return {
        id: uuid(),
        place,
        arrivalTime: raw.time,
        stayMinutes: raw.stay,
        isHotel: false,
        arrivalManual: true,
      };
    });
    const legs = [];
    for (let j = 0; j < items.length - 1; j++) legs.push({ mode: 'driving' });
    days.push({ id: uuid(), dayIndex: dayIdx, date, items, legs });
  }

  const tripJson = {
    id: uuid(),
    name: trip.name,
    startDate: trip.startDate,
    days,
    favorites: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const notFound = [...placeMap.entries()].filter(([, v]) => v === null).map(([k]) => k);
  if (notFound.length > 0) {
    console.log(`  ⚠ 查不到的地點 (${notFound.length})：`);
    notFound.forEach((n) => console.log(`    - ${n}`));
  } else {
    console.log(`  ✓ 全部 ${queries.size} 個地點都查到了`);
  }

  return tripJson;
}

async function uploadTrip(tripJson) {
  console.log(`  上傳到 KV ... id=${tripJson.id}`);
  const res = await fetch(`${ORIGIN}/api/trips/${tripJson.id}?u=${ACCOUNT_HASH}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tripJson),
  });
  if (!res.ok) {
    throw new Error(`upload failed: ${res.status} ${await res.text()}`);
  }
  console.log(`  ✓ 上傳完成 (${res.status})`);
}

// ============ 主流程 ============

for (const trip of TRIPS) {
  const tripJson = await processTrip(trip);
  await uploadTrip(tripJson);
}

console.log('\n✓ 全部完成');
