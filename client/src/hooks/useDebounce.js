import { useEffect, useState } from "react";

// Returns `value` delayed by `delay` ms of idle time.
//
// Used in the data grid to debounce the card-number search box — without
// this, every keystroke triggers a server round-trip. 350ms is the sweet
// spot between "feels responsive" and "doesn't fire on every keystroke".
export function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    // Each render schedules a new timer; the cleanup cancels the previous
    // one, so only the last change in a rapid burst actually commits.
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
