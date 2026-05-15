import type { Leg } from '../../types/trip';
import type { TransportMode } from '../../types/place';
import { TRANSPORT_LABEL, formatDuration } from '../../utils/format';

const MODES: TransportMode[] = ['driving', 'walking', 'transit', 'bicycling'];

export default function LegConnector({
  leg,
  onModeChange,
}: {
  leg: Leg;
  onModeChange?: (mode: TransportMode) => void;
}) {
  function cycle() {
    if (!onModeChange) return;
    const idx = MODES.indexOf(leg.mode);
    const next = MODES[(idx + 1) % MODES.length]!;
    onModeChange(next);
  }

  return (
    <div className="leg">
      <span className="leg-line" />
      <button className="leg-mode" onClick={cycle} title="點擊切換交通方式">
        {TRANSPORT_LABEL[leg.mode] ?? leg.mode}
      </button>
      <span className="leg-divider">·</span>
      <span>{formatDuration(leg.durationMinutes)}</span>
    </div>
  );
}
