import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /** 水平對齊錨點的哪一邊（預設靠右，往左展開） */
  align?: 'start' | 'center' | 'end';
  /** 與錨點之間的垂直間距 */
  gap?: number;
}

/**
 * 用 portal 掛在 <body> 的浮動小面板，定位到 anchor 元素附近。
 * 預設開在錨點「上方」（因為日程表在畫面最底部），上方放不下才翻到下方。
 * 會自動避免被父層的 overflow 裁切，並在外點 / ESC 時關閉。
 */
export default function AnchoredPopover({
  anchor,
  open,
  onClose,
  children,
  className,
  align = 'end',
  gap = 8,
}: Props) {
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor) {
      setPos(null);
      return;
    }
    function place() {
      if (!anchor) return;
      const a = anchor.getBoundingClientRect();
      const pop = popRef.current;
      const pw = pop?.offsetWidth ?? 260;
      const ph = pop?.offsetHeight ?? 200;
      const margin = 8;

      // 垂直：優先放上方
      let top = a.top - gap - ph;
      if (top < margin) {
        top = a.bottom + gap;
        if (top + ph > window.innerHeight - margin) {
          top = Math.max(margin, window.innerHeight - margin - ph);
        }
      }

      // 水平
      let left: number;
      if (align === 'start') left = a.left;
      else if (align === 'center') left = a.left + a.width / 2 - pw / 2;
      else left = a.right - pw;
      left = Math.min(Math.max(margin, left), window.innerWidth - margin - pw);

      setPos({ left, top });
    }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, anchor, align, gap]);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if (anchor?.contains(t)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    // 延遲一拍掛 pointerdown，避免「開啟當下那一次點擊」立刻被判定為外點
    const id = window.setTimeout(() => {
      document.addEventListener('pointerdown', onPointer, true);
    }, 0);
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, anchor, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      ref={popRef}
      className={`anchored-popover${className ? ' ' + className : ''}`}
      style={{
        position: 'fixed',
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        visibility: pos ? 'visible' : 'hidden',
      }}
      // 面板是 portal，但 React 事件仍會沿 JSX 樹冒泡到日期卡，
      // 這裡攔下來避免誤觸「選取當天 / 拖曳」。
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}
