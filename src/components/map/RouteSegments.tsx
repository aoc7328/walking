import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import type { DayPlan } from '../../types/trip';
import {
  useRoutePreviewStore,
  routeKey,
  type RouteEntry,
} from '../../stores/routePreviewStore';

/**
 * 把一天裡每兩個相鄰 item 之間畫一條 polyline。
 * - 如果 routePreviewStore 裡有對應的「實際路線」→ 用真實幾何
 * - 否則 → 兩點直線（fallback，等於以前的行為）
 *
 * 換交通工具會自動讓 key 變動 → 從 store 找不到 → 自動回到直線，
 * 直到使用者再按一次預覽。
 */
export default function RouteSegments({ day }: { day: DayPlan }) {
  const map = useMap();
  const routes = useRoutePreviewStore((s) => s.routes);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!map) return;
    // 先清空上一輪畫的線
    for (const p of polylinesRef.current) p.setMap(null);
    polylinesRef.current = [];

    if (day.items.length < 2) return;

    for (let i = 0; i < day.items.length - 1; i++) {
      const from = day.items[i]!;
      const to = day.items[i + 1]!;
      const leg = day.legs[i];
      const mode = leg?.mode ?? 'driving';
      const k = routeKey(from.id, to.id, mode);
      const entry: RouteEntry | undefined = routes[k];

      const path =
        entry?.status === 'ready'
          ? entry.path
          : [from.place.coordinates, to.place.coordinates];

      const isReal = entry?.status === 'ready';

      const poly = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#2C4A3D',
        strokeOpacity: isReal ? 1 : 0.55,
        strokeWeight: isReal ? 4 : 3,
        map,
      });
      polylinesRef.current.push(poly);
    }

    return () => {
      for (const p of polylinesRef.current) p.setMap(null);
      polylinesRef.current = [];
    };
  }, [map, day, routes]);

  return null;
}
