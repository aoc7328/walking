import { useRef, useState } from 'react';
import type { DayMark } from '../../types/trip';
import { useTripStore } from '../../stores/tripStore';
import { MARK_GLYPHS, MARK_COLORS, markName } from '../../data/markPalette';
import AnchoredPopover from '../common/AnchoredPopover';

interface Props {
  dayId: string;
  dayIndex: number;
  marks: DayMark[];
}

/** 日期卡右上角的標記鈕：顯示已蓋的符號，點開可挑顏色＋形狀蓋上 / 移除。 */
export default function DayMarkButton({ dayId, dayIndex, marks }: Props) {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState<string>(MARK_COLORS[0]!.color);
  const btnRef = useRef<HTMLButtonElement>(null);
  const toggleDayMark = useTripStore((s) => s.toggleDayMark);

  const hasMarks = marks.length > 0;
  const applied = (glyph: string, c: string) =>
    marks.some((m) => m.glyph === glyph && m.color === c);

  // 攔下事件，避免觸發日期卡的「選取當天 / 拖曳排序」
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`day-tab-mark-btn${hasMarks ? ' has-marks' : ''}${open ? ' open' : ''}`}
        title={hasMarks ? '編輯這天的標記' : '加上標記'}
        onPointerDown={stop}
        onClick={(e) => {
          stop(e);
          setOpen((v) => !v);
        }}
      >
        {hasMarks ? (
          <>
            {marks.slice(0, 4).map((m, i) => (
              <span key={i} className="day-mark" style={{ color: m.color }}>
                {m.glyph}
              </span>
            ))}
            {marks.length > 4 && <span className="day-tab-mark-more">+{marks.length - 4}</span>}
          </>
        ) : (
          <span className="day-tab-mark-add">＋</span>
        )}
      </button>

      <AnchoredPopover
        anchor={btnRef.current}
        open={open}
        onClose={() => setOpen(false)}
        align="end"
        className="mark-picker"
      >
        <div className="mark-picker-head">Day {dayIndex}　標記</div>

        <div className="mark-picker-section-label">顏色</div>
        <div className="mark-color-row">
          {MARK_COLORS.map((c) => (
            <button
              key={c.color}
              type="button"
              className={`mark-color-swatch${color === c.color ? ' active' : ''}`}
              style={{ background: c.color }}
              title={c.name}
              onClick={() => setColor(c.color)}
            />
          ))}
        </div>

        <div className="mark-picker-section-label">符號（點一下蓋上，再點一下移除）</div>
        <div className="mark-glyph-row">
          {MARK_GLYPHS.map((g) => {
            const on = applied(g.glyph, color);
            return (
              <button
                key={g.glyph}
                type="button"
                className={`mark-glyph-cell${on ? ' applied' : ''}`}
                style={{ color }}
                title={`${markName(g.glyph, color)}${on ? '（已蓋上，點擊移除）' : ''}`}
                onClick={() => toggleDayMark(dayId, { glyph: g.glyph, color })}
              >
                {g.glyph}
              </button>
            );
          })}
        </div>

        {hasMarks && (
          <>
            <div className="mark-picker-section-label">這天目前的標記</div>
            <div className="mark-current-row">
              {marks.map((m, i) => (
                <button
                  key={i}
                  type="button"
                  className="mark-current-chip"
                  title={`${markName(m.glyph, m.color)} · 點擊移除`}
                  onClick={() => toggleDayMark(dayId, m)}
                >
                  <span className="day-mark" style={{ color: m.color }}>
                    {m.glyph}
                  </span>
                  <span className="mark-current-x">×</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="mark-picker-foot">想說明符號代表什麼？點工具列的「圖例」填寫。</div>
      </AnchoredPopover>
    </>
  );
}
