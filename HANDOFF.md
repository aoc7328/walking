# 走走（walking）　·　給 Claude Code 的接手指令

## 你接到的是什麼

一份名為 `index.html` 的 self-contained HTML prototype，這是 Vincent 與 Claude Chat 共同定稿的視覺與互動原型。所有版面、配色、字型、卡片設計、互動行為、模態框結構**都已經是最終定版**。

你的任務不是「重新設計」，而是把這份 prototype 轉成一個可長期維護的 Vite + React + TypeScript 專案，並把所有邏輯與資料層接起來。

---

## 工作守則（嚴格遵守）

1. **一次做完所有 9 個階段，中途不停下驗收**。不要做完一個階段就停下問 Vincent。從階段 1 直接做到階段 9，全部完成才一次回報。
2. **任務完成後不自行測試**。完成所有階段後，執行 `npm run typecheck` 與 `npm run build`，兩者過關即停下。視覺與功能驗收由 Vincent 親自進行，**禁止自己跑 `npm run dev`、開瀏覽器測試或截圖**。
3. **不要做這份文件未列出的功能**。功能一律以本文件為準，自作主張多做的會被打回去。
4. **絕對不要改動視覺設計**。`index.html` prototype 的所有 CSS 變數、字型選擇、配色、間距、圓角、陰影必須完整保留。轉成 Tailwind 時把這些值寫進 `tailwind.config.ts` 的 `theme.extend`，**不要用 Tailwind 預設色替換 prototype 的色票**。
5. **只在遇到本文件未涵蓋的核心設計取捨時才停下問**。一般技術選擇直接按本文件走。但若資料模型、API 行為、互動細節等本文件未明確規範，先停下問，不要擅自決定。
6. **commit 顆粒度小**。每完成一個明確功能就 commit，訊息中英文皆可。
7. **不要 console.log 殘留**。typecheck 前清乾淨。
8. **介面文字與程式註解使用繁體中文，全形標點**。

---

## 1. 專案資訊

- **名稱**：走走（walking）
- **路徑**：`F:\walking\`
- **類型**：純前端 PWA
- **使用者**：Vincent 個人單機使用
- **目標**：規劃個人國內外旅行行程

## 2. 技術 Stack

```
React 18 + TypeScript
Vite                       — 建構工具
Tailwind CSS               — 樣式（保留 prototype 的 CSS 變數系統）
Zustand                    — 狀態管理
Dexie                      — IndexedDB wrapper
@dnd-kit/core + sortable   — 拖拉
@vis.gl/react-google-maps  — Google Maps
@react-pdf/renderer        — PDF 匯出
@tanstack/react-virtual    — 虛擬滾動
vite-plugin-pwa            — PWA manifest + Service Worker
```

**禁止引入**：Redux、Material UI、Ant Design、shadcn/ui、Framer Motion、任何 UI 元件庫。所有元件用 Tailwind 自己刻。

## 3. 目錄結構

```
F:\walking\
├── public/
│   ├── icon-192.png            （之後 Vincent 提供）
│   ├── icon-512.png
│   └── favicon.ico
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   ├── LeftPanel.tsx
│   │   │   ├── MapPanel.tsx
│   │   │   ├── RightPanel.tsx
│   │   │   └── DayStrip.tsx
│   │   ├── search/
│   │   │   ├── SearchResultCard.tsx
│   │   │   └── FavoriteList.tsx
│   │   ├── day/
│   │   │   ├── DayTab.tsx
│   │   │   └── ChangeStartDateModal.tsx
│   │   ├── itinerary/
│   │   │   ├── ItineraryCard.tsx
│   │   │   ├── LegConnector.tsx
│   │   │   └── NoteEditor.tsx
│   │   ├── map/
│   │   │   ├── MapView.tsx
│   │   │   ├── ItineraryMarker.tsx
│   │   │   ├── SearchMarker.tsx
│   │   │   └── RouteLine.tsx
│   │   ├── detail/
│   │   │   └── PlaceDetailModal.tsx
│   │   ├── pdf/
│   │   │   └── TripPDF.tsx
│   │   └── common/
│   │       ├── CollapseToggle.tsx
│   │       ├── ExpandButton.tsx
│   │       └── icons/
│   ├── stores/
│   │   ├── tripStore.ts
│   │   ├── uiStore.ts
│   │   └── searchStore.ts
│   ├── db/
│   │   ├── schema.ts
│   │   ├── repository.ts
│   │   └── backup.ts
│   ├── services/
│   │   ├── googleMaps.ts
│   │   ├── routing.ts
│   │   └── exportImport.ts
│   ├── types/
│   │   ├── trip.ts
│   │   ├── place.ts
│   │   └── ui.ts
│   ├── hooks/
│   │   ├── useTrip.ts
│   │   ├── useDay.ts
│   │   ├── useSearch.ts
│   │   └── useGoogleMaps.ts
│   ├── utils/
│   │   ├── date.ts
│   │   ├── geo.ts
│   │   └── format.ts
│   └── styles/
│       ├── index.css
│       └── tokens.css           — 從 prototype 抽出的 CSS 變數
├── .env.local                   — VITE_GOOGLE_MAPS_API_KEY（gitignore）
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
└── README.md
```

## 4. 資料模型

```typescript
// types/place.ts
export interface Place {
  id: string;                    // 內部 UUID
  placeId: string;               // Google Place ID
  name: string;
  address: string;
  coordinates: { lat: number; lng: number };
  rating?: number;
  reviewCount?: number;
  photoUrls?: string[];          // Google Photos URLs
  types: string[];
  phoneNumber?: string;
  website?: string;
  openingHours?: string[];
}

export type TransportMode = 'driving' | 'walking' | 'transit' | 'bicycling';

// types/trip.ts
export interface ItineraryItem {
  id: string;
  place: Place;
  arrivalTime: string;           // 'HH:mm'
  stayMinutes: number;
  notes?: string[];              // 多行備註
  isHotel: boolean;
}

export interface Leg {
  mode: TransportMode;
  durationMinutes?: number;
  distanceMeters?: number;
}

export interface DayPlan {
  id: string;
  dayIndex: number;              // 1-based
  date: string;                  // 'YYYY-MM-DD'
  city?: string;
  items: ItineraryItem[];
  legs: Leg[];                   // length = items.length - 1
}

export interface Trip {
  id: string;
  name: string;
  startDate: string;             // 'YYYY-MM-DD'
  days: DayPlan[];
  favorites: Place[];            // 收藏的地點
  createdAt: number;
  updatedAt: number;
}

// types/ui.ts
export interface CollapseState {
  searchBar: boolean;
  leftPanel: boolean;
  rightPanel: boolean;
  dayStrip: boolean;
}

export interface UIState {
  currentDayId: string | null;
  collapse: CollapseState;
  selectedItemId: string | null;
  detailModalPlaceId: string | null;
}
```

## 5. 核心功能規格

### 5.1 四區塊收合行為

- 4 個區塊獨立可收合：搜尋列、左欄、右欄、日程表
- 收合狀態存 `localStorage`（key: `walking.collapse`）
- 預設：搜尋列展開、左欄收合（沒有搜尋結果時自動隱藏）、右欄展開、日程表展開
- 4 個都收合 = 全螢幕地圖
- 收合動畫：250ms ease-out
- 收合後在原邊緣顯示展開按鈕（▾ / ▸ / ◂ / ▴）

### 5.2 搜尋

- 使用 Google Places API `Text Search`
- 自動帶入目前查看那天的城市做 location bias
- 結果按 API 預設相關性排序
- 沒搜尋時，左欄完全消失（中央地圖往左擴展）
- 搜尋有結果時，左欄出現
- 搜尋框支援貼上 Google Maps 連結，自動解析

### 5.3 加入行程

- 點搜尋結果卡片右下的 `+` 按鈕
- **直接加到目前正在看的那一天**（B 方案）
- 自動插入到最順路位置（見 5.4）
- **不要顯示任何 toast 或視覺回饋**——使用者直接看到右欄更新即可

### 5.4 智慧插入算法（services/routing.ts）

```typescript
/**
 * 找出新點插入到當天 items 中的最佳位置
 * @returns items 中的 insert index (0 到 items.length 之間)
 * 限制：飯店（isHotel === true）視為起終點，新點不能插在第 0 個或最後一個之外
 */
function findBestInsertPosition(
  newPoint: Place,
  currentDay: DayPlan,
  legMode: TransportMode = 'driving'
): number {
  // 1. 用 Haversine 算所有可能插入位置的「總距離增量」
  // 2. 取增量最小的位置
  // 3. 回傳 insert index
  //
  // 進階（之後加）：背景打 Distance Matrix API 驗算，若更準確的結果不同則靜默更新
  //
  // 限制條件：
  // - 不能插在 index 0（飯店起點）之前
  // - 不能插在 last index（飯店終點）之後
  // - 如果當天沒有任何點，就放 index 0
  // - 如果當天只有飯店（起終點），就放在飯店之間
}
```

### 5.5 跨天順序變動

- 拖動底部日標籤到別的位置：整天 array splice 過去
- **不自動重算當天內部路線**（靜默）
- 飯店不變，即使前一天的飯店變了也不重算
- 視覺上：如果飯店不一致，路線會直接畫一條長直線（by design，使用者看到自己會調）

### 5.6 「更換起始日」對話框

- 對話框內容已經在 prototype 中：起始日（可改）、結束日（唯讀）、天數（唯讀）
- 確定後：更新 `trip.startDate`，所有 `day.date` 連動更新（依 dayIndex 推算）
- 天數固定，不可改

### 5.7 PlaceDetailModal

- 點搜尋結果卡片或右欄行程卡片時跳出
- 內容：縮圖 hero、名稱、評分、地址、電話、營業時間、評論 3-5 則、照片 4-6 張
- 左上按鈕：
  - 搜尋結果開啟時：「+ 加入 Day N」（背景橘色，加入後關閉 modal）
  - 右欄行程開啟時：「✓ 已在 Day N」（灰底）+「✕ 從行程移除」（紅色）
- 右上：「✕ 關閉」
- 資料來源：Google Places `Place Details` API + `Place Photos` API

### 5.8 收藏功能

- 結果卡片有 ♡ 按鈕，點下加入 `trip.favorites`
- 已收藏的卡片顯示 ♥（實心、橘色背景）
- 收藏的地點不加進行程
- 搜尋時，收藏的地點優先排在最前面
- 未來可加「我的收藏清單」分頁（v2）

### 5.9 右欄行程卡片

- 顯示：時間、名稱、停留時長
- 備註區（有才顯示）：用條列式，每行一個備註
- 點卡片整體 → 開啟 PlaceDetailModal
- 拖拉重排（dnd-kit）
- **沒有「+ 新增點」按鈕**——加點一定要透過搜尋

### 5.10 卡片間交通連接（LegConnector）

- 顯示「車　·　15 分」這種格式
- 交通方式 icon 用文字標籤：車 / 走 / 大眾 / 腳踏車
- 點交通方式可切換（之後做）
- 時間從 Google Directions API 取得，每段獨立

### 5.11 底部日程表

- 前後加號（虛線邊框）→ 點下對應插入一天
- 日卡片可拖拉換天（dnd-kit + sortable）
- 點某天 → 右欄與中央地圖切換到那天
- 拖天時，**整天資料一起搬**

### 5.12 資料儲存

- Dexie schema 一張 `trips` 表，主鍵 `id`
- 每次變更後 debounced 1 秒寫入
- 自動備份：每天保留一個 snapshot，最多 7 個（另存一張 `backups` 表）
- 匯出 JSON：序列化整個 Trip 物件為下載檔
- 匯入 JSON：讀檔 → 驗證 → 覆蓋目前 trip（先彈確認）

### 5.13 PWA

- vite-plugin-pwa 配置
- manifest：name `走走`、short_name `走走`、theme_color `#2C4A3D`、background `#FAF7F0`
- Service Worker：靜態檔離線快取，API 請求 network-first
- 加到桌面：iOS / Android 標準支援
- 圖示 192/512：Vincent 之後提供，先放 placeholder

### 5.14 分享匯出（v1）

兩個按鈕，都是純前端：

1. **匯出 PDF**：`@react-pdf/renderer`，一天一頁的旅遊小書版型
2. **匯出 HTML**：產生 self-contained HTML 檔（含內嵌 Google Static Maps 縮圖），對方瀏覽器開即可看完整行程（唯讀）

**v2 雲端分享連結**：之後另外建工作項目，現在不做。

## 6. Google Maps API 設定

### 申請步驟（Vincent 自己處理）

1. 開 Google Cloud Console
2. 建新專案：`walking`
3. 啟用 API：Maps JavaScript / Places / Directions / Distance Matrix / Geocoding
4. 建立 API Key
5. 設限制：
   - HTTP referrer：`http://localhost:*` + 之後的 Cloudflare Pages 網域
   - API 限制：勾選上述 5 個 API

### 環境變數

`.env.example`：
```
VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
```

`.env.local`（gitignore）：Vincent 填入實際 key

### 用量預估

- Maps loads：~50/day × 30 = 1500/月 → $10.5
- Place Details：~20/day × 30 = 600/月 → $10.2
- Directions：~10/day × 30 = 300/月 → $1.5
- 總計約 $22/月，**完全在 $200 免費額度內**

## 7. 部署到 Cloudflare Pages

```bash
# 1. 本地 build
npm run build

# 2. 連 GitHub repo 到 Cloudflare Pages
# 3. Build command: npm run build
# 4. Build output: dist
# 5. 環境變數：VITE_GOOGLE_MAPS_API_KEY
```

## 8. 開發階段拆解

請依以下順序進行，每階段 commit 一次：

### 階段 1：專案初始化
- `npm create vite@latest walking -- --template react-ts`
- 安裝依賴（package.json）
- 配置 Tailwind（保留 prototype 的 CSS 變數寫進 theme.extend）
- 配置 PWA
- 確認 typecheck 過

### 階段 2：版面元件骨架
- 從 prototype 拆出 AppShell / Header / SearchBar / LeftPanel / MapPanel / RightPanel / DayStrip
- 用 mock data 渲染（複用 prototype 的 mock data）
- 視覺要跟 prototype **100% 一致**
- 確認 typecheck 過

### 階段 3：資料層
- Dexie schema + repository
- Zustand stores（tripStore / uiStore / searchStore）
- 收合狀態 localStorage 持久化
- 確認 typecheck 過

### 階段 4：搜尋與地點詳細
- Google Places API 整合
- 搜尋列 → 左欄結果渲染
- PlaceDetailModal 真實資料
- 確認 typecheck 過

### 階段 5：地圖
- @vis.gl/react-google-maps 整合
- 三種顏色 marker
- 路線 polyline
- 確認 typecheck 過

### 階段 6：行程操作
- 加入點到當天（智慧插入）
- 拖拉重排（dnd-kit）
- 卡片編輯（時間、停留、備註）
- 收合動畫
- 確認 typecheck 過

### 階段 7：日程表互動
- 拖天換順序
- 前後加減天
- 更換起始日對話框
- 確認 typecheck 過

### 階段 8：匯出
- PDF 匯出（@react-pdf/renderer）
- HTML 匯出
- JSON 匯入/匯出
- 確認 typecheck 過

### 階段 9：PWA + 部署
- PWA manifest + Service Worker 驗證
- Cloudflare Pages 部署設定
- 確認 typecheck 過

**每個階段完成後**：
1. `git add -A && git commit -m "feat(stage-N): <簡述>"`
2. **直接進入下一階段，不要停下等驗收**

**全部 9 個階段完成後（一次回報）**：
1. 執行 `npm run typecheck`，確認過關
2. 執行 `npm run build`，確認 build 成功（如果 build 過程不需要 Google Maps API Key，就直接跑；如果需要，回報 Vincent 哪個檔案需要 key）
3. 列出所有 Vincent 需要做的後續步驟（填 .env.local、提供 PWA icons、Cloudflare Pages 連結 repo 等）
4. 回報完成，停下等驗收

**遇到問題就停下回報**：
- 本文件未涵蓋的設計取捨
- npm install 卡住、依賴衝突
- TypeScript 嚴重型別問題（不要為了過關亂用 any）
- 任何讓你覺得「我可能要自作主張」的時刻

---

## 9. 從 prototype 抽 CSS 變數的對照表

把 prototype `<style>` 內 `:root` 的所有 CSS 變數抽出來，放進 `src/styles/tokens.css`，並對應到 `tailwind.config.ts` 的 `theme.extend.colors` 等設定。**禁止用 Tailwind 預設色取代 prototype 的色票**。

關鍵 token：

```
顏色:
--bg-page          #FAF7F0   米黃主背景
--bg-card          #FFFFFF   卡片白
--bg-soft          #F2EDE0   二級背景
--ink-primary      #2C2620   主文字
--ink-secondary    #6B5F50
--ink-muted        #A89C8B
--ink-faint        #C9B894
--accent-primary   #2C4A3D   深湖綠（路線、主強調）
--accent-warm      #D85A30   琥珀橙（CTA、活動點）
--accent-purple    #5B4B7F   飯店 marker

字型:
--font-display     Fraunces, Noto Serif TC, Georgia, serif
--font-body        Noto Serif TC, Fraunces, Georgia, serif

字型 import:
https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600&family=Noto+Serif+TC:wght@300;400;500;600&display=swap

圓角:
--radius-sm 4px / --radius-md 6px / --radius-lg 10px / --radius-xl 14px

過渡:
--t-fast 150ms / --t-med 250ms / --t-slow 400ms cubic-bezier(0.4, 0, 0.2, 1)
```

---

## 10. 開工流程

Claude Code 接到這份指令後，**直接動工**，按以下流程進行：

### 起手式（不需要問 Vincent）

1. 確認當前目錄是 `F:\walking\`，裡面有 `index.html`（視覺基準）跟 `HANDOFF.md`（本檔）
2. `git init`（如果還沒）並把 `index.html` 與 `HANDOFF.md` 先 commit 一次為 baseline
3. 直接執行 `npm create vite@latest . -- --template react-ts`（在當前目錄初始化，會跟現有檔案合併）
4. 開始階段 1 → 9

### Google Maps API Key 處理方式

- **不要等 Vincent 給 API Key 才動工**。
- 直接建立 `.env.example`，內容：`VITE_GOOGLE_MAPS_API_KEY=your_api_key_here`
- 程式碼讀取 `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`
- 如果 Vincent 還沒填 `.env.local`，地圖元件顯示 placeholder「請在 .env.local 設定 Google Maps API Key」
- Vincent 自己會填 key

### PWA Icons 處理方式

- **不要自己生成 icons**。
- 在 `public/icon-192.png` 與 `public/icon-512.png` 留註解或佔位檔
- 在最終回報中列為「需要 Vincent 提供」

### 中途遇到 npm 套件衝突或無法解決的技術問題

- 停下回報。不要為了繼續而換套件、降版本或亂用 `--force`。
- 詳細描述卡在哪裡，列出可選方案讓 Vincent 決定。

### 全部完成後的回報格式

請在最後一次回應中包含以下資訊（用 Markdown 條列）：

1. **完成的階段**：列出 1-9 階段哪些已完成
2. **typecheck 結果**：通過/失敗，若有 warning 列出
3. **build 結果**：通過/失敗，產物大小
4. **commit 數量**：總共幾個 commits
5. **Vincent 需要做的事**：
   - 填 `.env.local`（給 Google Maps API Key）
   - 提供 `public/icon-192.png` 與 `public/icon-512.png`
   - 任何其他你發現需要 Vincent 處理的事
6. **已知限制或未做的部分**：例如 Cloudflare Pages 部署需要先 push 到 GitHub repo 才能連結，這部分由 Vincent 完成
7. **下一步建議**：建議 Vincent 在驗收時優先檢查的部分

完成後 Vincent 會親自 `npm run dev` 開瀏覽器驗收。視覺有問題會丟回 Claude Chat，Claude Code 不需要處理視覺微調。
