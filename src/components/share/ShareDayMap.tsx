import { useEffect, useMemo, useRef } from 'react';
import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import type { ShareDay } from '../../services/share';
import { useMapZoom, markerSizeFromZoom } from '../../hooks/useMapZoom';

/**
 * 分享頁面：當天行程的互動式地圖。
 * 跟主 app 主地圖共用同一套 marker / polyline 視覺，徹底擺脫 Static Maps URL 的瑞典 bug。
 */
export default function ShareDayMap({ day }: { day: ShareDay }) {
  const points = useMemo(
    () =>
      day.i
        .map((it, idx) => ({ lat: it.la, lng: it.lo, label: String(idx + 1) }))
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
    [day],
  );

  const center = useMemo(() => {
    if (points.length === 0) return { lat: 0, lng: 0 };
    return {
      lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
      lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
    };
  }, [points]);

  if (points.length === 0) return null;

  return (
    <div className="tv-static-map">
      <Map
        mapId="walking-share-day"
        defaultCenter={center}
        defaultZoom={12}
        gestureHandling="greedy"
        disableDefaultUI={true}
        zoomControl={true}
        clickableIcons={false}
        style={{ width: '100%', height: '100%' }}
      >
        <FitToPoints points={points} />
        {points.map((p, idx) => (
          <DayMarker key={idx} lat={p.lat} lng={p.lng} label={p.label} />
        ))}
      </Map>
    </div>
  );
}

function DayMarker({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const zoom = useMapZoom();
  const { size, fontSize } = markerSizeFromZoom(zoom, label.length >= 2);
  return (
    <AdvancedMarker position={{ lat, lng }}>
      <div className="map-marker" style={{ width: size, height: size }}>
        <span className="map-marker-num" style={{ fontSize }}>
          {label}
        </span>
      </div>
    </AdvancedMarker>
  );
}

function FitToPoints({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();
  const polyRef = useRef<google.maps.Polyline | null>(null);
  const lastKey = useRef('');

  useEffect(() => {
    if (!map || points.length === 0) return;
    const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');
    if (key === lastKey.current) return;
    lastKey.current = key;
    if (points.length >= 2) {
      const bounds = new google.maps.LatLngBounds();
      for (const p of points) bounds.extend({ lat: p.lat, lng: p.lng });
      map.fitBounds(bounds, 40);
    } else {
      map.panTo(points[0]!);
      map.setZoom(14);
    }
  }, [map, points]);

  useEffect(() => {
    if (!map || points.length < 2) return;
    const poly = new google.maps.Polyline({
      path: points.map((p) => ({ lat: p.lat, lng: p.lng })),
      geodesic: true,
      strokeColor: '#2C4A3D',
      strokeOpacity: 0.9,
      strokeWeight: 3,
      map,
    });
    polyRef.current = poly;
    return () => {
      poly.setMap(null);
      polyRef.current = null;
    };
  }, [map, points]);

  return null;
}
