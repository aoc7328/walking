import { useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useTripStore } from '../../stores/tripStore';
import { exportTripAsPDF, exportTripAsBookletPDF } from '../../services/pdfExport';

type Variant = 'standard' | 'booklet';

export default function DownloadModal() {
  const open = useUIStore((s) => s.downloadModalOpen);
  const close = useUIStore((s) => s.closeDownloadModal);
  const trip = useTripStore((s) => s.trip);
  const [busy, setBusy] = useState<Variant | null>(null);

  if (!open || !trip) return null;

  async function handlePick(variant: Variant) {
    if (busy || !trip) return;
    setBusy(variant);
    try {
      if (variant === 'standard') await exportTripAsPDF(trip);
      else await exportTripAsBookletPDF(trip);
      close();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
    >
      <div className="modal download-modal">
        <h2 className="modal-title">下載 PDF</h2>
        <p className="modal-subtitle">選一個版本下載</p>

        <div className="download-options">
          <button
            type="button"
            className="download-option"
            onClick={() => handlePick('standard')}
            disabled={busy !== null}
          >
            <div className="download-option-title">普通版</div>
            <div className="download-option-desc">
              A4 直印單面，一天一頁、依序閱讀
            </div>
            {busy === 'standard' && <div className="download-option-busy">產生中…</div>}
          </button>

          <button
            type="button"
            className="download-option"
            onClick={() => handlePick('booklet')}
            disabled={busy !== null}
          >
            <div className="download-option-title">騎馬釘版　·　小冊子</div>
            <div className="download-option-desc">
              A4 橫印雙面 → 全部對摺 → 中線釘起來，就是隨身小冊子。
              <br />
              <span className="download-option-hint">
                列印時請選「A4 橫向 / 雙面 / 沿短邊翻頁」
              </span>
            </div>
            {busy === 'booklet' && <div className="download-option-busy">產生中…</div>}
          </button>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn"
            onClick={close}
            disabled={busy !== null}
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
