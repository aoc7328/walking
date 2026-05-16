import { useEffect, useState } from 'react';
import { useMap } from '@vis.gl/react-google-maps';

/**
 * 監聽當前 Map 的 zoom level。
 * 主要用途：讓 marker 大小隨地圖縮放動態調整。
 */
export function useMapZoom(defaultZoom = 10): number {
  const map = useMap();
  const [zoom, setZoom] = useState<number>(defaultZoom);

  useEffect(() => {
    if (!map) return;
    const sync = () => {
      const z = map.getZoom();
      if (typeof z === 'number') setZoom(z);
    };
    const listener = map.addListener('zoom_changed', sync);
    sync();
    return () => listener.remove();
  }, [map]);

  return zoom;
}

/**
 * 根據 zoom level 給 marker 的尺寸與字級。
 * 對應 brief：zoom ≤8 最小、≥18 最大。
 */
export interface MarkerSize {
  size: number;
  fontSize: number;
}

export function markerSizeFromZoom(zoom: number, twoDigit = false): MarkerSize {
  let base: MarkerSize;
  if (zoom <= 8) base = { size: 16, fontSize: 9 };
  else if (zoom <= 11) base = { size: 20, fontSize: 11 };
  else if (zoom <= 14) base = { size: 22, fontSize: 12 };
  else if (zoom <= 17) base = { size: 26, fontSize: 13 };
  else base = { size: 30, fontSize: 14 };
  if (twoDigit) base.fontSize = Math.max(base.fontSize - 2, 9);
  return base;
}
