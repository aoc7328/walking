import { useEffect, useMemo, useRef } from 'react';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { useTripStore } from '../../stores/tripStore';
import { useUIStore } from '../../stores/uiStore';
import { useSearchStore } from '../../stores/searchStore';
import { hasApiKey } from '../../services/googleMaps';
import ItineraryMarker from './ItineraryMarker';
import SearchMarker from './SearchMarker';
import RouteLine from './RouteLine';
import type { LatLng } from '../../utils/geo';

const DEFAULT_CENTER = { lat: 23.97, lng: 120.97 };
const DEFAULT_ZOOM = 8;
const MAP_ID = 'walking-default-map';

// 子元件：用 useMap 在天切換時 panTo / fitBounds，但不阻止使用者拖曳
function MapAutoCenter({ targetCenter, points }: { targetCenter: LatLng; points: LatLng[] }) {
  const map = useMap();
  const lastKeyRef = useRef<string>('');

  useEffect(() => {
    if (!map) return;
    // 用「點集合」當切換訊號：點不一樣才動鏡頭
    const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    if (points.length >= 2) {
      const bounds = new google.maps.LatLngBounds();
      for (const p of points) bounds.extend(p);
      map.fitBounds(bounds, 60);
    } else if (points.length === 1) {
      map.panTo(points[0]!);
      map.setZoom(14);
    } else {
      map.panTo(targetCenter);
    }
  }, [map, points, targetCenter]);

  return null;
}

export default function MapView() {
  const trip = useTripStore((s) => s.trip);
  const currentDayId = useUIStore((s) => s.currentDayId);
  const searchResults = useSearchStore((s) => s.results);

  const day = trip?.days.find((d) => d.id === currentDayId) ?? null;

  const itineraryPath = useMemo(() => {
    if (!day) return [];
    return day.items.map((it) => it.place.coordinates);
  }, [day]);

  const center = useMemo(() => {
    if (itineraryPath.length === 0) {
      if (searchResults.length > 0) return searchResults[0]!.coordinates;
      return DEFAULT_CENTER;
    }
    const sumLat = itineraryPath.reduce((acc, p) => acc + p.lat, 0);
    const sumLng = itineraryPath.reduce((acc, p) => acc + p.lng, 0);
    return { lat: sumLat / itineraryPath.length, lng: sumLng / itineraryPath.length };
  }, [itineraryPath, searchResults]);

  if (!hasApiKey()) {
    return (
      <>
        <div className="map-bg" />
        <div className="map-placeholder-msg">
          請在 <code style={{ background: 'var(--bg-soft)', padding: '0 4px', borderRadius: 2 }}>.env.local</code>
          <br />
          設定 <code style={{ background: 'var(--bg-soft)', padding: '0 4px', borderRadius: 2 }}>VITE_GOOGLE_MAPS_API_KEY</code>
        </div>
      </>
    );
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

  // 計算第一個和最後一個飯店 item 的 id，給 marker label 用
  let firstHotelId: string | null = null;
  let lastHotelId: string | null = null;
  if (day) {
    for (let i = 0; i < day.items.length; i++) {
      if (day.items[i]!.isHotel) {
        firstHotelId = day.items[i]!.id;
        break;
      }
    }
    for (let i = day.items.length - 1; i >= 0; i--) {
      if (day.items[i]!.isHotel) {
        lastHotelId = day.items[i]!.id;
        break;
      }
    }
  }

  let nonHotelCount = 0;
  return (
    <APIProvider apiKey={apiKey} language="zh-TW" region="TW" libraries={['places', 'marker']}>
      <Map
        mapId={MAP_ID}
        defaultCenter={center}
        defaultZoom={day ? 11 : DEFAULT_ZOOM}
        gestureHandling="greedy"
        disableDefaultUI={false}
        style={{ width: '100%', height: '100%' }}
      >
        <MapAutoCenter targetCenter={center} points={itineraryPath} />
        {day &&
          day.items.map((it) => {
            let label: string;
            if (it.isHotel) {
              if (it.id === firstHotelId) label = 'S';
              else if (it.id === lastHotelId) label = 'E';
              else label = 'H';
            } else {
              nonHotelCount += 1;
              label = String(nonHotelCount);
            }
            return (
              <ItineraryMarker
                key={it.id}
                position={it.place.coordinates}
                label={label}
                isHotel={it.isHotel}
                placeId={it.place.placeId}
              />
            );
          })}
        {searchResults.map((p) => (
          <SearchMarker key={p.id} position={p.coordinates} placeId={p.placeId} />
        ))}
        {itineraryPath.length >= 2 && <RouteLine path={itineraryPath} />}
      </Map>
    </APIProvider>
  );
}
