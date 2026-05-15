import { useEffect, useState } from 'react';
import { hasApiKey, loadGoogleMaps } from '../services/googleMaps';

export function useGoogleMaps() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasApiKey()) {
      setError('未設定 VITE_GOOGLE_MAPS_API_KEY');
      return;
    }
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (!cancelled) setLoaded(true);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Google Maps 載入失敗');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { loaded, error };
}
