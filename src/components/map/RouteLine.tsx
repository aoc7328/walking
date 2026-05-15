import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import type { LatLng } from '../../utils/geo';

export default function RouteLine({ path }: { path: LatLng[] }) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || path.length < 2) return;
    const poly = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#2C4A3D',
      strokeOpacity: 1,
      strokeWeight: 3,
      map,
    });
    polylineRef.current = poly;
    return () => {
      poly.setMap(null);
      polylineRef.current = null;
    };
  }, [map, path]);

  return null;
}
