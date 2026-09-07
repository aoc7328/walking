import type { Expense } from '../types/ledger';

/**
 * 手機記帳「還沒送到雲端」的待送佇列，存在 localStorage。
 *
 * 從 MobileLedger 抽出來共用：預算頁也必須把這幾筆算進去，
 * 否則剛記完帳、還沒同步成功時，總花費會少算，看起來像記帳沒生效。
 */

function pendingKey(tripId: string): string {
  return `walking.mobilePending.${tripId}`;
}

export function readPending(tripId: string): Expense[] {
  try {
    const raw = localStorage.getItem(pendingKey(tripId));
    const arr = raw ? (JSON.parse(raw) as Expense[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function writePending(tripId: string, list: Expense[]): void {
  try {
    localStorage.setItem(pendingKey(tripId), JSON.stringify(list));
  } catch {
    // 空間不足 / 無痕模式：這次還是能記，只是重開會不見
  }
}
