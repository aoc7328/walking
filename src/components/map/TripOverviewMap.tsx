import { useEffect, useMemo, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import type { Trip } from '../../types/trip';
import { hasApiKey } from '../../services/googleMaps';

export interface DayMarkerData {
  dayId: string;
  dayIndex: number;
  lat: number;
  lng: number;
}

/**
 * 取每天的「第一個非飯店點」座標當 day marker。
 * 全是飯店或只有飯店 → 取第一個。
 * 完全沒項目 → 跳過。
 */
export function computeDayMarkers(trip: Trip): DayMarkerData[] {
  const out: DayMarkerData[] = [];
  for (const day of trip.days) {
    const candidate = day.items.find((it) => !it.isHotel) ?? day.items[0];
    if (!candidate) continue;
    out.push({
      dayId: day.id,
      dayIndex: day.dayIndex,
      lat: candidate.place.coordinates.lat,
      lng: candidate.place.coordinates.lng,
    });
  }
  return out;
}

function FitBoundsAndRoute({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();
  const lineRef = useRef<google.maps.Polyline | null>(null);
  const lastKey = useRef<string>('');

  useEffect(() => {
    if (!map || points.length === 0) return;
    const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');
    if (key === lastKey.current) return;
    lastKey.current = key;

    if (points.length >= 2) {
      const bounds = new google.maps.LatLngBounds();
      for (const p of points) bounds.extend(p);
      map.fitBounds(bounds, 60);
    } else {
      map.panTo(points[0]!);
      map.setZoom(12);
    }
  }, [map, points]);

  useEffect(() => {
    if (!map || points.length < 2) return;
    const poly = new google.maps.Polyline({
      path: points,
      geodesic: true,
      strokeColor: '#2C4A3D',
      strokeOpacity: 0.9,
      strokeWeight: 3,
      map,
    });
    lineRef.current = poly;
    return () => {
      poly.setMap(null);
      lineRef.current = null;
    };
  }, [map, points]);

  return null;
}

interface Props {
  trip: Trip;
  onDayClick?: (dayId: string, dayIndex: number) => void;
}

const MAP_ID = 'walking-overview-map';

export default function TripOverviewMap({ trip, onDayClick }: Props) {
  const markers = useMemo(() => computeDayMarkers(trip), [trip]);
  const points = useMemo(() => markers.map((m) => ({ lat: m.lat, lng: m.lng })), [markers]);

  if (!hasApiKey()) {
    return (
      <div className="map-placeholder-msg">
        請設定 VITE_GOOGLE_MAPS_API_KEY
      </div>
    );
  }
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

  const center = points.length
    ? {
        lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
        lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
      }
    : { lat: 23.97, lng: 120.97 };

  return (
    <APIProvider apiKey={apiKey} language="zh-TW" region="TW" libraries={['places', 'marker']}>
      <Map
        mapId={MAP_ID}
        defaultCenter={center}
        defaultZoom={6}
        gestureHandling="greedy"
        disableDefaultUI={false}
        clickableIcons={false}
        style={{ width: '100%', height: '100%' }}
      >
        <FitBoundsAndRoute points={points} />
        {markers.map((m) => (
          <AdvancedMarker
            key={m.dayId}
            position={{ lat: m.lat, lng: m.lng }}
            onClick={() => onDayClick?.(m.dayId, m.dayIndex)}
          >
            <div className="overview-day-pill">
              Day {m.dayIndex}
            </div>
          </AdvancedMarker>
        ))}
      </Map>
    </APIProvider>
  );
}
