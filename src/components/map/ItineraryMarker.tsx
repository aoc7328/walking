import { AdvancedMarker } from '@vis.gl/react-google-maps';
import type { LatLng } from '../../utils/geo';
import { useUIStore } from '../../stores/uiStore';
import { useMapZoom, markerSizeFromZoom } from '../../hooks/useMapZoom';

interface Props {
  position: LatLng;
  label: string;
  placeId: string;
}

/**
 * 單一行程點 marker。深湖綠圓 + 白邊 + 白色數字。
 * 大小隨地圖 zoom level 變化（見 useMapZoom）。不分飯店、不分起終點，
 * 統一視覺。
 */
export default function ItineraryMarker({ position, label, placeId }: Props) {
  const openDetail = useUIStore((s) => s.openDetail);
  const zoom = useMapZoom();
  const twoDigit = label.length >= 2;
  const { size, fontSize } = markerSizeFromZoom(zoom, twoDigit);

  return (
    <AdvancedMarker position={position} onClick={() => openDetail(placeId, 'itinerary')}>
      <div
        className="map-marker"
        style={{ width: size, height: size }}
      >
        <span className="map-marker-num" style={{ fontSize }}>
          {label}
        </span>
      </div>
    </AdvancedMarker>
  );
}
