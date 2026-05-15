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
