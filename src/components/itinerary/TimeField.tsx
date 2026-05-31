import { useEffect, useRef, useState } from 'react';

interface Props {
  /** 目前正規值（HH:MM）；外部一變動就同步回顯示 */
  value: string;
  /**
   * 送出處理：參數是使用者輸入的純數字字串（已去掉冒號）。
   * 回傳 null = 成功套用；回傳字串 = 拒絕，並把該字串當錯誤訊息顯示。
   */
  onCommit: (digits: string) => string | null;
  /** Enter 且成功套用後呼叫（例如：收起設定面板） */
  onEnterApplied?: () => void;
  placeholder?: string;
  title?: string;
  ariaLabel?: string;
}

/** 只留數字、最多 4 位，第 2 位之後補冒號 → 邊打邊變成 HH:MM（例：1541 → 15:41） */
function liveFormat(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

/**
 * 時間輸入框：免打冒號（自動補）、Enter 套用、格式/邏輯防呆。
 * 解析與防呆規則由父層的 onCommit 決定，這裡只管輸入體驗與錯誤呈現。
 */
export default function TimeField({
  value,
  onCommit,
  onEnterApplied,
  placeholder,
  title,
  ariaLabel,
}: Props) {
  const [text, setText] = useState(value);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // value 變動（套用成功 / 行程連動重算）→ 同步顯示並清掉錯誤
  useEffect(() => {
    setText(value);
    setErr(null);
  }, [value]);

  const digits = () => text.replace(/\D/g, '');

  // 送出。fromEnter=true：失敗就保留輸入＋紅框讓使用者改；
  // 失焦(blur)失敗：默默還原成最後的正規值，不打擾。
  function commit(fromEnter: boolean): boolean {
    const message = onCommit(digits());
    if (message) {
      if (fromEnter) setErr(message);
      else {
        setText(value);
        setErr(null);
      }
      return false;
    }
    setErr(null);
    return true;
  }

  return (
    <span className="time-field">
      <input
        ref={inputRef}
        className={`item-duration-input${err ? ' error' : ''}`}
        type="text"
        inputMode="numeric"
        maxLength={5}
        placeholder={placeholder}
        title={title}
        aria-label={ariaLabel}
        value={text}
        onChange={(e) => {
          setText(liveFormat(e.target.value));
          if (err) setErr(null);
        }}
        onBlur={() => commit(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (commit(true)) onEnterApplied?.();
          } else if (e.key === 'Escape') {
            setText(value);
            setErr(null);
            inputRef.current?.blur();
          }
        }}
        onClick={(e) => e.stopPropagation()}
      />
      {err && <span className="time-field-err">{err}</span>}
    </span>
  );
}
