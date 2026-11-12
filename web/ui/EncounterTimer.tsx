import { useEffect, useState } from "react";

export function useEncounterTime(startedAt: number | undefined, endedAt: number | undefined, active: boolean) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active || startedAt === undefined || endedAt !== undefined) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active, startedAt, endedAt]);
  const seconds = startedAt === undefined ? 0 : Math.max(0, Math.floor(((endedAt ?? now) - startedAt) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function EncounterTimer({ startedAt, endedAt, active }: { startedAt?: number; endedAt?: number; active: boolean }) {
  return <>{useEncounterTime(startedAt, endedAt, active)}</>;
}
