// 日期標記可用的「形狀」與「顏色」調色盤，以及 glyph+color 的工具函式。

export interface GlyphOption {
  glyph: string;
  name: string;
}

export interface ColorOption {
  color: string;
  name: string;
}

/** 車子符號的 sentinel（不是文字字符）：由 MarkGlyph 特判成可上色的 SVG 渲染。 */
export const CAR_GLYPH = 'car';

/**
 * 形狀：文字字符用單色（非彩色 emoji）才能用 CSS color 自由上色；
 * 車子（CAR_GLYPH）是例外——畫成 SVG（fill: currentColor），一樣吃選定顏色。
 */
export const MARK_GLYPHS: GlyphOption[] = [
  { glyph: '★', name: '五角星' },
  { glyph: '●', name: '圓點' },
  { glyph: '▲', name: '三角' },
  { glyph: '■', name: '方塊' },
  { glyph: '◆', name: '菱形' },
  { glyph: '♥', name: '愛心' },
  { glyph: '✦', name: '星芒' },
  { glyph: '✓', name: '勾選' },
  { glyph: CAR_GLYPH, name: '車子' },
];

/** 顏色：與整體暖色系搭配但仍夠醒目的 8 色。 */
export const MARK_COLORS: ColorOption[] = [
  { color: '#E6B800', name: '金黃' },
  { color: '#E8763A', name: '橙' },
  { color: '#D6453F', name: '紅' },
  { color: '#D6478F', name: '桃紅' },
  { color: '#8E5BC9', name: '紫' },
  { color: '#3B82C4', name: '藍' },
  { color: '#16A085', name: '青' },
  { color: '#4CA361', name: '綠' },
];

/** glyph + color 的唯一鍵。 */
export function markKey(glyph: string, color: string): string {
  return `${glyph}|${color}`;
}

/** 給某個符號一個好讀的中文名（例如「金黃五角星」），找不到對應名稱就退回原字符。 */
export function markName(glyph: string, color: string): string {
  const c = MARK_COLORS.find((x) => x.color.toLowerCase() === color.toLowerCase())?.name ?? '';
  const g = MARK_GLYPHS.find((x) => x.glyph === glyph)?.name ?? glyph;
  return `${c}${g}`;
}
