interface Props {
  onClick: () => void;
  title?: string;
  icon: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function CollapseToggle({ onClick, title, icon, className = '', style }: Props) {
  return (
    <button className={`collapse-toggle ${className}`.trim()} onClick={onClick} title={title} style={style}>
      {icon}
    </button>
  );
}
