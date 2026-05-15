export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'id-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function formatRating(rating?: number): string {
  if (rating === undefined) return '—';
  return rating.toFixed(1);
}

export function formatStars(rating: number): string {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(Math.max(0, 5 - full));
}

export function formatDuration(minutes?: number): string {
  if (minutes === undefined) return '—';
  if (minutes < 60) return `${minutes} 分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} 小時` : `${h} 小時 ${m} 分`;
}

export const TRANSPORT_LABEL: Record<string, string> = {
  driving: '車',
  walking: '走',
  transit: '大眾',
  bicycling: '腳踏車',
};
