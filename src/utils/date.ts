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

export function formatWithWeekday(iso: string): string {
  const date = parseDate(iso);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}/${d}　${WEEKDAYS[date.getDay()]}`;
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
