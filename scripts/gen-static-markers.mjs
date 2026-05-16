// 產生 Static Maps API 用的圓形 marker PNG。
// 純 Node、零外部依賴。手寫 PNG 編碼（用內建 zlib 做 IDAT 壓縮 + 自家 CRC32）。
//
// 輸出 → public/marker-day.png、public/marker-hotel.png
// 部署到 Cloudflare Pages 後可以從 https://walking2.pages.dev/marker-day.png 抓到。
//
// 為什麼不直接用 Google 內建 marker？因為內建只有水滴形 + 字母，
// 沒有「品牌色實心圓」這個選項，跟 app 內主地圖風格搭不起來。
//
// 為什麼不放數字？Static Maps `icon:URL` 不支援 `label`。數字看 itinerary list 那邊。

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, '..', 'public');

// ============ PNG encoder ============

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeBuf, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  // PNG signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR: 寬高 + 8bit RGBA
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; // 壓縮：deflate
  ihdr[11] = 0; // filter：標準
  ihdr[12] = 0; // interlace：無

  // IDAT：每列前面要加一個 filter byte (0 = None)
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ============ Marker 繪製 ============

/**
 * 畫一個實心圓 marker，外圍有白色描邊。
 * 用 supersampling (SSAA) 抗鋸齒：在 NxN 子像素抽樣，求平均覆蓋率。
 */
function drawCircleMarker(size, fillColor, options = {}) {
  const {
    borderColor = [255, 255, 255],
    borderWidthPx = 3,
    shadow = true,
    ssaa = 4,
  } = options;

  const cx = size / 2;
  const cy = size / 2;
  // 留 1px 給陰影位移
  const outerR = (size - 2) / 2;
  const innerR = outerR - borderWidthPx;

  const buf = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // SSAA：把這個像素切成 ssaa×ssaa 子像素，個別判斷
      let fillCover = 0;
      let borderCover = 0;
      let shadowCover = 0;
      for (let sy = 0; sy < ssaa; sy++) {
        for (let sx = 0; sx < ssaa; sx++) {
          const px = x + (sx + 0.5) / ssaa;
          const py = y + (sy + 0.5) / ssaa;
          const dx = px - cx;
          const dy = py - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= innerR) {
            fillCover++;
          } else if (dist <= outerR) {
            borderCover++;
          } else if (shadow) {
            // 在外圍 1.5px 內加一點陰影
            const sdx = px - (cx + 0.5);
            const sdy = py - (cy + 0.8);
            const sdist = Math.sqrt(sdx * sdx + sdy * sdy);
            if (sdist <= outerR + 1.2 && sdist > outerR) {
              shadowCover++;
            }
          }
        }
      }
      const samples = ssaa * ssaa;
      const fillA = fillCover / samples;
      const borderA = borderCover / samples;
      const shadowA = shadowCover / samples * 0.35;

      let r, g, b, a;
      if (fillA + borderA > 0) {
        // 內外混合，內優先
        const fillW = fillA;
        const borderW = borderA;
        r = Math.round(fillColor[0] * fillW + borderColor[0] * borderW);
        g = Math.round(fillColor[1] * fillW + borderColor[1] * borderW);
        b = Math.round(fillColor[2] * fillW + borderColor[2] * borderW);
        a = Math.round((fillW + borderW) * 255);
      } else if (shadowA > 0) {
        r = 0; g = 0; b = 0;
        a = Math.round(shadowA * 255);
      } else {
        r = 0; g = 0; b = 0; a = 0;
      }

      const i = (y * size + x) * 4;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = a;
    }
  }

  return buf;
}

// ============ Main ============

const SIZE = 56;

// 品牌色（與 src/styles/components.css 對齊）
const DAY_FILL = [0x2c, 0x4a, 0x3d];   // --accent-primary
const HOTEL_FILL = [0x5b, 0x4b, 0x7f]; // --accent-purple

mkdirSync(PUBLIC_DIR, { recursive: true });

const dayRgba = drawCircleMarker(SIZE, DAY_FILL);
writeFileSync(resolve(PUBLIC_DIR, 'marker-day.png'), encodePNG(SIZE, SIZE, dayRgba));

const hotelRgba = drawCircleMarker(SIZE, HOTEL_FILL);
writeFileSync(resolve(PUBLIC_DIR, 'marker-hotel.png'), encodePNG(SIZE, SIZE, hotelRgba));

console.log('[gen-static-markers] 已產生：');
console.log('  public/marker-day.png   （行程點，墨綠色）');
console.log('  public/marker-hotel.png （飯店，紫色）');
