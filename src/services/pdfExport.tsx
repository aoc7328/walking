import { pdf } from '@react-pdf/renderer';
import type { Trip } from '../types/trip';
import { TripPDF } from '../components/pdf/TripPDF';
import { TripBookletPDF } from '../components/pdf/TripBookletPDF';

async function downloadPDF(doc: React.ReactElement, filename: string): Promise<void> {
  const instance = pdf(doc);
  const blob = await instance.toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

export async function exportTripAsPDF(trip: Trip): Promise<void> {
  try {
    await downloadPDF(<TripPDF trip={trip} />, `${safeName(trip.name)}.pdf`);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error('[PDF export failed]', err);
    window.alert(`PDF 匯出失敗：\n${msg}`);
  }
}

export async function exportTripAsBookletPDF(trip: Trip): Promise<void> {
  try {
    await downloadPDF(
      <TripBookletPDF trip={trip} />,
      `${safeName(trip.name)}-騎馬釘.pdf`,
    );
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error('[PDF booklet export failed]', err);
    window.alert(`騎馬釘 PDF 匯出失敗：\n${msg}`);
  }
}
