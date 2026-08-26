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
5. 環境變數：`VITE_GOOGLE_MAPS_API_KEY`（前端 key，必須在 Google Cloud 限制網站來源與允許 API）
6. 綁定（Settings → Bindings，Production 與 Preview 都要）：

| 變數名稱 | 型別 | 資源 | 用途 |
|---|---|---|---|
| `TRIPS` | KV namespace | （既有） | 行程 JSON、分享連結 |
| `MEDIA` | R2 bucket | `walking-media` | 票券 / 入境 QR 圖片 |

### 正式環境的私有 API secret（必填）

在 Cloudflare Pages → Settings → Variables and Secrets，於 Production 與 Preview 都新增 **secret**：

| 名稱 | 值 |
|---|---|
| `AUTH_PASSWORD_HASH` | 新密碼的 PBKDF2-SHA256 雜湊（100,000 次、salt 為 `walking:gate`） |
| `DATA_NAMESPACE_ID` | 舊版資料所在的 KV 命名空間識別碼（從部署前的 `src/services/identity.ts` 取得） |

這兩個值絕不能使用 `VITE_` 前綴，也不能放進 `.env.local` 或 Git。沒有設定時，私有行程與圖片 API 會刻意拒絕服務，而不會退回舊的公開授權方式。

沒綁 `MEDIA` 的話，上傳圖片會回 500「R2 未設定」，其餘功能不受影響。

### 本地測 Functions（含 KV / R2）

`npm run dev` 只跑前端，`/api/*` 不存在。要連後端一起測：

```bash
npm run build
npx wrangler pages dev dist --kv TRIPS --r2 MEDIA
```

KV 與 R2 都是本地模擬，不會碰到線上資料。

## 密碼

密碼由後端驗證，登入成功後以 HttpOnly session cookie 保存；瀏覽器不再保存密碼雜湊或資料識別碼。要換密碼，請用新密碼產生雜湊後更新 Cloudflare Pages 的 `AUTH_PASSWORD_HASH` secret：

```bash
node -e "const c=require('crypto');console.log(c.pbkdf2Sync('新密碼','walking:gate',100000,32,'sha256').toString('hex'))"
```
