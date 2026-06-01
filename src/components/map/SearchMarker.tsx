import { AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import type { LatLng } from '../../utils/geo';
import { useUIStore } from '../../stores/uiStore';

interface Props {
  position: LatLng;
  placeId: string;
}

export default function SearchMarker({ position, placeId }: Props) {
  const openDetail = useUIStore((s) => s.openDetail);
  return (
    <AdvancedMarker
      position={position}
      title="點看地點詳細 / 加入行程"
      onClick={() => openDetail(placeId, 'search')}
    >
      {/* Google 樣式的水滴圖釘：尖端對準地點精確位置，比原本的大圓點好辨識、佔位也小 */}
      <Pin background="#D85A30" borderColor="#A8431F" glyphColor="#FFF4EC" />
    </AdvancedMarker>
  );
}
