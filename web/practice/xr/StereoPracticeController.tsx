import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, Group } from "three";
import { useXRClinicRuntime, type XRClinicInterruption } from "../../interaction/useXRClinicRuntime";
import { consultationToolDefinition } from "../../interaction/xrConsultationTools";
import { sensoryEquipment, sensorySockets, isPatientFitted, sensoryFittingSignature } from "../../interaction/xrSensoryEquipment";
import { stereoPracticeLevels } from "../../interaction/stereoPractice";
import {
  confirmXRStereoReply, initialXRStereoRun, interruptXRStereoRun, nextXRStereoPage, requestXRStereoReply,
  resolveXRStereoReply, reviseXRStereoSetup, stereoCircleNames, stereoResponseDelayMs, xrStereoEntryCorrect, xrStereoGeometry,
  type XRStereoRun,
} from "../../interaction/xrStereoPractice";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { Box } from "../../scene/Models";
import { XRHeadPanel, XRPanelButton, XRSign } from "../../scene/XRClinicPanels";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonField } from "./PracticeLessonUI";

const equipment = sensoryEquipment("stereo"), sockets = sensorySockets("stereo");
const fields: LessonField[] = [{ id: "threshold", label: "Last correct threshold", choices: stereoPracticeLevels.map(level => [String(level), `${level} arcsec`]) }];
export function StereoPracticeController({ active, preview = false, onComplete, onExit, onMirror }: {
  active: boolean; preview?: boolean; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const lesson = usePracticeLesson(onComplete);
  const runRef = useRef(initialXRStereoRun());
  const [run, setRun] = useState(runRef.current);
  const [message, setMessage] = useState("");
  const [spatial, setSpatial] = useState({ ready: false, distanceCm: 0, correction: false, filters: false, facing: false });
  const alive = useRef(active && !preview);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fitSignature = useRef("");
  const clock = useRef(0);
  const pageRoot = useRef<Group>(null);
  const clearTimer = useCallback(() => { if (timer.current !== null) clearTimeout(timer.current); timer.current = null; }, []);
  const publish = useCallback((next: XRStereoRun) => {
    if (next === runRef.current) return;
    runRef.current = next; setRun(next);
  }, []);
  const interrupt = useCallback((reason: XRClinicInterruption = "procedure") => {
    // A/X is a usable response-entry route. Cancel a pending question on a menu edge,
    // while preserving returned reports and already confirmed pages for its controls.
    if (reason === "panel") {
      const current = runRef.current;
      if (current.pending) {
        clearTimer(); publish({ ...current, pending: null, generation: current.generation + 1 });
        setMessage("Question interrupted. Present this page again.");
      }
      if (!current.capture) lesson.clearPending(); return;
    }
    // A resting booklet is independent of the releasing hand's tracking; the frame's
    // supported pose check determines whether tracking actually invalidates geometry.
    if (reason === "tracking" || reason === "release") return;
    const next = interruptXRStereoRun(runRef.current);
    if (next === runRef.current) return;
    clearTimer(); publish(next); lesson.clearPending(); setMessage("Run interrupted. Present the first page again.");
  }, [clearTimer, publish, lesson.clearPending]);
  const runtime = useXRClinicRuntime({ active: active && !preview, equipment, placementSockets: sockets, editorOpen: lesson.mode !== "none",
    onInterrupt: interrupt, onMenu: open => lesson.setMode(open ? "menu" : "none"),
    onSelection: selection => { if (selection.station === "patient") lesson.setMode("menu"); },
  });
  const sample = () => {
    const correction = isPatientFitted(runtime.toolsRef.current, "subjective"), filters = isPatientFitted(runtime.toolsRef.current, "polarised");
    const pose = runtime.supportedWorkingPose("stereo", true);
    const geometry = pose ? xrStereoGeometry(pose.position, pose.forward) : { distanceCm: 0, facing: false, ready: false };
    return { ...geometry, correction, filters, ready: alive.current && runtime.frameValid.current && correction && filters && geometry.ready };
  };
  useFrame((_, dt) => {
    const object = runtime.objects.current.get("stereo");
    if (pageRoot.current) {
      pageRoot.current.visible = Boolean((active || preview) && object?.visible);
      if (object) { pageRoot.current.position.copy(object.position); pageRoot.current.quaternion.copy(object.quaternion); pageRoot.current.updateMatrixWorld(true); }
    }
    const now = sample();
    const signature = sensoryFittingSignature(runtime.toolsRef.current, ["subjective", "polarised"]);
    if (signature !== fitSignature.current) {
      fitSignature.current = signature; clearTimer(); publish(reviseXRStereoSetup(runRef.current)); lesson.clearPending(); setMessage("");
    } else if (!now.ready) interrupt("procedure");
    clock.current += dt;
    if (clock.current >= .1) {
      clock.current = 0;
      const view = { ...now, distanceCm: Math.round(now.distanceCm * 10) / 10 };
      setSpatial(previous => JSON.stringify(previous) === JSON.stringify(view) ? previous : view);
    }
  });
  const resetRun = useCallback(() => {
    clearTimer(); const previous = runRef.current;
    publish(initialXRStereoRun(previous.attempt + 1, previous.generation + 1, previous.setupRevision));
    lesson.reset(); setMessage("");
  }, [clearTimer, publish, lesson.reset]);
  const reset = useCallback(() => {
    resetRun(); runtime.resetClinic(); fitSignature.current = sensoryFittingSignature(runtime.toolsRef.current, ["subjective", "polarised"]);
  }, [resetRun, runtime.resetClinic]);
  useEffect(() => {
    alive.current = active && !preview;
    if (!active || preview) reset();
    return () => { alive.current = false; clearTimer(); };
  }, [active, preview, reset, clearTimer]);
  const present = () => {
    if (lesson.awarded.current) return;
    const next = requestXRStereoReply(runRef.current, sample().ready);
    if (next === runRef.current || !next.pending) return;
    publish(next); setMessage("");
    const token = next.pending;
    timer.current = setTimeout(() => {
      timer.current = null;
      publish(resolveXRStereoReply(runRef.current, token, sample().ready));
    }, stereoResponseDelayMs);
  };
  const confirm = (index: number) => {
    const now = sample(), current = runRef.current;
    if (lesson.awarded.current || !now.ready || !current.reply || current.confirmed) return;
    const next = confirmXRStereoReply(current, index, now.ready, now.distanceCm);
    if (next === current) { setMessage("Mark the circle the patient named, even when their identification is incorrect."); return; }
    publish(next); setMessage(current.reply.correct ? "Response entered: correct patient identification." : "Response entered: incorrect patient identification.");
  };
  const nextPage = () => {
    if (lesson.awarded.current) return;
    const next = nextXRStereoPage(runRef.current, sample().ready);
    if (next !== runRef.current) { publish(next); setMessage(""); }
  };
  const cancel = () => { if (lesson.awarded.current) return; resetRun(); lesson.setMode("none"); };
  const record = () => {
    const capture = runRef.current.capture, entry = lesson.entriesRef.current.threshold ?? "";
    const now = sample();
    const valid = alive.current && runtime.frameValid.current && now.correction && now.filters && Boolean(capture)
      && capture?.attempt === runRef.current.attempt && capture?.setupRevision === runRef.current.setupRevision
      && sensoryFittingSignature(runtime.toolsRef.current, ["subjective", "polarised"]) === fitSignature.current;
    const correct = xrStereoEntryCorrect(capture, entry);
    lesson.submit(valid && entry !== "", correct, correct ? `Stereopsis: ${entry} seconds of arc. Threshold recorded.`
      : "Record the last correct level before the two consecutive incorrect responses.");
  };
  const exit = () => { alive.current = false; reset(); onExit(); };
  const entryReady = Boolean(run.capture), ready = active && !preview && entryReady && spatial.correction && spatial.filters;
  const patientReport = run.reply ? `“The ${stereoCircleNames[run.reply.selected]} circle appears raised.”` : "No report yet.";
  const history = run.replies.map(reply => `${reply.level} arcsec · ${reply.correct ? "correct" : "incorrect"}`);
  const status = !spatial.correction ? "Fit the patient's near correction using the trial frame."
    : !spatial.filters ? "Fit polarised viewing glasses over the correction."
      : run.capture ? `Run captured · two consecutive incorrect responses. Responses: ${history.join("; ")}. Independently record last correct.`
        : !spatial.ready ? `${spatial.distanceCm} cm · face the booklet toward the patient within 38–42 cm.`
          : run.pending ? `${stereoPracticeLevels[run.page]} arcsec · let me look at the circles…`
            : run.reply ? `${stereoPracticeLevels[run.page]} arcsec · ${patientReport} ${message || (run.confirmed ? "Turn to the next page." : "Confirm the named circle.")}`
              : `${stereoPracticeLevels[run.page]} arcsec · present this page.${message ? " " + message : ""}`;
  const actions = [
    { label: "PRESENT PAGE / ASK", run: present, disabled: !spatial.ready || Boolean(run.pending || run.reply || run.capture) || lesson.recorded },
    { label: "NEXT PAGE", run: nextPage, disabled: !spatial.ready || !run.confirmed || Boolean(run.capture) || lesson.recorded },
    ...stereoCircleNames.map((name, index) => ({ label: `${name.toUpperCase()} CIRCLE`, run: () => confirm(index), disabled: !spatial.ready || !run.reply || run.confirmed || lesson.recorded })),
    { label: "PATIENT REPORT / RUN", run: () => lesson.setMode("settings") },
  ];
  useEffect(() => { onMirror?.({ title: "Stereopsis", reportLines: run.reply || history.length ? [patientReport, ...history] : [], status, ready, entryReady, fields, actions, lesson, reset, record, cancel }); },
    [onMirror, status, ready, entryReady, run, spatial.ready, lesson.mode, lesson.entries, lesson.feedback, lesson.recorded]);
  const reportPanel = <XRHeadPanel>
    <Box s={[.76, .88, .018]} c="#102329" radius={.012} />
    <XRSign text={["FICTIONAL PATIENT · REPORTED PERCEPT", patientReport, "Confirmed responses", ...(history.length ? history : ["None yet."]),
      "Illustrative report; no calibrated headset stereo stimulus."]} p={[0, .12, .012]} size={[.70, .56]} bg="#102329" fg="#eefbf7" />
    {stereoCircleNames.map((name, index) => <group key={name} position={[(index - 1) * .14, -.215, .027]}>
      <mesh position={[0, run.reply?.selected === index ? .025 : 0, 0]}><circleGeometry args={[.032, 24]} /><meshBasicMaterial color={run.reply?.selected === index ? "#94d3b6" : "#e8e2d4"} side={DoubleSide} /></mesh>
    </group>)}
    <XRPanelButton label="CLOSE REPORT" position={[-.18, -.34, .025]} width={.34} onClick={() => lesson.setMode("none")} />
    <XRPanelButton label="EXIT VR" position={[.18, -.34, .025]} width={.34} onClick={exit} />
  </XRHeadPanel>;
  const book = consultationToolDefinition("stereo");
  return <>
    <XRClinicRuntimeView runtime={runtime} active={active && !preview} preview={preview} sensoryStation="stereo" title="STEREOPSIS · PRACTICE" />
    <group ref={pageRoot} userData={{ xrInteractiveSurface: "stereo", xrToolControls: "stereo" }}>
      <group position={book.workingPoint} rotation={[0, Math.PI, 0]}>
        {Array.from({ length: stereoPracticeLevels.length - run.page }, (_, index) => <Box key={index} p={[index * .0008, index * -.0007, .003 - index * .0006]} s={[.23, .115, .0005]} c={index % 2 ? "#d9d3c3" : "#efeada"} />)}
        {/* Equal circles are the physical page. Only the separate reported-view illustration highlights one. */}
        <group key={run.page}>
          <XRSign text={[`PAGE ${run.page + 1} · ${stereoPracticeLevels[run.page]} arcsec`]} p={[0, .035, .008]} size={[.22, .027]} bg="#efeada" fg="#284b47" />
          {stereoCircleNames.map((name, index) => <group key={name} position={[(index - 1) * .07, -.01, .009]}>
            <mesh><circleGeometry args={[.024, 32]} /><meshBasicMaterial color="#f8f4e9" side={DoubleSide} /></mesh>
            <mesh position={[0, 0, .001]}><ringGeometry args={[.016, .019, 32]} /><meshBasicMaterial color="#2d5450" side={DoubleSide} /></mesh>
          </group>)}
        </group>
      </group>
      {/* Examiner-side response controls stay visible without turning the patient page away. */}
      <group position={book.workingPoint}>
        <Box p={[0, 0, .014]} s={[.23, .115, .001]} c="#efeada" />
        <XRSign text={[`PAGE ${run.page + 1} · ${stereoPracticeLevels[run.page]} arcsec`, "MARK PATIENT'S REPORTED CIRCLE"]} p={[0, .037, .016]} size={[.22, .032]} bg="#efeada" fg="#284b47" />
        {stereoCircleNames.map((name, index) => <group key={name} position={[(index - 1) * .07, -.009, .016]}
          userData={{ xrButton: true, xrWidth: .05, xrLabel: `BOOKLET ${name.toUpperCase()} CIRCLE`, xrAction: active && !preview && spatial.ready && run.reply && !run.confirmed ? () => confirm(index) : undefined }}>
          <mesh><circleGeometry args={[.024, 32]} /><meshBasicMaterial color="#f8f4e9" /></mesh>
          <mesh position={[0, 0, .001]}><ringGeometry args={[.016, .019, 32]} /><meshBasicMaterial color="#2d5450" /></mesh>
          <XRSign text={[name.toUpperCase()]} p={[0, -.034, .001]} size={[.064, .013]} bg="#efeada" fg="#284b47" />
        </group>)}
      </group>
    </group>
    <PracticeLessonUI runtime={runtime} active={active && !preview} title="STEREOPSIS" status={status} tools={["stereo"]} actions={actions} fields={fields}
      lesson={lesson} entryReady={entryReady} ready={ready} onRecord={record} onCancel={cancel} onReset={reset} onExit={exit} settings={reportPanel}
      help={["Fit trial-frame near correction and polarised glasses.", "Face the booklet toward the patient within 38–42 cm.", "Present, wait for the report, confirm its named circle.",
        "Turn pages in order. Stop after two patient errors.", "Read the reported response history to find last correct.", "Completed capture remains available after tool release.", "This models a fictional report, not headset stereo acuity."]} />
  </>;
}
