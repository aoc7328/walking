import type { Trip } from '../types/trip';
import type { Place } from '../types/place';
import { TRANSPORT_LABEL, formatDuration } from '../utils/format';
import { formatWithWeekday, formatStayDuration } from '../utils/date';
import { printableDayNote } from '../utils/dayNote';
import { buildStaticMapUrl, hasApiKey } from './googleMaps';

function download(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportTripAsJSON(trip: Trip): void {
  const data = JSON.stringify(trip, null, 2);
  const safeName = trip.name.replace(/[\\/:*?"<>|]/g, '_');
  download(`${safeName}.json`, data, 'application/json');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function exportTripAsHTML(trip: Trip): void {
  const safeName = trip.name.replace(/[\\/:*?"<>|]/g, '_');
  const html = generateShareHTML(trip);
  download(`${safeName}.html`, html, 'text/html');
}

function isRealPlaceId(placeId?: string): boolean {
  // 手動座標點的 placeId 是 manual- 前綴，不是真的 Google placeId
  return !!placeId && !placeId.startsWith('manual-');
}

function gmapsPlaceUrl(place: Place): string {
  // Google 已廢 ?q=place_id: 格式（會被當字面字串去搜，找不到）。改用官方 search API 格式。
  if (isRealPlaceId(place.placeId)) {
    const params = new URLSearchParams({ api: '1', query: place.name, query_place_id: place.placeId });
    return `https://www.google.com/maps/search/?${params.toString()}`;
  }
  // 手動點：沒有真 placeId，用座標查詢
  const { lat, lng } = place.coordinates;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function gmapsDirectionsUrl(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number; placeId: string },
  mode: 'driving' | 'walking' | 'transit' | 'bicycling',
): string {
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: mode,
  });
  // 只有真 placeId 才帶；manual- 的帶了會被 Google 拒絕／忽略
  if (isRealPlaceId(destination.placeId)) {
    params.set('destination_place_id', destination.placeId);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function generateShareHTML(trip: Trip): string {
  const showStatic = hasApiKey();
  const daysHtml = trip.days
    .map((day) => {
      const markers = day.items.map((it, idx) => {
        const n = idx + 1;
        return {
          lat: it.place.coordinates.lat,
          lng: it.place.coordinates.lng,
          // 1–9 顯示數字、10+ 無 label（Static Maps 單字元限制），統一深湖綠
          label: n <= 9 ? String(n) : undefined,
        };
      });
      const staticUrl = showStatic ? buildStaticMapUrl(markers) : null;

      const note = printableDayNote(day);
      const noteHtml = note
        ? `<div class="day-note">${note.iconEmoji ? `<span class="day-note-icon">${escapeHtml(note.iconEmoji)}</span>` : ''}<span class="day-note-text">${escapeHtml(note.text)}</span></div>`
        : '';

      const itemsHtml = day.items
        .map((it, idx) => {
          const leg = idx > 0 ? day.legs[idx - 1] : null;
          const legHtml = leg
            ? `<div class="leg">${TRANSPORT_LABEL[leg.mode] ?? leg.mode}　·　${formatDuration(leg.durationMinutes)}</div>`
            : '';
          const notesHtml = it.notes && it.notes.length > 0
            ? `<ul class="notes">${it.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>`
            : '';
          const markerLabel = String(idx + 1);
          const placeUrl = gmapsPlaceUrl(it.place);
          const prev = idx > 0 ? day.items[idx - 1] : null;
          const navUrl =
            prev && leg
              ? gmapsDirectionsUrl(prev.place.coordinates, { ...it.place.coordinates, placeId: it.place.placeId }, leg.mode)
              : null;
          const navHtml = navUrl
            ? `<a class="nav-btn" href="${navUrl}" target="_blank" rel="noreferrer" title="從上一站導航到這裡">🧭 導航到這裡</a>`
            : '';
          return `
            ${legHtml}
            <div class="card">
              <div class="marker">${markerLabel}</div>
              <div class="body">
                <div class="time-name">
                  <span class="time">${escapeHtml(it.arrivalTime)}</span>
                  <a class="name" href="${placeUrl}" target="_blank" rel="noreferrer" title="在 Google Maps 開啟">${escapeHtml(it.place.name)} <span class="name-arrow">↗</span></a>
                </div>
                <div class="stay">${formatStayDuration(it.stayMinutes)}</div>
                <div class="addr">${escapeHtml(it.place.address)}</div>
                ${notesHtml}
                ${navHtml}
              </div>
            </div>
          `;
        })
        .join('');

      return `
        <section class="day">
          <h2>Day ${day.dayIndex}　·　${escapeHtml(formatWithWeekday(day.date))}${day.city ? `　·　${escapeHtml(day.city)}` : ''}</h2>
          ${noteHtml}
          ${staticUrl ? `<img class="static-map" src="${staticUrl}" alt="Day ${day.dayIndex} 地圖"/>` : ''}
          ${itemsHtml}
        </section>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="zh-Hant-TW">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(trip.name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&family=Noto+Serif+TC:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --bg-page: #FAF7F0;
    --bg-card: #FFFFFF;
    --ink-primary: #2C2620;
    --ink-secondary: #6B5F50;
    --ink-muted: #A89C8B;
    --accent-primary: #2C4A3D;
    --accent-warm: #D85A30;
    --accent-purple: #5B4B7F;
    --border-soft: #E8DFD0;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Serif TC', Georgia, serif; color: var(--ink-primary); background: var(--bg-page); padding: 40px 20px; max-width: 700px; margin: 0 auto; }
  h1 { font-family: 'Fraunces', serif; font-style: italic; color: var(--accent-primary); font-size: 36px; margin-bottom: 6px; }
  .meta { color: var(--ink-muted); font-size: 17px; margin-bottom: 30px; }
  .day { margin-bottom: 40px; }
  .day h2 { font-family: 'Fraunces', serif; font-size: 24px; color: var(--accent-primary); margin-bottom: 14px; padding-bottom: 6px; border-bottom: 0.5px solid var(--border-soft); }
  .static-map { width: 100%; border-radius: 8px; margin-bottom: 14px; }
  .card { background: var(--bg-card); border: 0.5px solid var(--border-soft); border-radius: 6px; padding: 10px 14px; display: grid; grid-template-columns: 30px 1fr; gap: 12px; margin-bottom: 4px; }
  .marker { width: 28px; height: 28px; border-radius: 50%; background: var(--accent-primary); color: white; display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-size: 17px; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
  .time-name { display: flex; gap: 10px; align-items: baseline; margin-bottom: 2px; flex-wrap: wrap; }
  .time { font-family: 'Fraunces', serif; color: var(--accent-primary); font-weight: 500; }
  .name { font-weight: 500; color: var(--ink-primary); text-decoration: none; border-bottom: 0.5px dotted var(--ink-faint); transition: color 0.15s, border-color 0.15s; }
  .name:hover { color: var(--accent-primary); border-color: var(--accent-primary); }
  .name-arrow { font-size: 12px; color: var(--ink-muted); margin-left: 2px; }
  .stay, .addr { font-size: 15px; color: var(--ink-muted); }
  .addr { margin-top: 2px; }
  .notes { margin-top: 6px; padding-left: 16px; }
  .notes li { font-size: 16px; color: var(--ink-secondary); list-style: '• '; padding-left: 4px; }
  .day-note { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 14px; padding: 10px 14px; background: #FAEDE4; border: 0.5px solid var(--border-soft); border-radius: 6px; }
  .day-note-icon { font-size: 18px; flex-shrink: 0; }
  .day-note-text { font-size: 16px; color: var(--ink-primary); line-height: 1.6; white-space: pre-wrap; }
  .leg { font-size: 15px; color: var(--ink-muted); padding: 6px 0 6px 42px; }
  .nav-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    padding: 6px 12px;
    background: var(--accent-primary);
    color: white;
    border-radius: 999px;
    font-size: 14px;
    text-decoration: none;
    transition: background 0.15s, transform 0.15s;
  }
  .nav-btn:hover { background: #234037; transform: translateY(-1px); }
</style>
</head>
<body>
  <h1>${escapeHtml(trip.name)}</h1>
  <div class="meta">${escapeHtml(trip.startDate)}　·　共 ${trip.days.length} 天</div>
  ${daysHtml}
</body>
</html>
`;
}
