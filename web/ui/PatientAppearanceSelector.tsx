import { useEffect, useRef, useState } from "react";
import { setPatientAppearance, usePatientAppearance } from "../interaction/patientAppearance";

/** Select before scene creation so controller discovery and attempts stay stable. */
export function PatientAppearanceSelector({ onLoading }: { onLoading?: (loading: boolean) => void }) {
  const selected = usePatientAppearance();
  const [loading, setLoading] = useState(false), [error, setError] = useState("");
  const request = useRef(0);
  useEffect(() => { onLoading?.(loading); }, [loading, onLoading]);
  useEffect(() => () => { request.current += 1; }, []);
  if (!import.meta.env.DEV) return null;
  const choose = async (value: string) => {
    const id = ++request.current; setError("");
    if (value === "current") { setPatientAppearance("current"); setLoading(false); return; }
    setLoading(true);
    try {
      const module = await import("../scene/DetailedPatient");
      await module.preloadDetailedPatient();
      if (request.current === id) setPatientAppearance("detailed");
    } catch { if (request.current === id) setError("The new patient could not load. The current patient is still selected. Try again."); }
    finally { if (request.current === id) setLoading(false); }
  };
  return <section className="patient-appearance-selector" aria-label="Development patient model">
    <label htmlFor="patient-appearance">Clinic patient · development preview</label>
    <select id="patient-appearance" value={loading ? "detailed" : selected} onChange={event => void choose(event.target.value)}>
      <option value="current">Current patient</option><option value="detailed">New detailed patient (experimental)</option>
    </select>
    <p role="status">{loading ? "Loading the new patient. Please wait before opening a mode…" : selected === "detailed" ? "Ready — new patient selected for the shared desktop / VR clinic." : "Current patient selected."}</p>
    <p>Choose before entering Practice or Test. Standalone examination illustrations keep their existing visuals. Reload restores the current patient.</p>
    {error && <p role="alert">{error}</p>}
  </section>;
}
