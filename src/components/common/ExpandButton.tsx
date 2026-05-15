interface Props {
  onClick: () => void;
  position: 'search' | 'left' | 'right' | 'day';
  title?: string;
  icon: string;
}

export default function ExpandButton({ onClick, position, title, icon }: Props) {
  return (
    <button className={`expand-btn expand-${position}`} onClick={onClick} title={title}>
      {icon}
    </button>
  );
}
