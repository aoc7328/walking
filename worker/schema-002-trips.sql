-- 行程索引。
--
-- 為什麼需要這張表：行程 JSON 本身放 KV，但 KV 的 list 是「最終一致」的——
-- 剛寫進去的 key 可能要幾十秒才出現在列表裡。用 KV list 數數量來擋配額，
-- 連續建立時每次都數到舊的數字，等於完全沒擋（實測連建 4 個全過）。
-- D1 是強一致的，所以數量與列舉都改用這張表，KV 只負責存內容。
--
-- 用法：wrangler d1 execute walking-multi --remote --file=worker/schema-002-trips.sql

CREATE TABLE IF NOT EXISTS trips (
  user_id    TEXT NOT NULL,
  trip_id    TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, trip_id),
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_trips_user ON trips (user_id, updated_at DESC);
