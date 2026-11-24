import { useEffect, useState } from "react";

/* useState that is remembered in this browser (localStorage) under `key`:
   the Catalogues page's open tab and each catalogue's filters. A value
   that can't be read (or storage that can't be used) falls back to
   `initial`. */
const read = (key, initial) => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? initial : JSON.parse(raw);
  } catch {
    return initial;
  }
};

export default function useStoredState(key, initial) {
  const [value, setValue] = useState(() => read(key, initial));
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode or full: just not remembered */
    }
  }, [key, value]);
  return [value, setValue];
}
