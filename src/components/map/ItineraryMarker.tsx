import { AdvancedMarker } from '@vis.gl/react-google-maps';
import type { LatLng } from '../../utils/geo';
import { useUIStore } from '../../stores/uiStore';

interface Props {
  position: LatLng;
  label: string;
  isHotel: boolean;
  placeId: string;
}

export default function ItineraryMarker({ position, label, isHotel, placeId }: Props) {
  const openDetail = useUIStore((s) => s.openDetail);
  const color = isHotel ? 'var(--accent-purple)' : 'var(--accent-primary)';
  const size = isHotel ? 36 : 32;

  return (
    <AdvancedMarker position={position} onClick={() => openDetail(placeId, 'itinerary')}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: color,
          border: '2px solid white',
          color: 'white',
          fontFamily: 'var(--font-display)',
          fontSize: 13,
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
