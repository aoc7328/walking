import { useEffect, useState, type ReactNode } from 'react';

/**
 * 手機版的可收合區塊。
 *
 * 東西一多就變成一直捲，所以預設收起來，點標題才展開。兩個設計重點：
 * - 開合狀態記在 localStorage：切分頁、關掉重開都還是你上次留下的樣子，
 *   不用每次進來重按一遍。
 * - 收起來時標題列仍會顯示「今天」之類的提示，才不會把當天要用的東西藏掉。
 */

interface Props {
  /** 記住開合狀態用的鍵，跨區塊要唯一。 */
  id: string;
  title: string;
  /** 標題右邊的筆數（或任何短字串）。 */
  count?: number | string;
  /** 沒有存過偏好時的預設；呼叫端通常用「這區有沒有今天的東西」來決定。 */
  defaultOpen?: boolean;
  /** 收起時仍要顯示的提醒，例如「今天 1」。 */
  badge?: string;
  /**
   * 外部要求展開（例：從行程點訂位燈號跳過來，那一區一定要是開的）。
   * 只在這個值變 true 的當下打開，之後使用者還是可以自己收起來。
   */
  forceOpen?: boolean;
  children: ReactNode;
}

function prefKey(id: string): string {
  return `walking.mvSection.${id}`;
}

function readPref(id: string): boolean | null {
  try {
    const v = localStorage.getItem(prefKey(id));
    return v === '1' ? true : v === '0' ? false : null;
  } catch {
    return null;
  }
}

export default function MobileSection({ id, title, count, defaultOpen = false, badge, forceOpen, children }: Props) {
  const [open, setOpen] = useState<boolean>(() => readPref(id) ?? defaultOpen);

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  function toggle() {
    setOpen((v) => {
      const next = !v;
      try {
        localStorage.setItem(prefKey(id), next ? '1' : '0');
      } catch {
        // 無痕模式：這次還是能開合，只是不記得
      }
      return next;
    });
  }

  return (
    <section className="mv-sec">
      <button
        type="button"
        className={`mv-sec-head${open ? ' open' : ''}`}
        onClick={toggle}
        aria-expanded={open}
      >
        <span className="mv-sec-caret" aria-hidden>
          ›
        </span>
        <span className="mv-sec-title">{title}</span>
        {count !== undefined && <span className="mv-sec-count">{count}</span>}
        {badge && <span className="mv-sec-badge">{badge}</span>}
      </button>
      {open && <div className="mv-sec-body">{children}</div>}
    </section>
  );
}
