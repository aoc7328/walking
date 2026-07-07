import jsQR from 'jsqr';

/**
 * 讀圖檔 → 依最長邊縮到 maxDim（不放大）→ 回傳 PNG data URL。
 * 用 PNG 保留 QR Code 的銳利邊緣（掃得到）；縮圖是為了不讓帳本 payload 太肥。
 */
export function fileToScaledPngDataUrl(file: File, maxDim = 720): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('請上傳圖片檔（JPG / PNG）'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('讀取檔案失敗'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('圖片解析失敗'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('瀏覽器不支援 canvas'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const DARK_LUM = 160; // 亮度低於此視為「有墨」（黑 QR / 黑字）

interface Box { x: number; y: number; w: number; h: number }

/** 針對一張影像資料的墨點分析工具。 */
function makeAnalyzer(data: Uint8ClampedArray, W: number, H: number) {
  const isDark = (x: number, y: number): boolean => {
    const i = (y * W + x) * 4;
    if (data[i + 3]! <= 30) return false;
    return 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]! < DARK_LUM;
  };
  const thr = Math.max(2, W * 0.003);
  const rowHasInk = (y: number): boolean => {
    let n = 0;
    for (let x = 0; x < W; x++) if (isDark(x, y)) { if (++n > thr) return true; }
    return false;
  };
  const bbox = (y0: number, y1: number): Box | null => {
    let minX = W, maxX = -1, minY = -1, maxY = -1;
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) {
      let has = false;
      for (let x = 0; x < W; x++) if (isDark(x, y)) { if (x < minX) minX = x; if (x > maxX) maxX = x; has = true; }
      if (has) { if (minY < 0) minY = y; maxY = y; }
    }
    return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  };
  return { rowHasInk, bbox };
}

type Analyzer = ReturnType<typeof makeAnalyzer>;

/**
 * 用 jsQR 精準定位 QR 方塊，回傳其外框（像素）。
 * 只取幾何座標裁切用；刻意不讀 code.data（那是入境個資，不儲存不記錄不外送）。
 */
function locateQr(data: Uint8ClampedArray, W: number, H: number): Box | null {
  let code = null as ReturnType<typeof jsQR>;
  try {
    code = jsQR(data, W, H, { inversionAttempts: 'attemptBoth' });
  } catch {
    return null;
  }
  if (!code || !code.location) return null;
  const L = code.location;
  const xs = [L.topLeftCorner.x, L.topRightCorner.x, L.bottomLeftCorner.x, L.bottomRightCorner.x];
  const ys = [L.topLeftCorner.y, L.topRightCorner.y, L.bottomLeftCorner.y, L.bottomRightCorner.y];
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(...ys)));
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  if (w < 20 || h < 20) return null;
  return { x: minX, y: minY, w, h };
}

/** QR 下方第一段內容帶（＝英文名）的外框。 */
function firstBandBelow(az: Analyzer, H: number, fromY: number): Box | null {
  let y = Math.max(0, Math.round(fromY));
  while (y < H && !az.rowHasInk(y)) y++;
  if (y >= H) return null;
  const s = y;
  while (y < H && az.rowHasInk(y)) y++;
  return az.bbox(s, y - 1);
}

function compose(src: HTMLCanvasElement, qr: Box, qcrop: Box, name: Box | null): string | null {
  const gap = name ? Math.round(qr.h * 0.05) : 0;
  const sidePad = Math.round(qr.w * 0.06);
  const bottomPad = name ? Math.round(qr.w * 0.08) : 0;
  const outW = Math.round(Math.max(qcrop.w, (name ? name.w : 0) + 2 * sidePad));
  const outH = Math.round(qcrop.h + gap + (name ? name.h : 0) + bottomPad);
  const oc = document.createElement('canvas');
  oc.width = outW;
  oc.height = outH;
  const octx = oc.getContext('2d');
  if (!octx) return null;
  octx.fillStyle = '#FFFFFF';
  octx.fillRect(0, 0, outW, outH);
  octx.drawImage(src, qcrop.x, qcrop.y, qcrop.w, qcrop.h, Math.round((outW - qcrop.w) / 2), 0, qcrop.w, qcrop.h);
  if (name) {
    octx.drawImage(src, name.x, name.y, name.w, name.h, Math.round((outW - name.w) / 2), qcrop.h + gap, name.w, name.h);
  }
  return oc.toDataURL('image/png');
}

/** 主路徑：jsQR 定位 QR → 裁 QR（含安靜區）＋ 抓下方英文名 → 緊湊重組。 */
function composeFromQr(src: HTMLCanvasElement, az: Analyzer, W: number, H: number, qr: Box): string | null {
  const quiet = Math.round(qr.w * 0.1); // QR 掃描安靜區
  const qx = Math.max(0, qr.x - quiet);
  const qy = Math.max(0, qr.y - quiet);
  const qcrop: Box = { x: qx, y: qy, w: Math.min(W - qx, qr.w + 2 * quiet), h: Math.min(H - qy, qr.h + 2 * quiet) };
  const name = firstBandBelow(az, H, qr.y + qr.h);
  return compose(src, qr, qcrop, name);
}

/** 退回路徑：抓「內容中最大的水平留白」切成上（QR）下（名字）兩塊，再緊湊重組。 */
function tightenByGap(src: HTMLCanvasElement, az: Analyzer, W: number, H: number): string | null {
  let firstInk = -1, lastInk = -1;
  const rows: boolean[] = new Array(H);
  for (let y = 0; y < H; y++) {
    rows[y] = az.rowHasInk(y);
    if (rows[y]) { if (firstInk < 0) firstInk = y; lastInk = y; }
  }
  if (firstInk < 0) return null;

  let gapTop = -1, bestLen = 0;
  for (let y = firstInk; y <= lastInk; ) {
    if (!rows[y]) {
      const s = y;
      while (y <= lastInk && !rows[y]) y++;
      if (y - s > bestLen) { bestLen = y - s; gapTop = s; }
    } else y++;
  }
  const contentH = lastInk - firstInk + 1;
  if (gapTop < 0 || bestLen <= Math.max(12, contentH * 0.05)) return null;
  const gapBot = gapTop + bestLen - 1;

  const qr = az.bbox(firstInk, gapTop - 1);
  const name = az.bbox(gapBot + 1, lastInk);
  if (!qr || !name) return null;
  const quiet = Math.round(qr.w * 0.07);
  const qcrop: Box = {
    x: Math.max(0, qr.x - quiet),
    y: Math.max(0, qr.y - quiet),
    w: Math.min(W, qr.w + 2 * quiet),
    h: Math.min(H, qr.h + 2 * quiet),
  };
  return compose(src, qr, qcrop, name);
}

/**
 * 把 Visit Japan Web 手動截圖整理成緊湊卡片素材（白邊寬度不固定、周圍可能有雜訊都沒關係）：
 * 1) 先用 jsQR 精準定位 QR 方塊 → 裁出 QR（保留掃描安靜區）＋ 抓 QR 正下方第一段文字（英文名）。
 * 2) jsQR 找不到 → 退回「抓最大水平留白切開」的啟發式。
 * 3) 都不行 / 任何異常 → 原圖照回（安全退回，不會弄壞）。
 */
export function tightenQrCardImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => resolve(dataUrl);
    img.onload = () => {
      try {
        const W = img.width;
        const H = img.height;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, W, H).data;
        const az = makeAnalyzer(data, W, H);

        const qr = locateQr(data, W, H);
        const out = qr ? composeFromQr(canvas, az, W, H, qr) : tightenByGap(canvas, az, W, H);
        resolve(out ?? dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.src = dataUrl;
  });
}
