import { useTripStore } from '../../stores/tripStore';
import { formatRange, diffDays } from '../../utils/date';
import { addDays } from '../../utils/date';
import { exportTripAsJSON, exportTripAsHTML, importTripJSONFile } from '../../services/exportImport';
import { exportTripAsPDF } from '../../services/pdfExport';

export default function Header() {
  const trip = useTripStore((s) => s.trip);
  const setTrip = useTripStore((s) => s.setTrip);

  if (!trip) return <header className="header" />;

  const endDate = addDays(trip.startDate, trip.days.length - 1);
  const totalDays = diffDays(trip.startDate, endDate) + 1;
  const cities = Array.from(new Set(trip.days.map((d) => d.city).filter(Boolean))).join('・');
  const meta = `${formatRange(trip.startDate, endDate)}　·　${totalDays} 天${cities ? `　·　${cities}` : ''}`;

  async function handleImport() {
    const ok = window.confirm('匯入會覆蓋目前的行程，確定要繼續嗎？');
    if (!ok) return;
    try {
      const imported = await importTripJSONFile();
      if (imported) setTrip(imported);
    } catch (err) {
      window.alert('匯入失敗：' + (err instanceof Error ? err.message : '未知錯誤'));
    }
  }

  return (
    <header className="header">
      <div className="brand">
        <span className="brand-mark">
          <em>走走</em>
        </span>
        <span className="brand-divider" />
        <div className="trip-info">
          <span className="trip-name">{trip.name}</span>
          <span className="trip-meta">{meta}</span>
        </div>
      </div>
      <div className="header-actions">
        <button className="btn" onClick={() => exportTripAsJSON(trip)} title="匯出 JSON">儲存</button>
        <button className="btn" onClick={handleImport} title="從 JSON 匯入">匯入</button>
        <button className="btn" onClick={() => exportTripAsPDF(trip)}>匯出 PDF</button>
        <button className="btn" onClick={() => exportTripAsHTML(trip)}>分享 HTML</button>
      </div>
    </header>
  );
}
