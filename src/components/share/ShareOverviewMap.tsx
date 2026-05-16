import { useEffect, useMemo, useRef } from 'react';
import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import type { ShareTrip } from '../../services/share';
import { useMapZoom, markerSizeFromZoom } from '../../hooks/useMapZoom';

/**
 * 分享頁面：整段行程的互動式總覽地圖。
 * 每天取「第一個有合法座標的非飯店點」當代表，連成路線。
 */
export default function ShareOverviewMap({ payload }: { payload: ShareTrip }) {
  const points = useMemo(() => {
    const out: { lat: number; lng: number; dayIndex: number }[] = [];
    for (let i = 0; i < payload.d.length; i++) {
      const day = payload.d[i]!;
      const pick =
        day.i.find((it) => !it.h && Number.isFinite(it.la) && Number.isFinite(it.lo)) ??
        day.i.find((it) => Number.isFinite(it.la) && Number.isFinite(it.lo));
      if (!pick) continue;
      out.push({ lat: pick.la, lng: pick.lo, dayIndex: i + 1 });
    }
    return out;
  }, [payload]);

  const center = useMemo(() => {
    if (points.length === 0) return { lat: 0, lng: 0 };
    return {
      lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
      lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
    };
  }, [points]);

  if (points.length === 0) {
    return <div className="tv-overview-empty">沒有可顯示的地點座標</div>;
  }

  return (
    <div className="tv-overview-map">
      <Map
        mapId="walking-share-overview"
        defaultCenter={center}
        defaultZoom={6}
        gestureHandling="greedy"
        disableDefaultUI={false}
        clickableIcons={false}
        style={{ width: '100%', height: '100%' }}
      >
        <FitToPoints points={points} />
        {points.map((p) => (
          <OverviewMarker key={p.dayIndex} lat={p.lat} lng={p.lng} dayIndex={p.dayIndex} />
        ))}
      </Map>
    </div>
  );
}

function OverviewMarker({ lat, lng, dayIndex }: { lat: number; lng: number; dayIndex: number }) {
  const zoom = useMapZoom();
  const label = String(dayIndex);
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
      map.fitBounds(bounds, 60);
    } else {
      map.panTo(points[0]!);
      map.setZoom(12);
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
