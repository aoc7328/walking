import type { TransportMode } from '../types/place';
import { loadGoogleMaps, hasApiKey } from './googleMaps';

interface LegResult {
  durationMinutes: number;
  distanceMeters: number;
}

interface LatLng {
  lat: number;
  lng: number;
}

const cache = new Map<string, LegResult>();
const inflight = new Map<string, Promise<LegResult | null>>();

function cacheKey(o: LatLng, d: LatLng, mode: TransportMode): string {
  return `${o.lat.toFixed(5)},${o.lng.toFixed(5)}|${d.lat.toFixed(5)},${d.lng.toFixed(5)}|${mode}`;
}

function getTravelMode(mode: TransportMode): google.maps.TravelMode {
  switch (mode) {
    case 'driving':
      return google.maps.TravelMode.DRIVING;
    case 'walking':
      return google.maps.TravelMode.WALKING;
    case 'transit':
      return google.maps.TravelMode.TRANSIT;
    case 'bicycling':
      return google.maps.TravelMode.BICYCLING;
  }
}

let service: google.maps.DirectionsService | null = null;
function getService(): google.maps.DirectionsService {
  if (!service) service = new google.maps.DirectionsService();
  return service;
}

export async function fetchLegDuration(
  origin: LatLng,
  destination: LatLng,
  mode: TransportMode,
): Promise<LegResult | null> {
  if (!hasApiKey()) return null;
  const key = cacheKey(origin, destination, mode);
  if (cache.has(key)) return cache.get(key)!;
  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async (): Promise<LegResult | null> => {
    try {
      await loadGoogleMaps();
      const svc = getService();
      const result = await svc.route({
        origin,
        destination,
        travelMode: getTravelMode(mode),
      });
      const leg = result.routes[0]?.legs[0];
      if (!leg || !leg.duration) return null;
      const value: LegResult = {
        durationMinutes: Math.max(1, Math.round(leg.duration.value / 60)),
        distanceMeters: leg.distance?.value ?? 0,
      };
      cache.set(key, value);
      return value;
    } catch (err) {
      console.warn('[walking] fetchLegDuration 失敗：', err);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, promise);
  return promise;
}
