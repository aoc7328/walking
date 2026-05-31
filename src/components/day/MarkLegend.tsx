import { useRef, useState } from 'react';
import { useTripStore } from '../../stores/tripStore';
import { markKey, markName } from '../../data/markPalette';
import AnchoredPopover from '../common/AnchoredPopover';

/** 工具列上的「圖例」鈕：列出所有用過的符號，讓使用者填寫每個符號代表的意思。 */
export default function MarkLegend() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const legend = useTripStore((s) => s.trip?.markLegend ?? []);
  const days = useTripStore((s) => s.trip?.days);
  const setMarkLabel = useTripStore((s) => s.setMarkLabel);
  const removeMark = useTripStore((s) => s.removeMark);

  function usageCount(glyph: string, color: string): number {
    if (!days) return 0;
    return days.reduce(
      (n, d) => n + (d.marks?.some((m) => m.glyph === glyph && m.color === color) ? 1 : 0),
      0,
    );
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`btn${open ? ' active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="標記符號的說明"
      >
        圖例{legend.length > 0 ? `（${legend.length}）` : ''}
      </button>

      <AnchoredPopover
        anchor={btnRef.current}
        open={open}
        onClose={() => setOpen(false)}
        align="end"
        className="mark-legend"
      >
        <div className="mark-legend-head">標記圖例</div>
        {legend.length === 0 ? (
          <div className="mark-legend-empty">
            還沒有任何標記。
            <br />
            點日期卡右上角的標記鈕，在某一天蓋上符號後，這裡就會出現可填說明的欄位。
          </div>
        ) : (
          <div className="mark-legend-list thin-scroll">
            {legend.map((e) => {
              const count = usageCount(e.glyph, e.color);
              return (
                <div key={markKey(e.glyph, e.color)} className="mark-legend-row">
                  <span className="day-mark mark-legend-glyph" style={{ color: e.color }}>
                    {e.glyph}
                  </span>
                  <input
                    className="mark-legend-input"
                    type="text"
                    value={e.label}
                    placeholder={`${markName(e.glyph, e.color)} 代表…`}
                    onChange={(ev) => setMarkLabel(e.glyph, e.color, ev.target.value)}
                  />
                  <span className="mark-legend-count" title="用在幾天">
                    {count} 天
                  </span>
                  <button
                    type="button"
                    className="mark-legend-del"
                    title="刪除這個符號（會從所有天一併移除）"
                    onClick={() => removeMark(e.glyph, e.color)}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="mark-legend-foot">說明會跟著行程一起儲存。</div>
      </AnchoredPopover>
    </>
  );
}
