interface Props {
  iconEmoji?: string;
  onClick: () => void;
  size?: number;
}

/**
 * 地點圖示徽章：圓圈內顯示 emoji，未選時顯示虛線邊框 + 號。
 * 預設 28×28。emoji 用系統字型，自帶顏色。
 */
export default function PlaceIconBadge({ iconEmoji, onClick, size = 28 }: Props) {
  const selected = !!iconEmoji;
  return (
    <button
      type="button"
      className={`place-icon-badge${selected ? ' selected' : ''}`}
      style={{ width: size, height: size }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={selected ? '點擊更換圖示（或長按移除）' : '點擊選擇圖示'}
    >
      <span className="place-icon-badge-content">{selected ? iconEmoji : '+'}</span>
    </button>
  );
}
