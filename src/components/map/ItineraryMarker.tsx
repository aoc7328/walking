import { AdvancedMarker } from '@vis.gl/react-google-maps';
import type { LatLng } from '../../utils/geo';
import { useUIStore } from '../../stores/uiStore';

interface Props {
  position: LatLng;
  label: string;
  placeId: string;
}

export default function ItineraryMarker({ position, label, placeId }: Props) {
  const openDetail = useUIStore((s) => s.openDetail);

  return (
    <AdvancedMarker position={position} onClick={() => openDetail(placeId, 'itinerary')}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'var(--accent-primary)',
          border: '2px solid white',
          color: 'white',
          fontFamily: 'var(--font-display)',
          fontSize: 17,
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          cursor: 'pointer',
        }}
      >
        {label}
      </div>
    </AdvancedMarker>
  );
}
