import { useEffect, useState } from 'react';

const SCROLL_SEL = '.ledger-page-body';

/** 右下角浮動「回到頂部」鈕：捲動超過一段距離才出現，點了把帳本內容捲回頂部。 */
export function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = document.querySelector(SCROLL_SEL);
    if (!el) return;
    const onScroll = () => setShow(el.scrollTop > 200);
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      className="led-fab"
      title="回到頂部"
      aria-label="回到頂部"
      onClick={() => document.querySelector(SCROLL_SEL)?.scrollTo({ top: 0, behavior: 'smooth' })}
    >↑</button>
  );
}

/** 左側浮動區段導覽：點了跳到對應區段。items 是 [{id,label}]。 */
export function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <nav className="led-sidenav" aria-label="區段導覽">
      {items.map((s) => (
        <button key={s.id} onClick={() => jump(s.id)}>{s.label}</button>
      ))}
    </nav>
  );
}
