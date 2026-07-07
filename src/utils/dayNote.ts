import type { DayPlan, DayNote } from '../types/trip';

/**
 * 取這天的備註（單一），給編輯 / 顯示用：
 * - 有新版 note（即使文字暫時空著、正在編輯）→ 直接回傳
 * - 否則把舊版 cards[] 併成一則（無損遷移：文字逐張換行接起、取第一個圖示）
 * - 都沒有 → undefined
 */
export function dayNoteOf(day: DayPlan | null | undefined): DayNote | undefined {
  if (!day) return undefined;
  if (day.note !== undefined) return day.note;
  const cards = day.cards ?? [];
  if (cards.length === 0) return undefined;
  const text = cards.map((c) => c.text).filter((t) => t.trim() !== '').join('\n');
  const iconEmoji = cards.find((c) => c.iconEmoji)?.iconEmoji;
  if (text === '' && !iconEmoji) return undefined;
  return { iconEmoji, text };
}

/** 這天「值得印出來」的備註（要有文字或圖示才算）；給 PDF / 手冊用。 */
export function printableDayNote(day: DayPlan): DayNote | undefined {
  const n = dayNoteOf(day);
  return n && (n.text.trim() !== '' || !!n.iconEmoji) ? n : undefined;
}
