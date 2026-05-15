import type { Trip } from '../types/trip';
import { TRANSPORT_LABEL, formatDuration } from '../utils/format';
import { formatWithWeekday, formatStayDuration } from '../utils/date';
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

export function importTripJSONFile(): Promise<Trip | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object' || !parsed.id || !Array.isArray(parsed.days)) {
          throw new Error('JSON 結構不正確');
        }
        resolve(parsed as Trip);
      } catch (err) {
        reject(err);
      }
    };
    input.click();
  });
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

function gmapsPlaceUrl(placeId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
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
    destination_place_id: destination.placeId,
    travelmode: mode,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function generateShareHTML(trip: Trip): string {
  const showStatic = hasApiKey();
  const daysHtml = trip.days
    .map((day) => {
      const markers = day.items.map((it, idx) => ({
        lat: it.place.coordinates.lat,
        lng: it.place.coordinates.lng,
        label: it.isHotel ? 'H' : String(idx + 1),
        color: it.isHotel ? 'purple' : 'green',
      }));
      const staticUrl = showStatic ? buildStaticMapUrl(markers) : null;

      const itemsHtml = day.items
        .map((it, idx) => {
          const leg = idx > 0 ? day.legs[idx - 1] : null;
          const legHtml = leg
            ? `<div class="leg">${TRANSPORT_LABEL[leg.mode] ?? leg.mode}　·　${formatDuration(leg.durationMinutes)}</div>`
            : '';
          const notesHtml = it.notes && it.notes.length > 0
            ? `<ul class="notes">${it.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>`
            : '';
          const markerLabel = it.isHotel ? 'H' : String(idx + 1);
          const placeUrl = gmapsPlaceUrl(it.place.placeId);
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
              <div class="marker ${it.isHotel ? 'hotel' : ''}">${markerLabel}</div>
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
  .marker { width: 28px; height: 28px; border-radius: 50%; background: var(--accent-primary); color: white; display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-size: 17px; }
  .marker.hotel { background: var(--accent-purple); }
  .time-name { display: flex; gap: 10px; align-items: baseline; margin-bottom: 2px; flex-wrap: wrap; }
  .time { font-family: 'Fraunces', serif; color: var(--accent-primary); font-weight: 500; }
  .name { font-weight: 500; color: var(--ink-primary); text-decoration: none; border-bottom: 0.5px dotted var(--ink-faint); transition: color 0.15s, border-color 0.15s; }
  .name:hover { color: var(--accent-primary); border-color: var(--accent-primary); }
  .name-arrow { font-size: 12px; color: var(--ink-muted); margin-left: 2px; }
  .stay, .addr { font-size: 15px; color: var(--ink-muted); }
  .addr { margin-top: 2px; }
  .notes { margin-top: 6px; padding-left: 16px; }
  .notes li { font-size: 16px; color: var(--ink-secondary); list-style: '• '; padding-left: 4px; }
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
