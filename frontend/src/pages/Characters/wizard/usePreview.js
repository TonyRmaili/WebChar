import { useEffect, useRef, useState } from "react";
import api from "../../../utils/api";

/* Ask the server what the wizard's picks add up to (POST /character/preview):
   every choice with its options and current pick, what's still open, the
   numbers, spells and gear. The builder's rules live in the backend only
   (app/builder), so the wizard never works them out itself.

   Waits until the picks have been still for a moment, and ignores an
   answer that arrives after a newer request went out.

   useServerPreview(payload, ask) is the same for any request: the
   sheet's level-up form asks POST /character/{id}/level/preview. */

const WAIT_MS = 300;

export function useServerPreview(payload, ask, enabled = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const latest = useRef(0);
  const askRef = useRef(ask);
  askRef.current = ask;
  const key = JSON.stringify(payload);

  useEffect(() => {
    if (!enabled) return undefined;
    const ticket = ++latest.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const answer = await askRef.current(payload);
        if (ticket === latest.current) {
          setData(answer);
          setError(null);
        }
      } catch (e) {
        if (ticket === latest.current) setError(e.message || "couldn't reach the server");
      } finally {
        if (ticket === latest.current) setLoading(false);
      }
    }, WAIT_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return { data, loading, error };
}

const askWizard = (payload) => api.post("/character/preview", payload);

export default function usePreview(payload) {
  return useServerPreview(payload, askWizard);
}
