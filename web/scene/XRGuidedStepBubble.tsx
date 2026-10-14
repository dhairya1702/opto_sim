import { useEffect, useRef } from "react";
import { Group } from "three";
import { Box } from "./Models";
import { XRSign } from "./XRClinicPanels";

export function XRGuidedStepBubble({ stepId, stepNumber, total, title, lines, complete = false }: {
  stepId: string;
  stepNumber: number;
  total: number;
  title: string;
  lines: readonly string[];
  complete?: boolean;
}) {
  const root = useRef<Group | null>(null);
  useEffect(() => {
    root.current?.traverse(object => { object.raycast = () => undefined; });
  });
  const accent = complete ? "#66ad98" : "#d5a95b";
  const badge = complete ? "#3f7568" : "#876c38";
  return <group ref={root} position={[-1.02, 1.84, -2.46]}
    userData={{ xrGuidedStepBubble: true, guidedStepId: stepId, guidedStepNumber: stepNumber }}>
    <Box p={[.38, -.316, -.004]} s={[.13, .13, .022]} c="#d7e3dd" r={[0, 0, Math.PI / 4]} radius={.018} />
    <Box p={[.38, -.297, .012]} s={[.09, .09, .016]} c="#fbf7ee" r={[0, 0, Math.PI / 4]} radius={.014} />
    <Box s={[1.36, .62, .026]} c="#d7e3dd" radius={.075} />
    <Box p={[0, 0, .016]} s={[1.31, .57, .018]} c="#fbf7ee" radius={.062} />
    <Box p={[-.624, 0, .034]} s={[.018, .43, .008]} c={accent} radius={.009} />
    <Box p={[-.405, .205, .035]} s={[.39, .064, .009]} c={badge} radius={.03} />
    <XRSign text={[complete ? "GUIDED · COMPLETE" : `GUIDED · STEP ${stepNumber} OF ${total}`]}
      p={[-.405, .205, .041]} size={[.355, .050]} bg={badge} fg="#fffaf1" />
    <XRSign text={[title]} p={[.035, .09, .041]} size={[1.08, .105]} bg="#fbf7ee" fg="#294b4c" />
    <XRSign text={[...lines]} p={[.035, -.075, .041]} size={[1.08, .19]} bg="#fbf7ee" fg="#45615f" />
    {Array.from({ length: total }, (_, index) => {
      const done = complete || index < stepNumber - 1;
      const current = !complete && index === stepNumber - 1;
      return <mesh key={index} position={[-.15 + index * .06, -.238, .042]}>
        <circleGeometry args={[current ? .013 : .010, 20]} />
        <meshBasicMaterial color={done ? "#66ad98" : current ? "#d5a95b" : "#c7d1cc"} />
      </mesh>;
    })}
  </group>;
}
