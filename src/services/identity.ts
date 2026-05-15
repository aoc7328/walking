/**
 * 取 KV namespace 用的 userId。
 * v2: 從帳號雜湊 (services/auth) 取得。未登入 → 拋例外。
 */

import { getAccountHash } from './auth';

export function getUserId(): string {
  const hash = getAccountHash();
  if (!hash) throw new Error('尚未登入');
  return hash;
}

/** 沒登入時呼叫 API 的安全變體 */
export function getUserIdOrNull(): string | null {
  return getAccountHash();
}
