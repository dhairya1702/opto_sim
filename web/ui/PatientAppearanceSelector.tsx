import { useEffect, useId, useRef, useState } from "react";
import { setPatientAppearance, usePatientAppearance } from "../interaction/patientAppearance";

/** Select before scene creation so controller discovery and attempts stay stable. */
export function PatientAppearanceSelector({ onLoading }: { onLoading?: (loading: boolean) => void }) {
  const selected = usePatientAppearance();
  const fieldId = useId();
  const [loading, setLoading] = useState(false), [error, setError] = useState("");
  const request = useRef(0);

  useEffect(() => () => { request.current += 1; onLoading?.(false); }, [onLoading]);
  const choose = async (value: string) => {
    const id = ++request.current; setError("");
    if (value === "current") { setPatientAppearance("current"); setLoading(false); onLoading?.(false); return; }
    setLoading(true); onLoading?.(true);
    try {
      const module = await import("../scene/DetailedPatient");
      await module.preloadDetailedPatient();
      if (request.current === id) setPatientAppearance("detailed");
    } catch { if (request.current === id) setError("The new patient could not load. The current patient is still selected. Try again."); }
    finally { if (request.current === id) { setLoading(false); onLoading?.(false); } }
  };
  return <section className="patient-appearance-selector" aria-label="Patient model">
    <label className="eyebrow" htmlFor={fieldId}>3 · PATIENT</label>
    <select id={fieldId} value={loading ? "detailed" : selected} onChange={event => void choose(event.target.value)}>
      <option value="current">Current patient</option><option value="detailed">New detailed patient (experimental)</option>
    </select>
    <p role="status">{loading ? "Loading the new patient…" : selected === "detailed" ? "Ready — new patient selected for the shared desktop / VR clinic." : "Current patient selected."}</p>
    <p>Experimental preview. Reload restores the current patient.</p>
    {error && <p role="alert">{error}</p>}
  </section>;
}
