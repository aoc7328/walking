import { useEffect, useMemo, useRef, useState } from 'react';
import { EMOJI_CATEGORIES, type EmojiCategory, type EmojiItem } from '../../data/emojiRegistry';

interface Props {
  open: boolean;
  currentEmoji?: string;
  onSelect: (emoji: string | null) => void;
  onClose: () => void;
}

interface FlatItem extends EmojiItem {
  categoryKey: string;
}

function buildFlatIndex(): FlatItem[] {
  const out: FlatItem[] = [];
  for (const cat of EMOJI_CATEGORIES) {
    for (const it of cat.items) {
      out.push({ ...it, categoryKey: cat.key });
    }
  }
  return out;
}

const FLAT_INDEX: FlatItem[] = buildFlatIndex();

/** emoji → 標籤（同一 emoji 出現在多個分類時取第一個，較具代表性）。 */
const LABEL_OF: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const f of FLAT_INDEX) if (!m.has(f.emoji)) m.set(f.emoji, f.label);
  return m;
})();

/** 「常用」分類：使用者選過的圖示自動進來（最近使用優先、去重、最多 10 個）。 */
const FAVORITES_KEY = 'favorites';
const RECENT_STORAGE_KEY = 'walking.recentIcons';
const RECENT_MAX = 10;

function getRecentEmojis(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

/** 把剛選的 emoji 推到最前面（去重、截到 10 個），寫回 localStorage 並回傳新清單。 */
function pushRecentEmoji(emoji: string): string[] {
  const next = [emoji, ...getRecentEmojis().filter((e) => e !== emoji)].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* localStorage 不可用（隱私模式/已滿）：忽略，不影響選取本身 */
  }
  return next;
}

export default function IconPicker({ open, currentEmoji, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>(() => getRecentEmojis());
  const [activeKey, setActiveKey] = useState<string>(EMOJI_CATEGORIES[0]!.key);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      // 每次打開都從 localStorage 重讀常用（多張卡片各有一個 picker，共用同一份清單）
      const rec = getRecentEmojis();
      setRecent(rec);
      // 有常用就預設停在「常用」，還沒有就停在第一個真正的分類
      setActiveKey(rec.length ? FAVORITES_KEY : EMOJI_CATEGORIES[0]!.key);
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filtered: FlatItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return FLAT_INDEX.filter((it) => it.label.toLowerCase().includes(q));
  }, [query]);

  if (!open) return null;

  // 「常用」分類永遠排在最前面；內容來自 recent（可能為空）。建構成本極低，不需 memo。
  const categories: EmojiCategory[] = [
    {
      key: FAVORITES_KEY,
      label: '常用',
      tabColor: '#C7952B',
      items: recent.map((e) => ({ emoji: e, label: LABEL_OF.get(e) ?? e })),
    },
    ...EMOJI_CATEGORIES,
  ];

  const activeCat: EmojiCategory | undefined =
    categories.find((c) => c.key === activeKey) ?? categories[0];
  const items: EmojiItem[] = query.trim() ? filtered : (activeCat?.items ?? []);

  function handlePick(emoji: string) {
    setRecent(pushRecentEmoji(emoji));
    onSelect(emoji);
    onClose();
  }

  function handleClear() {
    onSelect(null);
    onClose();
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="icon-picker" onClick={(e) => e.stopPropagation()}>
        <div className="icon-picker-search-row">
          <input
            ref={inputRef}
            className="icon-picker-search"
            type="text"
            placeholder="🔍 搜尋圖示（例如：咖啡、ATM）"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {!query.trim() && (
          <div className="icon-picker-tabs">
            {categories.map((cat) => {
              const isActive = cat.key === activeKey;
              return (
                <button
                  key={cat.key}
                  type="button"
                  className={`icon-picker-tab${isActive ? ' active' : ''}`}
                  style={isActive ? { color: cat.tabColor, borderBottomColor: cat.tabColor } : undefined}
                  onClick={() => setActiveKey(cat.key)}
                >
                  {cat.label}
                </button>
              );
            })}
            {currentEmoji && (
              <button
                type="button"
                className="icon-picker-tab icon-picker-tab-clear"
                onClick={handleClear}
                title="移除目前的圖示"
              >
                清空
              </button>
            )}
          </div>
        )}

        <div className="icon-picker-grid thin-scroll">
          {items.length === 0 && query.trim() && (
            <div className="icon-picker-empty">沒有符合「{query}」的圖示</div>
          )}
          {items.length === 0 && !query.trim() && activeKey === FAVORITES_KEY && (
            <div className="icon-picker-empty">還沒有常用圖示<br />你選過的圖示會自動出現在這裡（最多 10 個）</div>
          )}
          {items.map((it) => (
            <button
              key={it.emoji + it.label}
              type="button"
              className="icon-picker-cell"
              title={it.label}
              onClick={() => handlePick(it.emoji)}
            >
              <span className="icon-picker-emoji">{it.emoji}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
