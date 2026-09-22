# walking 多人版（Worker）

單人版（Cloudflare **Pages** 專案 `walking` / walking2.pages.dev）**完全不動**。
這是另一個獨立的 Worker：不同網址、不同 KV / R2 / D1，資料不共用。

前端 `src/` 兩邊共用，靠 `GET /api/auth/mode` 分辨後端是哪一種：
Pages 沒有這支，_redirects 會導到 index.html（200 + HTML），前端解析 JSON 失敗就顯示密碼欄；
這個 Worker 回 `{"mode":"google"}` → 顯示 Google 登入。

## 跟單人版的差別

| | 單人版（Pages） | 多人版（這裡） |
|---|---|---|
| 登入 | 一組共用密碼 | Google OAuth |
| 使用者 | 沒有這個概念 | D1 `users` 表 |
| 行程 key | `u:<共用雜湊>:trip:<id>` | `u:<userId>:trip:<id>` |
| 圖片 key | `u/<共用雜湊>/…` | `u/<userId>/…` |
| 配額 | 無 | 同時 3 個行程（可加購） |

## 你要先做的事（我做不了，需要你的帳號）

**1. Google Cloud Console → 建 OAuth 用戶端**

- API 和服務 → 憑證 → 建立憑證 → OAuth 用戶端 ID → 網頁應用程式
- 已授權的重新導向 URI 填：`https://<你的worker網址>/api/auth/callback`
- OAuth 同意畫面：外部、範圍只勾 `openid` `email` `profile`
  （這三個是非敏感範圍，**不需要** Google 審查，但**必須填隱私權政策網址**）
- 記下 Client ID 與 Client Secret

**2. 建 Cloudflare 資源**（都是新的，不會碰到現有的）

```bash
npx wrangler kv namespace create WALKING_MULTI_TRIPS
npx wrangler r2 bucket create walking-multi-media
npx wrangler d1 create walking-multi
```

把回傳的 KV id 與 D1 database_id 填進 `worker/wrangler.jsonc` 的 `TODO_` 位置。

**3. 建資料表**

```bash
npx wrangler d1 execute walking-multi --remote --file=worker/schema.sql
```

**4. 放 secret**

```bash
npx wrangler secret put GOOGLE_CLIENT_ID -c worker/wrangler.jsonc
npx wrangler secret put GOOGLE_CLIENT_SECRET -c worker/wrangler.jsonc
```

## 部署

```bash
npm run build
npx wrangler deploy -c worker/wrangler.jsonc
```

設定檔刻意放在 `worker/` 而不是專案根目錄——根目錄有 wrangler 設定會被
`wrangler pages deploy` 一起讀到，可能影響現有 Pages 專案的部署。

## 還沒做

- **金流**：`orders` 表已經建好欄位，但沒有任何付款流程（第一期不做）
- **資料搬遷**：你現有 22 個行程還在單人版的共用命名空間，沒有搬過來
- **成本控制**：照片網址目前仍帶 API key 存在行程 JSON 裡，多人版應該改成
  由 Worker 代理、存進 R2（見下方「成本」）
- 隱私權政策、服務條款頁面

## 成本（Google Maps Platform，2026-09-14 官方價目）

| 呼叫 | 每月免費 | 超過後每 1,000 次 | 一次約 |
|---|---|---|---|
| Text Search **Pro** | 5,000 | $32.00 | $0.032 |
| Text Search Essentials（只回 ID） | 無限 | 免費 | $0 |
| Place Details **Enterprise** | 1,000 | $20.00 | $0.020 |
| Place Details Enterprise + Atmosphere | 1,000 | $25.00 | $0.025 |
| Place Details Essentials | 10,000 | $5.00 | $0.005 |
| Places Photo | 1,000 | $7.00 | $0.007 |
| Directions（Essentials） | 10,000 | $5.00 | $0.005 |
| Dynamic Maps | 10,000 | $7.00 | $0.007 |

**成本跟著「站數」走，不是「行程數」。** 每加一個新地點大約
搜尋 $0.032 + 詳細資料 $0.02～0.025 + 一段車程 $0.005 ≈ **$0.06（約 NT$2）**，
而且照片是每次瀏覽都計費（6 張 = $0.042），不是一次性的。

三個把成本砍下來的做法，優先序由高到低：

1. **照片改由 Worker 代理並存進 R2**。現在 `photoUrls` 把 API key 直接寫進行程
   JSON，等於每個使用者都拿得到你的 key，而且每看一次就計一次費。抓一次存 R2
   之後，重複觀看幾乎零成本，key 也不外流。
2. **搜尋改用 Text Search Essentials（只回 ID）＋ 選定後才抓 Details**。
   Essentials 版的搜尋無限免費，可以省掉最貴的那筆 $32/1,000。
3. **評分／評論數／價位是 Enterprise 欄位**，會把 Details 從 $5（免費 10,000）
   推到 $20～25（免費只剩 1,000）。考慮預設只抓 Essentials，使用者真的想看評分
   再單獨抓。

## 發票自動判讀（已實作，未部署）

`POST /api/receipt-scan`，body：`{ keys: string[], amount: number, currency: string }`

`keys` 是已上傳 R2 的發票照片（前綴必須是自己的 userId，否則 400）。長收據分好幾張拍
可以一次全帶進去，會當成同一張由上到下接續。回傳一項項 `{label, price, qty}`，
**不直接寫進行程**——要讓使用者看過改過再套用。

### 對帳是這支 API 最有價值的部分

request 會帶上這筆支出實際刷掉的金額，回傳裡有 `reconciled`：

- `明細加總 === 刷卡金額` → 判讀幾乎確定正確，可以直接套用
- 對不上 → 回傳 `diff`，前端用既有的橘色差額提示要使用者看一眼

也就是說 AI 有沒有讀錯，系統自己驗得出來，不必靠使用者逐行核對。
prompt 裡明講「對不上就照實抄，不要為了湊數字改」，就是為了不讓它把錯誤藏起來。

### 成本（Anthropic 官方價，每 1M token）

一張收據約 2,000 input token（圖）+ 800 output token（13 行明細）：

| 模型 | Input | Output | 一張收據約 |
|---|---|---|---|
| Claude Opus 5（預設） | $5.00 | $25.00 | $0.030（NT$0.96） |
| Claude Sonnet 5 | $2.00 | $10.00 | $0.012（NT$0.38） |
| Claude Haiku 4.5 | $1.00 | $5.00 | $0.006（NT$0.19） |

對照 Google Maps 每加一個地點約 NT$2 —— **判讀一張發票比查一個地點還便宜。**
換模型只要改 `OCR_MODEL` 這個 var，不必動程式。

需要 secret：

```bash
npx wrangler secret put ANTHROPIC_API_KEY -c worker/wrangler.jsonc
```

### 還沒做

- 前端還沒接：上傳發票後要自動呼叫這支、把結果填進明細表讓人校正
- 判讀失敗時的重試策略（例如對不上就換更強的模型再讀一次）
