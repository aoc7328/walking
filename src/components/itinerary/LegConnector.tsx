import { useCallback } from 'react';
import type { Leg } from '../../types/trip';
import type { TransportMode } from '../../types/place';
import type { LatLng } from '../../utils/geo';
import { TRANSPORT_LABEL, formatDuration } from '../../utils/format';
import { fetchDirectionsPath } from '../../services/directions';
import {
  useRoutePreviewStore,
  routeKey,
  type RouteEntry,
} from '../../stores/routePreviewStore';

const MODES: TransportMode[] = ['driving', 'walking', 'transit', 'bicycling'];

interface Props {
  leg: Leg;
  fromItemId: string;
  toItemId: string;
  fromCoord: LatLng;
  toCoord: LatLng;
  onModeChange?: (mode: TransportMode) => void;
}

export default function LegConnector({
  leg,
  fromItemId,
  toItemId,
  fromCoord,
  toCoord,
  onModeChange,
}: Props) {
  const key = routeKey(fromItemId, toItemId, leg.mode);
  const entry: RouteEntry | undefined = useRoutePreviewStore((s) => s.routes[key]);
  const setLoading = useRoutePreviewStore((s) => s.setLoading);
  const setReady = useRoutePreviewStore((s) => s.setReady);
  const setError = useRoutePreviewStore((s) => s.setError);

  function cycle() {
    if (!onModeChange) return;
    const idx = MODES.indexOf(leg.mode);
    const next = MODES[(idx + 1) % MODES.length]!;
    onModeChange(next);
  }

  const handlePreview = useCallback(async () => {
    // loading 中不重複觸發
    if (entry?.status === 'loading') return;
    setLoading(key);
    try {
      const path = await fetchDirectionsPath(fromCoord, toCoord, leg.mode);
      setReady(key, path);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(key, msg);
    }
  }, [entry?.status, key, fromCoord, toCoord, leg.mode, setLoading, setReady, setError]);

  const isLoading = entry?.status === 'loading';
  const isReady = entry?.status === 'ready';
  const isError = entry?.status === 'error';

  const previewClass = [
    'leg-preview',
    isLoading ? 'is-loading' : '',
    isReady ? 'is-ready' : '',
    isError ? 'is-error' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const previewTitle = isLoading
    ? '正在抓路線…'
    : isReady
    ? '已套用實際路線到地圖（點擊重抓）'
    : isError
    ? `失敗：${(entry as { error: string }).error}（點擊重試）`
    : '在地圖上預覽實際路線';

  return (
    <div className="leg">
      <span className="leg-line" />
      <button className="leg-mode" onClick={cycle} title="點擊切換交通方式">
        {TRANSPORT_LABEL[leg.mode] ?? leg.mode}
      </button>
      <span className="leg-divider">·</span>
      <span>{formatDuration(leg.durationMinutes)}</span>
      <button
        type="button"
        className={previewClass}
        onClick={handlePreview}
        title={previewTitle}
        aria-label={previewTitle}
      >
        {isLoading ? '⋯' : isReady ? '✓' : '🗺'}
      </button>
    </div>
  );
}
