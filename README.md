# 走走（walking）

個人用 PWA 旅行行程規劃工具。

## 技術 Stack

React 18 + TypeScript + Vite + Tailwind CSS + Zustand + Dexie + @dnd-kit + @vis.gl/react-google-maps + @react-pdf/renderer

## 啟動

```bash
npm install
cp .env.example .env.local   # 填入 Google Maps API Key
npm run dev
```

## 指令

- `npm run dev` — 開發伺服器
- `npm run typecheck` — TypeScript 型別檢查
- `npm run build` — 正式 build（含 typecheck）
- `npm run preview` — 預覽 build 結果

## 環境變數

`.env.local`：

```
VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
```

## 部署到 Cloudflare Pages

1. push 到 GitHub repo
2. Cloudflare Pages 連 repo
3. Build command: `npm run build`
4. Build output: `dist`
5. 環境變數：`VITE_GOOGLE_MAPS_API_KEY`
6. 綁定（Settings → Bindings，Production 與 Preview 都要）：

| 變數名稱 | 型別 | 資源 | 用途 |
|---|---|---|---|
| `TRIPS` | KV namespace | （既有） | 行程 JSON、分享連結 |
| `MEDIA` | R2 bucket | `walking-media` | 票券 / 入境 QR 圖片 |

沒綁 `MEDIA` 的話，上傳圖片會回 500「R2 未設定」，其餘功能不受影響。

### 本地測 Functions（含 KV / R2）

`npm run dev` 只跑前端，`/api/*` 不存在。要連後端一起測：

```bash
npm run build
npx wrangler pages dev dist --kv TRIPS --r2 MEDIA
```

KV 與 R2 都是本地模擬，不會碰到線上資料。

## 密碼

單人使用，只有密碼、沒有帳號。密碼本身不在程式裡，存的是 PBKDF2 雜湊
（`src/services/auth.ts` 的 `PASSWORD_HASH`）。解鎖過的裝置會記在 localStorage，
下次開不用再打；驗證純在本機算，不打後端，所以離線也解得開。

資料的 KV key 是 `src/services/identity.ts` 裡那組固定值，**跟密碼無關**。
要換密碼就重算雜湊換掉 `PASSWORD_HASH`，行程資料一筆都不會動到：

```bash
node -e "const c=require('crypto');console.log(c.pbkdf2Sync('新密碼','walking:gate',100000,32,'sha256').toString('hex'))"
```
