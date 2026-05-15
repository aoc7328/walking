import { useEffect, useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useTripStore } from '../../stores/tripStore';
import { buildShareUrlInline, buildShareUrlWithId, generateQRDataUrl } from '../../services/share';
import { exportTripAsHTML } from '../../services/exportImport';

type LoadState = 'uploading' | 'ready' | 'tooBig' | 'uploadFailed';

export default function ShareModal() {
  const open = useUIStore((s) => s.shareModalOpen);
  const close = useUIStore((s) => s.closeShareModal);
  const trip = useTripStore((s) => s.trip);

  const [url, setUrl] = useState<string>('');
  const [qr, setQr] = useState<string>('');
  const [state, setState] = useState<LoadState>('uploading');
  const [errorDetail, setErrorDetail] = useState<string>('');
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  useEffect(() => {
    if (!open || !trip) return;
    setCopyState('idle');
    setQr('');
    setUrl('');
    setErrorDetail('');
    setState('uploading');

    const controller = new AbortController();

    (async () => {
      // 先試新方案：上傳到 KV 拿短 ID
      try {
        const shortUrl = await buildShareUrlWithId(trip, controller.signal);
        if (controller.signal.aborted) return;
        setUrl(shortUrl);
        try {
          const qrDataUrl = await generateQRDataUrl(shortUrl);
          if (controller.signal.aborted) return;
          setQr(qrDataUrl);
          setState('ready');
        } catch {
          // 短 URL 應該短到 QR 都吃得下，理論上不會走到這裡
          setState('uploadFailed');
          setErrorDetail('QR Code 產生失敗');
        }
        return;
      } catch (err) {
        if (controller.signal.aborted) return;
        // 後端失敗 → fallback 到舊的 inline URL
        const inlineUrl = buildShareUrlInline(trip);
        setUrl(inlineUrl);
        try {
          const qrDataUrl = await generateQRDataUrl(inlineUrl);
          if (controller.signal.aborted) return;
          setQr(qrDataUrl);
          setState('ready');
        } catch {
          if (controller.signal.aborted) return;
          setState('tooBig');
          setErrorDetail(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => controller.abort();
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
  const urlKB = url ? (url.length / 1024).toFixed(1) : '0';

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
            {state === 'tooBig'
              ? '行程上傳失敗，改用 fallback 連結（含完整資料，較長）但塞不進 QR Code。請直接複製連結或下載 HTML。'
              : '掃描下方 QR Code 或複製連結　·　朋友打開後會看到手機版的行程瀏覽頁'}
          </p>

          {state !== 'tooBig' && (
            <div className="share-qr-wrap">
              {state === 'ready' && qr ? (
                <img className="share-qr-img" src={qr} alt="行程 QR Code" />
              ) : state === 'uploadFailed' ? (
                <div className="share-qr-placeholder">{errorDetail || 'QR Code 產生失敗'}</div>
              ) : (
                <div className="share-qr-placeholder">上傳行程中…</div>
              )}
            </div>
          )}

          {state === 'tooBig' && (
            <div className="share-error">
              KV 後端無法使用（可能尚未設定 KV namespace），改用網址直接帶資料的舊方案。
              這個連結約 {urlKB} KB，超過 QR Code 容量。請改用：
              <ul className="share-error-list">
                <li><strong>複製連結</strong>：貼到 LINE / Email 給朋友，他點開就能看</li>
                <li><strong>下載 HTML 檔</strong>：傳獨立檔給朋友，瀏覽器離線就能看</li>
              </ul>
              <div className="share-error-hint">
                想啟用 QR Code 分享？請參考下方 README 設定 Cloudflare KV namespace。
              </div>
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
            <button className="btn" onClick={handleDownloadQR} disabled={state !== 'ready'}>
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
