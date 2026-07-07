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

/**
 * 把 Visit Japan Web 截圖整理成緊湊卡片素材：
 * 偵測「QR 區塊」與「英文名區塊」之間那條最大的水平留白，切開後重新緊湊排版
 * （QR 在上、保留掃描安靜區；英文名緊接其下、置中）。
 * 偵測不到明顯大縫、或任何異常 → 原圖照回（安全退回，不會弄壞）。
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

        const isDark = (x: number, y: number): boolean => {
          const i = (y * W + x) * 4;
          if (data[i + 3]! <= 30) return false;
          const lum = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
          return lum < DARK_LUM;
        };

        const rowInkThreshold = Math.max(2, W * 0.003);
        const rowHasInk = (y: number): boolean => {
          let count = 0;
          for (let x = 0; x < W; x++) if (isDark(x, y)) { if (++count > rowInkThreshold) return true; }
          return false;
        };

        let firstInk = -1;
        let lastInk = -1;
        const rows: boolean[] = new Array(H);
        for (let y = 0; y < H; y++) {
          rows[y] = rowHasInk(y);
          if (rows[y]) { if (firstInk < 0) firstInk = y; lastInk = y; }
        }
        if (firstInk < 0) return resolve(dataUrl);

        let gapTop = -1;
        let bestLen = 0;
        for (let y = firstInk; y <= lastInk; ) {
          if (!rows[y]) {
            const s = y;
            while (y <= lastInk && !rows[y]) y++;
            if (y - s > bestLen) { bestLen = y - s; gapTop = s; }
          } else y++;
        }
        const contentH = lastInk - firstInk + 1;
        if (gapTop < 0 || bestLen <= Math.max(12, contentH * 0.05)) return resolve(dataUrl);
        const gapBot = gapTop + bestLen - 1;

        const bbox = (y0: number, y1: number): Box | null => {
          let minX = W, maxX = -1, minY = -1, maxY = -1;
          for (let y = y0; y <= y1; y++) {
            let has = false;
            for (let x = 0; x < W; x++) {
              if (isDark(x, y)) { if (x < minX) minX = x; if (x > maxX) maxX = x; has = true; }
            }
            if (has) { if (minY < 0) minY = y; maxY = y; }
          }
          return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
        };

        const qr = bbox(firstInk, gapTop - 1);
        const name = bbox(gapBot + 1, lastInk);
        if (!qr || !name) return resolve(dataUrl);

        const quiet = Math.round(qr.w * 0.07);        // QR 掃描安靜區
        const smallGap = Math.round(qr.h * 0.06);      // QR 與名字間的小間距
        const outW = Math.max(qr.w, name.w) + 2 * quiet;
        const outH = quiet + qr.h + smallGap + name.h + quiet;
        const out = document.createElement('canvas');
        out.width = outW;
        out.height = outH;
        const octx = out.getContext('2d');
        if (!octx) return resolve(dataUrl);
        octx.fillStyle = '#FFFFFF';
        octx.fillRect(0, 0, outW, outH);
        octx.drawImage(canvas, qr.x, qr.y, qr.w, qr.h, Math.round((outW - qr.w) / 2), quiet, qr.w, qr.h);
        octx.drawImage(canvas, name.x, name.y, name.w, name.h, Math.round((outW - name.w) / 2), quiet + qr.h + smallGap, name.w, name.h);
        resolve(out.toDataURL('image/png'));
      } catch {
        resolve(dataUrl);
      }
    };
    img.src = dataUrl;
  });
}
