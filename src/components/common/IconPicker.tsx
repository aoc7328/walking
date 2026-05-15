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

export default function IconPicker({ open, currentEmoji, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [activeKey, setActiveKey] = useState<string>(EMOJI_CATEGORIES[0]!.key);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveKey(EMOJI_CATEGORIES[0]!.key);
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

  const activeCat: EmojiCategory | undefined =
    EMOJI_CATEGORIES.find((c) => c.key === activeKey) ?? EMOJI_CATEGORIES[0];
  const items: EmojiItem[] = query.trim() ? filtered : (activeCat?.items ?? []);

  function handlePick(emoji: string) {
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
            {EMOJI_CATEGORIES.map((cat) => {
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
