import { useEffect, useRef, useState } from 'react';

/**
 * Returns `value` delayed by `delay` ms, except on first render where it is
 * returned immediately.
 *
 * The pages previously pushed the search term *and* the page number through one
 * shared debounce, which meant a pagination click idled 320ms before the request
 * started, and every mount waited 320ms before fetching anything. Debouncing the
 * search term alone — and skipping the delay on mount — fixes both.
 */
export function useDebounced(value, delay = 320) {
  const [debounced, setDebounced] = useState(value);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return undefined; // initial load must not wait
    }
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t); // also cancels the pending timer on unmount
  }, [value, delay]);

  return debounced;
}
