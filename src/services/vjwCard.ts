import type { VjwEntry } from '../types/ledger';
import { imageSrc } from './assets';

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

/**
 * 找出「塞得進 maxW」的字級（從 basePx 往下試到 minPx）。
 * 護照英文姓名可能很長（CHANG, SSU-CHI-MING），不縮就會超出卡片被切掉。
 */
function fitFontPx(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  basePx: number,
  minPx: number,
  fontOf: (px: number) => string,
): number {
  let px = basePx;
  while (px > minPx) {
    ctx.font = fontOf(Math.round(px));
    if (ctx.measureText(text).width <= maxW) break;
    px -= 1;
  }
  ctx.font = fontOf(Math.round(px));
  return Math.round(px);
}

/** 把一張卡畫進 canvas（白底、上圖下名）。 */
async function renderCardCanvas(entry: VjwEntry, tripName: string): Promise<HTMLCanvasElement> {
  const img = await loadImage(imageSrc(entry));
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
  // 卡片下方要放中文名＋英文名＋行程名，QR 的高度上限留 48mm
  const imgMaxH = 48 * PXMM;
  const s = Math.min(areaW / img.width, imgMaxH / img.height);
  const iw = img.width * s;
  const ih = img.height * s;
  ctx.drawImage(img, (CARD_W - iw) / 2, imgTop, iw, ih);

  let y = imgTop + ih + 7 * PXMM;
  ctx.strokeStyle = '#E4DCCB';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(CARD_W - padX, y);
  ctx.stroke();

  y += 7 * PXMM;
  ctx.textAlign = 'center';
  const cjk = '"Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif';
  const zh = entry.nameZh?.trim();
  if (zh) {
    ctx.fillStyle = '#1A1A1A';
    fitFontPx(ctx, zh, areaW, 7 * PXMM, 4 * PXMM, (px) => `600 ${px}px ${cjk}`);
    ctx.fillText(zh, CARD_W / 2, y);
  }

  // 護照英文姓名：一律大寫，跟護照上的印法一致
  const en = entry.nameEn?.trim().toUpperCase();
  if (en) {
    y += 5 * PXMM;
    ctx.fillStyle = '#3A342C';
    // 下限 2mm：外國姓名可能長到 30 字元以上，寧可小也不要被裁掉
    fitFontPx(ctx, en, areaW, 4 * PXMM, 2 * PXMM, (px) => `500 ${px}px Arial, Helvetica, sans-serif`);
    ctx.fillText(en, CARD_W / 2, y);
  }

  y += 4.5 * PXMM;
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
  const zh = entry.nameZh?.trim() ? `<div class="zh">${esc(entry.nameZh.trim())}</div>` : '';
  const en = entry.nameEn?.trim() ? `<div class="en">${esc(entry.nameEn.trim().toUpperCase())}</div>` : '';
  return `<div class="card">
    <img class="qr" src="${imageSrc(entry)}" alt="QR" />
    ${zh}
    ${en}
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
  @page { size: A4 portrait; margin: 10mm; }
  body { margin: 0; font-family: "Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif; color: #1a1a1a; }
  /* 版面寬度鎖在 A4 可列印範圍（210-20）以內。
     只要內容比紙寬，瀏覽器就會自作主張「縮到頁面」，卡片會整批變小。 */
  .sheet { width: 190mm; box-sizing: border-box; display: flex; flex-wrap: wrap; gap: 6mm; align-content: flex-start; }
  .card { width: 54mm; height: 86mm; box-sizing: border-box; border: 0.3mm dashed #b8b8b8; border-radius: 2mm;
    padding: 4mm 3mm 3mm; display: flex; flex-direction: column; align-items: center; page-break-inside: avoid; }
  .qr { max-width: 100%; max-height: 46mm; object-fit: contain; }
  .zh { font-size: 20pt; font-weight: 600; letter-spacing: 2px; margin-top: 3mm; text-align: center; }
  .en { font-size: 10.5pt; font-weight: 500; letter-spacing: 0.5px; color: #3A342C; margin-top: 1.5mm;
    text-align: center; line-height: 1.25; word-break: break-word; }
  .trip { font-size: 9pt; color: #777; margin-top: 1.5mm; text-align: center; }
  .tag { margin-top: auto; font-size: 7pt; color: #aaa; }
  /* 印出來拿尺量這條，剛好 5 公分才代表沒被縮放 */
  .ruler { width: 190mm; margin-top: 6mm; font-size: 7pt; color: #999; page-break-inside: avoid; }
  .ruler-bar { width: 50mm; height: 2.5mm; border: 0.3mm solid #999; border-top: none; }
  .notice { margin-bottom: 6mm; padding: 10px 14px; border: 1px solid #D8A25A; background: #FDF4E6;
    border-radius: 6px; font-size: 13px; line-height: 1.7; color: #6B4E22; max-width: 190mm; }
  .notice b { color: #8A5A12; }
  @media screen { body { background: #eee; padding: 8mm; } .sheet { background: #fff; padding: 10mm; } }
  @media print { .notice { display: none; } }
</style></head><body>
<div class="notice">
  <b>列印前請先確認這三項</b>，否則卡片會被縮小（常見狀況：印出來只有 2 公分左右）：<br>
  1. 縮放 / Scale＝<b>100%</b>（不要選「符合頁面」「Fit to page」）<br>
  2. 每張紙的頁數 / Pages per sheet＝<b>1</b><br>
  3. 紙張大小＝<b>A4</b><br>
  正確的話每張卡是 5.4 × 8.6 公分。印完可以拿尺量頁面下方那條線，<b>剛好 5 公分</b>就對了。
</div>
<div class="sheet">${cards}</div>
<div class="ruler"><div class="ruler-bar"></div>↑ 這條應該是 5 公分（不是的話，列印縮放不是 100%）</div>
<script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
</body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
