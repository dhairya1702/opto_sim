import { useEffect, useRef } from "react";

type SessionLifetime = {
  generation?: { current: number };
  session: { current: XRSession | null };
  mounted: { current: boolean };
  closing: { current: boolean };
};
/** React effect setup; cleanup is also used for its development replay. */
export function openPracticeXRSessionLifetime({ session, mounted, closing, generation }: SessionLifetime) {
  mounted.current = true; closing.current = false;
  return () => {
    if (generation) generation.current++;
    mounted.current = false; closing.current = true;
    const current = session.current; session.current = null;
    void current?.end().catch(() => undefined);
  };
}

/** Session ownership survives renders, but each effect setup begins an open lifetime. */
export function usePracticeXRSessionLifetime() {
  const generation = useRef(0);
  const session = useRef<XRSession | null>(null);
  const mounted = useRef(false);
  const closing = useRef(false);
  useEffect(() => {
    // React StrictMode replays setup/cleanup/setup in development. The replayed
    // cleanup must not leave the mounted screen permanently refusing Enter VR.
    return openPracticeXRSessionLifetime({ session, mounted, closing, generation });
  }, []);
  return { session, mounted, closing, generation };
}
