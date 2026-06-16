const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  const date = parseDate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function formatMonthDay(iso: string): string {
  const date = parseDate(iso);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}/${d}`;
}

/** 只回週幾單字（日/一/…/六）。 */
export function weekdayLabel(iso: string): string {
  return WEEKDAYS[parseDate(iso).getDay()] ?? '';
}

export function formatWithWeekday(iso: string): string {
  const date = parseDate(iso);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}/${d}（${WEEKDAYS[date.getDay()]}）`;
}

export function formatFullWithWeekday(iso: string): string {
  const date = parseDate(iso);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}（${WEEKDAYS[date.getDay()]}）`;
}

export function formatRange(startISO: string, endISO: string): string {
  const startDate = parseDate(startISO);
  const endDate = parseDate(endISO);
  const sy = startDate.getFullYear();
  const sm = String(startDate.getMonth() + 1).padStart(2, '0');
  const sd = String(startDate.getDate()).padStart(2, '0');
  const em = String(endDate.getMonth() + 1).padStart(2, '0');
  const ed = String(endDate.getDate()).padStart(2, '0');
  return `${sy}/${sm}/${sd} — ${em}/${ed}`;
}

export function diffDays(startISO: string, endISO: string): number {
  const start = parseDate(startISO).getTime();
  const end = parseDate(endISO).getTime();
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

export function formatTime(time: string): string {
  return time;
}

export function formatStayDuration(minutes: number): string {
  if (minutes < 60) return `停留 ${minutes} 分`;
  const hours = minutes / 60;
  if (Number.isInteger(hours)) return `停留 ${hours} 小時`;
  return `停留 ${hours.toFixed(1)} 小時`;
}

export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + minutes;
  const nh = Math.floor((total % (24 * 60)) / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

/** 把分鐘數轉成 HH:MM (用於停留時間輸入)，超過 24 小時截到 23:59 */
export function minutesToHHMM(minutes: number): string {
  const total = Math.max(0, Math.min(24 * 60 - 1, minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** HH:MM (停留時間) 轉成總分鐘數，無效回 null */
export function hhmmToMinutes(hhmm: string): number | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1]!, 10);
  const min = parseInt(m[2]!, 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/**
 * 把使用者輸入的時間正規化成 HH:MM（24 小時制）。
 * 接受 "9", "9:0", "9:00", "09:00", "900", "0900", "1730" 等格式，
 * 不接受 24 時或 60 分。無效回 null。
 */
export function normalizeTimeInput(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  // 無冒號數字：900 → 09:00；1730 → 17:30
  if (/^\d{3,4}$/.test(s)) {
    s = s.length === 3 ? `0${s[0]}:${s.slice(1)}` : `${s.slice(0, 2)}:${s.slice(2)}`;
  } else if (/^\d{1,2}$/.test(s)) {
    s = `${s.padStart(2, '0')}:00`;
  } else if (/^\d{1,2}:\d{1,2}$/.test(s)) {
    const [h, m] = s.split(':');
    s = `${h!.padStart(2, '0')}:${m!.padStart(2, '0')}`;
  }
  const m = s.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const hh = parseInt(m[1]!, 10);
  const mm = parseInt(m[2]!, 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** 計算兩個 HH:MM 時刻的分鐘差（end - start），可能為負（end 隔日早於 start 視為加一天） */
export function timeDiffMinutes(start: string, end: string): number {
  const a = hhmmToMinutes(start);
  const b = hhmmToMinutes(end);
  if (a === null || b === null) return 0;
  let diff = b - a;
  if (diff < 0) diff += 24 * 60;
  return diff;
}
