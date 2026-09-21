-- 多人版 walking 的 D1 結構。
-- 用法：wrangler d1 execute walking-multi --remote --file=worker/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id               TEXT PRIMARY KEY,           -- usr_<24 hex>，我們自己發的，不用 Google 的 sub 當 key
  google_sub       TEXT NOT NULL UNIQUE,       -- Google 帳號的穩定識別碼；認人一律看這個
  email            TEXT NOT NULL DEFAULT '',
  name             TEXT NOT NULL DEFAULT '',
  picture          TEXT NOT NULL DEFAULT '',
  created_at       INTEGER NOT NULL,
  extra_trip_slots INTEGER NOT NULL DEFAULT 0  -- 付費加購的行程額度（免費額度寫在 Worker 設定裡）
);

CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users (google_sub);

-- 第二期接金流時才會用到；先建好欄位，免得之後改結構動到既有資料。
CREATE TABLE IF NOT EXISTS orders (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  slots       INTEGER NOT NULL,        -- 這筆買了幾個行程額度
  amount_twd  INTEGER NOT NULL,
  status      TEXT NOT NULL,           -- pending / paid / refunded
  provider    TEXT NOT NULL DEFAULT '',-- ecpay / newebpay / manual
  provider_ref TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  paid_at     INTEGER,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (user_id);
