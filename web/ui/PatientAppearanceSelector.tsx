import { useEffect, useId, useRef, useState } from "react";
import { setPatientAppearance, usePatientAppearance } from "../interaction/patientAppearance";

/** Select before scene creation so controller discovery and attempts stay stable. */
export function PatientAppearanceSelector({ onLoading }: { onLoading?: (loading: boolean) => void }) {
  const selected = usePatientAppearance();
  const fieldId = useId();
  const [loading, setLoading] = useState(false), [error, setError] = useState("");
  const request = useRef(0);
  const deadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => { request.current += 1; clearTimeout(deadline.current); onLoading?.(false); }, [onLoading]);
  const choose = async (value: string) => {
    const id = ++request.current; clearTimeout(deadline.current); setError("");
    if (value === "current") { setPatientAppearance("current"); setLoading(false); onLoading?.(false); return; }
    setLoading(true); onLoading?.(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        import("../scene/DetailedPatient").then(module => module.preloadDetailedPatient()),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Loading timed out")), 35000);
          deadline.current = timer;
        }),
      ]);
      if (request.current === id) setPatientAppearance("detailed");
    } catch { if (request.current === id) setError("The new patient could not load. Your previous patient is still selected. Retry or use the current patient."); }
    finally { clearTimeout(timer); if (request.current === id) { setLoading(false); onLoading?.(false); } }
  };
  return <section className="patient-appearance-selector" aria-label="Patient model">
    <label className="eyebrow" htmlFor={fieldId}>3 · PATIENT</label>
    <select id={fieldId} value={loading ? "detailed" : selected} onChange={event => void choose(event.target.value)}>
      <option value="current">Current patient</option><option value="detailed">New detailed patient (experimental)</option>
    </select>
    <p role="status">{loading ? "Loading the new patient…" : selected === "detailed" ? "Ready — new patient selected for the shared desktop / VR clinic." : "Current patient selected."}</p>
    <p>Experimental preview. Reload restores the current patient.</p>
    {error && <><p role="alert">{error}</p>
      <button type="button" className="secondary" onClick={() => void choose("detailed")}>Retry loading patient</button>
      <button type="button" className="secondary" onClick={() => void choose("current")}>Use current patient</button>
    </>}
  </section>;
}
