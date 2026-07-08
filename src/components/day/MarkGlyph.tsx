import { CAR_GLYPH } from '../../data/markPalette';

/**
 * 渲染一個標記符號：
 * - 車子（CAR_GLYPH）畫成 SVG，fill: currentColor → 吃父層的 CSS color，可自由上色。
 * - 其餘用原本的單色文字字符（★●▲…）。
 * 尺寸用 1em，跟著所在文字大小走；顏色一律由外層 style={{ color }} 決定。
 */
export default function MarkGlyph({ glyph }: { glyph: string }) {
  if (glyph === CAR_GLYPH) {
    return (
      <svg className="mark-car-svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden focusable="false">
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
      </svg>
    );
  }
  return <>{glyph}</>;
}
