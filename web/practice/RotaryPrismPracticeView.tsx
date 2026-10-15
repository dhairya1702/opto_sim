import type { CSSProperties } from "react";

export type RotaryPrismOrientation = "BI" | "BU" | "BO" | "BD";
export type RotaryPrismEyeState = Readonly<{
  broken: boolean;
  OD: Readonly<{ x: number; y: number }>;
  OS: Readonly<{ x: number; y: number }>;
}>;

export function RotaryPrismPracticeView({ power, orientation, eyeState, highlightAperture, highlightDial, targetLabel }: {
  power: number; orientation: RotaryPrismOrientation; eyeState: RotaryPrismEyeState;
  highlightAperture: boolean; highlightDial: boolean; targetLabel: string;
}) {
  const ticks = Array.from({ length: 31 }, (_, value) => value);
  const eyeStyle = { "--fusional-od-x": eyeState.OD.x, "--fusional-od-y": eyeState.OD.y,
    "--fusional-os-x": eyeState.OS.x, "--fusional-os-y": eyeState.OS.y } as CSSProperties;
  return <div className="fusional-room" aria-hidden="true">
    <div className="fusional-mirror-target"><span>E</span><small>{targetLabel}</small></div>
    <div className="fusional-patient">
      <div className="fusional-eyes" style={eyeStyle}><span><i /></span><span><i /></span></div>
      <small>ARUN · ILLUSTRATIVE {eyeState.broken ? `${orientation} BREAKDOWN` : "FUSIONAL RESPONSE"}</small>
    </div>
    <div className={`rotary-prism-visual ${orientation.toLowerCase()} ${highlightAperture ? "highlight-aperture" : ""}`}>
      <div className="rotary-prism-aperture"><i /><b>{orientation}</b>
        <span className="rotary-base-mark mark-bi">BI</span><span className="rotary-base-mark mark-bu">BU</span>
        <span className="rotary-base-mark mark-bo">BO</span><span className="rotary-base-mark mark-bd">BD</span>
      </div>
      <div className={`rotary-prism-dial ${highlightDial ? "highlight-dial" : ""}`}>
        {ticks.map(value => <i key={value} className={value % 5 === 0 ? "major" : ""}
          style={{ "--tick-angle": `${value / 30 * 270}deg`, "--tick-counter-angle": `${-value / 30 * 270}deg` } as CSSProperties}><b>{value}</b></i>)}
        <span className="rotary-prism-pointer" style={{ transform: `rotate(${power / 30 * 270}deg)` }} />
        <strong>{power.toFixed(1)}Δ</strong>
      </div>
      <div className="rotary-prism-grip" />
    </div>
  </div>;
}
