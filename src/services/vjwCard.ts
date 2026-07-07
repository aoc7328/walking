import type { VjwEntry } from '../types/ledger';

/**
 * Visit Japan Web 入境資訊卡：直式名片 54×86mm。
 * 卡片 = 使用者上傳的 QR 圖（已含 QR＋英文名）＋ 中文姓名 ＋ 本趟行程名稱。
 * - 下載 JPG：一人一張，canvas 合成後下載（存手機各掃各的）。
 * - 列印：全部人排在同一張 A4，印出來自己剪開。
 */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('圖片載入失敗'));
    img.src = src;
  });
}

const PXMM = 12; // 每毫米像素（54×86mm → 648×1032px，夠清晰列印/掃描）
const CARD_W = 54 * PXMM;
const CARD_H = 86 * PXMM;

/** 把一張卡畫進 canvas（白底、上圖下名）。 */
async function renderCardCanvas(entry: VjwEntry, tripName: string): Promise<HTMLCanvasElement> {
  const img = await loadImage(entry.image);
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('瀏覽器不支援 canvas');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const padX = 5 * PXMM;
  const areaW = CARD_W - 2 * padX;
  const imgTop = 5 * PXMM;
  const imgMaxH = 52 * PXMM;
  const s = Math.min(areaW / img.width, imgMaxH / img.height);
  const iw = img.width * s;
  const ih = img.height * s;
  ctx.drawImage(img, (CARD_W - iw) / 2, imgTop, iw, ih);

  let y = imgTop + ih + 8 * PXMM;
  ctx.strokeStyle = '#E4DCCB';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(CARD_W - padX, y);
  ctx.stroke();

  y += 7 * PXMM;
  ctx.textAlign = 'center';
  const cjk = '"Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif';
  if (entry.nameZh && entry.nameZh.trim()) {
    ctx.fillStyle = '#1A1A1A';
    ctx.font = `600 ${Math.round(7 * PXMM)}px ${cjk}`;
    ctx.fillText(entry.nameZh.trim(), CARD_W / 2, y);
  }
  y += 5 * PXMM;
  ctx.fillStyle = '#7A6F5C';
  ctx.font = `${Math.round(3.6 * PXMM)}px ${cjk}`;
  ctx.fillText(tripName, CARD_W / 2, y);

  ctx.fillStyle = '#A69C8E';
  ctx.font = `${Math.round(3 * PXMM)}px sans-serif`;
  ctx.fillText('Visit Japan Web', CARD_W / 2, CARD_H - 4 * PXMM);

  return canvas;
}

function safeFileName(s: string): string {
  return (s || 'QR').replace(/[\\/:*?"<>|]/g, '_').trim() || 'QR';
}

/** 下載單一人的資訊卡成 JPG。 */
export async function downloadVjwCardJpg(entry: VjwEntry, tripName: string): Promise<void> {
  const canvas = await renderCardCanvas(entry, tripName);
  const url = canvas.toDataURL('image/jpeg', 0.95);
  const a = document.createElement('a');
  a.href = url;
  a.download = `VisitJapanWeb-${safeFileName(entry.nameZh ?? '')}.jpg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

function cardHtml(entry: VjwEntry, tripName: string): string {
  const zh = entry.nameZh && entry.nameZh.trim() ? `<div class="zh">${esc(entry.nameZh.trim())}</div>` : '';
  return `<div class="card">
    <img class="qr" src="${entry.image}" alt="QR" />
    ${zh}
    <div class="trip">${esc(tripName)}</div>
    <div class="tag">Visit Japan Web</div>
  </div>`;
}

/** 開新視窗，把全部人的卡排在 A4 上列印（自己剪開）。 */
export function printVjwCards(entries: VjwEntry[], tripName: string): void {
  if (entries.length === 0) {
    window.alert('還沒有可列印的 QR，請先上傳。');
    return;
  }
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) {
    window.alert('瀏覽器擋掉了彈出視窗，請允許彈出視窗後再試。');
    return;
  }
  const cards = entries.map((e) => cardHtml(e, tripName)).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Visit Japan Web QR - ${esc(tripName)}</title>
<style>
  @page { size: A4; margin: 10mm; }
  body { margin: 0; font-family: "Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif; color: #1a1a1a; }
  .sheet { display: flex; flex-wrap: wrap; gap: 6mm; align-content: flex-start; }
  .card { width: 54mm; height: 86mm; box-sizing: border-box; border: 0.3mm dashed #b8b8b8; border-radius: 2mm;
    padding: 4mm 3mm 3mm; display: flex; flex-direction: column; align-items: center; page-break-inside: avoid; }
  .qr { max-width: 100%; max-height: 52mm; object-fit: contain; }
  .zh { font-size: 20pt; font-weight: 600; letter-spacing: 2px; margin-top: 3mm; text-align: center; }
  .trip { font-size: 9pt; color: #777; margin-top: 1.5mm; text-align: center; }
  .tag { margin-top: auto; font-size: 7pt; color: #aaa; }
  @media screen { body { background: #eee; padding: 8mm; } .sheet { background: #fff; padding: 10mm; } }
</style></head><body>
<div class="sheet">${cards}</div>
<script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
</body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
