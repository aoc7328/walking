import { pdf } from '@react-pdf/renderer';
import type { Trip } from '../types/trip';
import { TripPDF } from '../components/pdf/TripPDF';

export async function exportTripAsPDF(trip: Trip): Promise<void> {
  const instance = pdf(<TripPDF trip={trip} />);
  const blob = await instance.toBlob();
  const safeName = trip.name.replace(/[\\/:*?"<>|]/g, '_');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
