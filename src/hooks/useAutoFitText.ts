import { useLayoutEffect, useRef, useState } from 'react';

/**
 * 文字自適應字級：先用基準字級渲染，
 * 如果實際 scrollHeight 超過容器 clientHeight（被 line-clamp 截掉），
 * 就把字級縮 0.5px 重測，直到塞得下或碰到下限。
 *
 * 配合 CSS 的 `-webkit-line-clamp: 2` 一起用 —
 * line-clamp 限制最多 2 行；hook 負責讓內容盡量塞進這 2 行。
 *
 * 終止條件：
 * - 內容塞得下 → 停
 * - 字級已到下限 → 停（line-clamp 末尾用 ... 截）
 */
export function useAutoFitText(
  text: string,
  baseSize: number,
  minSize: number,
  step = 0.5,
) {
  const ref = useRef<HTMLElement | null>(null);
  const [size, setSize] = useState(baseSize);

  // 文字或基準變動 → 從基準重新開始試
  useLayoutEffect(() => {
    setSize(baseSize);
  }, [text, baseSize]);

  // 每次 render 後測量是否仍溢出
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const overflowing = el.scrollHeight > el.clientHeight + 1;
    if (overflowing && size > minSize) {
      setSize((prev) => Math.max(minSize, prev - step));
    }
  });

  return { ref, size };
}
