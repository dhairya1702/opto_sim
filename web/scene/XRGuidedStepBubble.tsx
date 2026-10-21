import { useEffect, useRef } from "react";
import { Group } from "three";
import { Box } from "./Models";
import { XRSign } from "./XRClinicPanels";

export function wrapGuidedStepLines(lines: readonly string[], maxCharacters = 44): string[] {
  return lines.flatMap(line => {
    const words = line.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const wrapped: string[] = [];
    let current = "";
    words.forEach(word => {
      const candidate = current ? `${current} ${word}` : word;
      if (current && candidate.length > maxCharacters) {
        wrapped.push(current);
        current = word;
      } else current = candidate;
    });
    if (current) wrapped.push(current);
    return wrapped;
  });
}

export function XRGuidedStepBubble({ stepId, title, lines }: {
  stepId: string;
  /** Retained for adapter compatibility; numbering and context are not displayed. */
  stepNumber?: number;
  total?: number;
  title: string;
  lines: readonly string[];
  context?: string;
  complete?: boolean;
}) {
  const root = useRef<Group | null>(null);
  useEffect(() => {
    root.current?.traverse(object => { object.raycast = () => undefined; });
  });
  const titleLines = wrapGuidedStepLines([title], 30);
  const wrappedLines = wrapGuidedStepLines(lines, 32);
  // XRSign places N rows in N+1 vertical intervals. Reserve a fixed height
  // per interval so short and long instructions keep the same glyph size.
  // These aspect ratios also avoid the renderer's 160px minimum squeezing
  // a shallow texture into a much wider physical strip.
  const titleHeight = (titleLines.length + 1) * .068;
  const bodyHeight = (wrappedLines.length + 1) * .060;
  const height = titleHeight + bodyHeight + .045;
  // Keep the lowered upper edge and centre the panel in the clear rear-wall
  // space; the left side is occupied by the eye chart.
  return <group ref={root} position={[.05, 2.20, -2.46]}
    userData={{ xrGuidedStepBubble: true, xrIgnoreRay: true, guidedStepId: stepId }}>
    <Box p={[0, -height / 2, 0]} s={[.98, height, .022]} c="#d7e3dd" radius={.025} />
    <Box p={[0, -height / 2, .014]} s={[.96, height - .02, .012]} c="#fbf7ee" radius={.02} />
    <XRSign transparentBackground text={titleLines} p={[0, -.015 - titleHeight / 2, .024]}
      size={[.86, titleHeight]} fg="#294b4c" />
    <XRSign transparentBackground text={wrappedLines} p={[0, -.030 - titleHeight - bodyHeight / 2, .024]}
      size={[.86, bodyHeight]} fg="#294b4c" />
  </group>;
}
