/**
 * 多人版 Worker 的環境型別。
 *
 * 刻意跟 functions/ 一樣手寫最小介面，不裝 @cloudflare/workers-types——
 * 這個專案只用到 KV / R2 / D1 的少數幾個方法，手寫的比較好讀也不會拖 typecheck。
 */

export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts: { prefix: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

export interface R2ObjectBody {
  body: ReadableStream;
  size: number;
  httpMetadata?: { contentType?: string };
}

export interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(key: string, value: ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  delete(key: string): Promise<void>;
}

export interface D1Result<T> {
  results: T[];
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  /** 靜態檔（build 出來的 dist），由 wrangler.jsonc 的 assets 綁定。 */
  ASSETS: Fetcher;
  /** 行程 JSON 與 session。 */
  TRIPS: KVNamespace;
  /** 照片、發票、票券。 */
  MEDIA: R2Bucket;
  /** 使用者與配額。 */
  DB: D1Database;

  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;

  /** 免費方案的行程數上限；沒設就用 3。 */
  FREE_TRIP_LIMIT?: string;

  /** 發票自動判讀用。沒設這個 key，掃描功能會回 503，其餘功能不受影響。 */
  ANTHROPIC_API_KEY?: string;
  /** 判讀用的模型；沒設就用 claude-opus-5。便宜的選項見 worker/README.md。 */
  OCR_MODEL?: string;
}
