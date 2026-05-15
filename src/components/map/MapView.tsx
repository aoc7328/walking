import { useMemo } from 'react';
import { APIProvider, Map } from '@vis.gl/react-google-maps';
import { useTripStore } from '../../stores/tripStore';
import { useUIStore } from '../../stores/uiStore';
import { useSearchStore } from '../../stores/searchStore';
import { hasApiKey } from '../../services/googleMaps';
import ItineraryMarker from './ItineraryMarker';
import SearchMarker from './SearchMarker';
import RouteLine from './RouteLine';

const DEFAULT_CENTER = { lat: 23.97, lng: 120.97 };
const DEFAULT_ZOOM = 8;
const MAP_ID = 'walking-default-map';

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

  let nonHotelCount = 0;
  return (
    <APIProvider apiKey={apiKey} language="zh-TW" region="TW">
      <Map
        mapId={MAP_ID}
        defaultCenter={center}
        defaultZoom={day ? 11 : DEFAULT_ZOOM}
        center={center}
        zoom={undefined}
        gestureHandling="greedy"
        disableDefaultUI={false}
        style={{ width: '100%', height: '100%' }}
      >
        {day &&
          day.items.map((it) => {
            if (!it.isHotel) nonHotelCount += 1;
            const label = it.isHotel ? 'H' : String(nonHotelCount);
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
