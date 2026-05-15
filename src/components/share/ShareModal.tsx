import { useEffect, useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useTripStore } from '../../stores/tripStore';
import { buildShareUrl, generateQRDataUrl } from '../../services/share';
import { exportTripAsHTML } from '../../services/exportImport';

export default function ShareModal() {
  const open = useUIStore((s) => s.shareModalOpen);
  const close = useUIStore((s) => s.closeShareModal);
  const trip = useTripStore((s) => s.trip);

  const [url, setUrl] = useState<string>('');
  const [qr, setQr] = useState<string>('');
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !trip) return;
    setError(null);
    setCopyState('idle');
    let cancelled = false;
    (async () => {
      try {
        const shareUrl = buildShareUrl(trip);
        if (cancelled) return;
        setUrl(shareUrl);
        // URL 太長時 QR 會失敗
        if (shareUrl.length > 2500) {
          setError(`行程資料壓縮後仍有 ${shareUrl.length} 字元，可能超過 QR Code 可承載上限。建議改用「下載 HTML」分享。`);
        }
        const qrDataUrl = await generateQRDataUrl(shareUrl);
        if (!cancelled) setQr(qrDataUrl);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '產生分享連結失敗');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, trip]);

  if (!open || !trip) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      // ignore
    }
  }

  async function handleNativeShare() {
    if (!navigator.share || !trip) return;
    try {
      await navigator.share({
        title: trip.name,
        text: `${trip.name} — 旅行行程`,
        url,
      });
    } catch {
      // 使用者取消分享，忽略
    }
  }

  function handleDownloadQR() {
    if (!qr) return;
    const a = document.createElement('a');
    a.href = qr;
    const safeName = trip!.name.replace(/[\\/:*?"<>|]/g, '_');
    a.download = `${safeName}-QRCode.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handleFallbackHTML() {
    if (!trip) return;
    exportTripAsHTML(trip);
  }

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal">
        <div className="share-modal-body">
          <h2 className="modal-title">分享行程</h2>
          <p className="modal-subtitle">
            掃描下方 QR Code 或複製連結　·　朋友打開後會看到手機版的行程瀏覽頁
          </p>

          <div className="share-qr-wrap">
            {qr ? (
              <img className="share-qr-img" src={qr} alt="行程 QR Code" />
            ) : (
              <div className="share-qr-placeholder">產生中…</div>
            )}
          </div>

          {error && <div className="share-error">{error}</div>}

          <div className="share-url-row">
            <input className="share-url-input" type="text" value={url} readOnly onClick={(e) => (e.target as HTMLInputElement).select()} />
            <button className="btn" onClick={handleCopy}>
              {copyState === 'copied' ? '已複製' : '複製連結'}
            </button>
          </div>

          <div className="share-actions">
            {canNativeShare && (
              <button className="btn btn-primary" onClick={handleNativeShare}>
                分享到…
              </button>
            )}
            <button className="btn" onClick={handleDownloadQR} disabled={!qr}>
              下載 QR Code
            </button>
            <button className="btn" onClick={handleFallbackHTML}>
              下載 HTML 檔
            </button>
          </div>

          <div className="modal-actions">
            <button className="btn" onClick={close}>關閉</button>
          </div>
        </div>
      </div>
    </div>
  );
}
