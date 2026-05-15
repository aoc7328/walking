import { useEffect, useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useTripStore } from '../../stores/tripStore';
import { buildShareUrl, generateQRDataUrl } from '../../services/share';
import { exportTripAsHTML } from '../../services/exportImport';

type QRState = 'pending' | 'ready' | 'tooBig' | 'failed';

export default function ShareModal() {
  const open = useUIStore((s) => s.shareModalOpen);
  const close = useUIStore((s) => s.closeShareModal);
  const trip = useTripStore((s) => s.trip);

  const [url, setUrl] = useState<string>('');
  const [qr, setQr] = useState<string>('');
  const [qrState, setQrState] = useState<QRState>('pending');
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  useEffect(() => {
    if (!open || !trip) return;
    setCopyState('idle');
    setQr('');
    setQrState('pending');
    let cancelled = false;
    (async () => {
      try {
        const shareUrl = buildShareUrl(trip);
        if (cancelled) return;
        setUrl(shareUrl);
        try {
          const qrDataUrl = await generateQRDataUrl(shareUrl);
          if (!cancelled) {
            setQr(qrDataUrl);
            setQrState('ready');
          }
        } catch (qrErr) {
          if (cancelled) return;
          const msg = qrErr instanceof Error ? qrErr.message : String(qrErr);
          if (/too big|big to be stored/i.test(msg)) {
            setQrState('tooBig');
          } else {
            setQrState('failed');
          }
        }
      } catch {
        if (!cancelled) setQrState('failed');
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
  const urlKB = (url.length / 1024).toFixed(1);

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
            {qrState === 'tooBig'
              ? '行程資料太大，無法塞進 QR Code。改用下方「複製連結」或「下載 HTML 檔」分享。'
              : '掃描下方 QR Code 或複製連結　·　朋友打開後會看到手機版的行程瀏覽頁'}
          </p>

          {qrState !== 'tooBig' && (
            <div className="share-qr-wrap">
              {qrState === 'ready' && qr ? (
                <img className="share-qr-img" src={qr} alt="行程 QR Code" />
              ) : qrState === 'failed' ? (
                <div className="share-qr-placeholder">QR Code 產生失敗</div>
              ) : (
                <div className="share-qr-placeholder">產生中…</div>
              )}
            </div>
          )}

          {qrState === 'tooBig' && (
            <div className="share-error">
              行程資料壓縮後約 {urlKB} KB，超過 QR Code 容量上限（約 2.9 KB）。
              <br />
              QR 分享需要先做後端儲存（Cloudflare KV）才能支援這麼大的行程，目前先用下面兩個方式：
              <ul className="share-error-list">
                <li><strong>複製連結</strong>：貼到 LINE / Email / 訊息給朋友，他點開就能看（網址很長但能用）</li>
                <li><strong>下載 HTML 檔</strong>：產生獨立檔案，傳給朋友開瀏覽器就能離線看完整行程</li>
              </ul>
            </div>
          )}

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
            <button className="btn" onClick={handleDownloadQR} disabled={qrState !== 'ready'}>
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
