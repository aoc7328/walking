import { AdvancedMarker } from '@vis.gl/react-google-maps';
import type { LatLng } from '../../utils/geo';
import { useUIStore } from '../../stores/uiStore';

interface Props {
  position: LatLng;
  placeId: string;
}

export default function SearchMarker({ position, placeId }: Props) {
  const openDetail = useUIStore((s) => s.openDetail);
  return (
    <AdvancedMarker position={position} onClick={() => openDetail(placeId, 'search')}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: 'white',
          border: '2.5px solid var(--accent-warm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: 'var(--accent-warm)',
          }}
        />
      </div>
    </AdvancedMarker>
  );
}
