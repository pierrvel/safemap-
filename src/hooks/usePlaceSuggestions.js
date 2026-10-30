import { useEffect, useState } from 'react';
import { searchPlaces } from '../utils/placeSearch';

const DEBOUNCE_MS = 300;
const MIN_LENGTH = 2;

/**
 * 입력하는 동안 장소 후보를 찾는다 (입력을 멈추고 0.3초 뒤 한 번만 호출)
 * status: 'idle' | 'loading' | 'done' | 'empty'
 */
export default function usePlaceSuggestions(keyword, bias) {
  const [state, setState] = useState({ query: '', results: [], status: 'idle' });
  const biasLat = bias?.lat;
  const biasLon = bias?.lon;

  useEffect(() => {
    const q = keyword.trim();
    if (q.length < MIN_LENGTH) {
      setState({ query: '', results: [], status: 'idle' });
      return undefined;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, status: 'loading' }));
    const timer = setTimeout(() => {
      searchPlaces(q, { lat: biasLat, lon: biasLon }).then((results) => {
        if (!cancelled) setState({ query: q, results, status: results.length ? 'done' : 'empty' });
      });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [keyword, biasLat, biasLon]);

  return state;
}
