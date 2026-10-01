import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  Eye,
  HelpCircle,
  List,
  MapPin,
  RotateCcw,
  X,
} from "lucide-react";
import { clinicalCase as c } from "../cases/adultDistanceBlur";
import { newSession, reduceSession, examBlock } from "../domain/engine";
import type { Action, ExamConfig, StationId } from "../domain/types";
import { stations } from "../interaction/navigation";
import { useNotebookTool } from "../interaction/webmcp";
import { Room } from "../scene/Room";
import { Panel } from "../ui/Panel";
import { Interview } from "../ui/Interview";
import { Examinations } from "../ui/Examinations";
import { Notebook } from "../ui/Notebook";
import { Submission } from "../ui/Submission";
import { Debrief } from "../ui/Debrief";
import { ExaminationView, type ExaminationAnimation } from "../scene/ExaminationView";
import { ModeSelection, type ExperienceMode } from "../ui/ModeSelection";
import { PracticeMode } from "../practice/PracticeMode";
type PanelName =
  | "briefing"
  | "interview"
  | "exams"
  | "notes"
  | "submission"
  | "controls"
  | "restart"
  | null;
const uid = () => crypto.randomUUID();
export function App() {
  const [mode, setMode] = useState<ExperienceMode | null>(null);
  if (!mode) return <ModeSelection onSelect={setMode} />;
  if (mode === "practice") return <PracticeMode onExit={() => setMode(null)} />;
  return <TestEncounter onExit={() => setMode(null)} />;
}

function TestEncounter({ onExit }: { onExit: () => void }) {
  const [session, setSession] = useState(() => newSession(c, uid()));
  const [panel, setPanel] = useState<PanelName>("briefing");
  const [station, setStation] = useState<StationId>("patient");
  const [target, setTarget] = useState<StationId | null>(null);
  const [targetExam, setTargetExam] = useState<string | undefined>();
  const [toast, setToast] = useState<{ title: string; detail: string; key: number } | null>(null);
  const [held, setHeld] = useState<ExaminationAnimation | null>(null);
  const [animation, setAnimation] = useState<ExaminationAnimation | null>(null);
  const [initialExam, setInitialExam] = useState<string | undefined>();
  const [initialConfig, setInitialConfig] = useState<ExamConfig | undefined>();
  const [stationMode, setStationMode] = useState(() => matchMedia("(max-width: 760px)").matches);
  const [showStations, setShowStations] = useState(true);
  const [locked, setLocked] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [pointerMessage, setPointerMessage] = useState("");
  const [visit, setVisit] = useState<{ id: StationId; seq: number } | null>(null);
  const [tick, setTick] = useState(Date.now());
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const lastExam = useRef({ key: "", at: 0 });
  const lastQuestion = useRef({ key: "", at: 0 });
  const notifiedEvent = useRef<string | undefined>(undefined);
  const dispatch = useCallback(
    (action: Action) => setSession((s) => reduceSession(c, s, action)),
    [],
  );
  useNotebookTool(session, c);
  const unlock = () => {
    if (document.pointerLockElement) document.exitPointerLock();
  };
  const open = useCallback((p: PanelName) => {
    if (document.pointerLockElement) document.exitPointerLock();
    setPanel(p);
  }, []);
  const interact = useCallback(
    (id: StationId, examId?: string) => {
      if (examId) {
        const exam = c.exams.find((e) => e.id === examId)!;
        const config = { eye: exam.eyes[0], mode: exam.modes[0].id };
        const selected = { examId, config, equipment: exam.equipment, name: exam.name };
        setStation(id);
        setInitialExam(examId);
        setInitialConfig(config);
        if (examId === "anterior") {
          setHeld(null);
          setAnimation(selected);
          open(null);
          return;
        }
        setHeld(selected);
        setPanel(null);
        return;
      }
      if (id === "patient" && held) {
        const blocked = examBlock(c, session, held.examId, held.config);
        if (blocked) {
          setToast({ title: "Before this examination", detail: blocked, key: Date.now() });
          return;
        }
        setAnimation(held);
        open(null);
        return;
      }
      setInitialExam(examId);
      setInitialConfig(undefined);
      setStation(id);
      open(id === "patient" ? "interview" : "exams");
    },
    [open, held, session],
  );
  const fail = useCallback(() => {
    setSceneFailed(true);
    setStationMode(true);
    setShowStations(true);
  }, []);
  const targetChange = useCallback((id: StationId | null, examId?: string) => {
    setTarget(id);
    setTargetExam(examId);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 9000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const event = [...session.events]
      .reverse()
      .find((e) => e.type === "exam" || e.type === "repeat");
    if (!event || notifiedEvent.current === event.id) return;
    notifiedEvent.current = event.id;
    const result = session.results.find((r) => r.id === event.resultId);
    if (!result) return;
    setToast({
      title: `${result.examName} · ${result.eye} · ${result.correction}`,
      detail: result.value,
      key: Date.now(),
    });
  }, [session.events, session.results]);
  const onCanvas = useCallback((el: HTMLCanvasElement) => {
    canvas.current = el;
    el.tabIndex = -1;
    el.setAttribute("aria-label", "Consultation room navigation");
    setSceneReady(true);
  }, []);
  const resume = (forceMouseLook = false) => {
    // Remove the modal's inert state synchronously, while the click's user activation is live.
    flushSync(() => setPanel(null));
    requestAnimationFrame(() => canvas.current?.focus());
    if (forceMouseLook) setStationMode(false);
    if ((!stationMode || forceMouseLook) && !sceneFailed && canvas.current?.requestPointerLock) {
      try {
        const result = canvas.current.requestPointerLock();
        result?.catch(() => {
          setStationMode(true);
          setPointerMessage("Mouse capture unavailable. Drag to look, or use the station list.");
          setShowStations(true);
        });
      } catch {
        setStationMode(true);
        setPointerMessage("Mouse capture unavailable. Use the station list.");
      }
    } else if (!canvas.current?.requestPointerLock) {
      setStationMode(true);
    }
  };
  const restart = () => {
    unlock();
    canvas.current = null;
    setSceneReady(false);
    setSession(newSession(c, uid()));
    setPanel("briefing");
    setVisit({ id: "patient", seq: Date.now() });
    setTarget(null);
    setHeld(null);
    setToast(null);
    setAnimation(null);
    notifiedEvent.current = undefined;
    lastExam.current = { key: "", at: 0 };
    lastQuestion.current = { key: "", at: 0 };
  };
  useEffect(() => {
    const change = () => {
      setLocked(!!document.pointerLockElement);
      if (document.pointerLockElement === canvas.current) canvas.current?.focus();
    };
    const error = () => {
      setStationMode(true);
      setShowStations(true);
      setPointerMessage("Mouse capture was rejected. Drag to look or choose a station.");
    };
    document.addEventListener("pointerlockchange", change);
    document.addEventListener("pointerlockerror", error);
    return () => {
      document.removeEventListener("pointerlockchange", change);
      document.removeEventListener("pointerlockerror", error);
    };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const perform = (id: string, config: ExamConfig, observation?: string) => {
    const key = `${id}:${config.eye}:${config.mode}`;
    const now = Date.now();
    if (lastExam.current.key === key && now - lastExam.current.at < 450) return;
    lastExam.current = { key, at: now };
    dispatch({
      type: "performExam",
      examId: id,
      config,
      at: now,
      requestId: `${session.id}:${uid()}`,
      observation,
    });
  };
  const seconds = session.startedAt
    ? Math.max(0, Math.floor(((session.endedAt ?? tick) - session.startedAt) / 1000))
    : 0;
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const complete = new Set(session.results.map((r) => r.examId)).size;
  const inEncounter = session.phase === "encounter";
  return (
    <main className={`encounter ${session.phase === "briefing" ? "is-briefing" : ""}`}>
      <div
        className={`room ${sceneFailed ? "failed" : ""}`}
        aria-label="3D optometry consulting room"
      >
        {!sceneFailed && (
          <Room
            key={session.id}
            active={inEncounter && !panel && !animation}
            suspended={!!animation}
            held={held?.examId}
            target={target}
            onTarget={targetChange}
            onInteract={interact}
            visit={visit}
            onCanvas={onCanvas}
            onFailure={fail}
          />
        )}
      </div>
      <header className="hud">
        <a
          className="wordmark"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            open("controls");
          }}
          aria-label="Opto controls"
        >
          <Eye size={25} />
          <span>
            opto<span className="wordmark-dot">.</span>
          </span>
        </a>
        <div className="case-title">
          <span className="eyebrow">CONSULTATION 01</span>
          <strong>Distance blur</strong>
        </div>
        <div className="hud-actions">
          <span className="draft-badge">FICTIONAL · DRAFT</span>
          <button aria-label="Return to mode selection" onClick={() => { unlock(); onExit(); }}>
            Modes
          </button>
          <button aria-label="Notes" onClick={() => open("notes")} disabled={!inEncounter}>
            <BookOpen size={17} />
            <span>Notes</span>
            {session.results.length > 0 && (
              <span className="tiny-count">{session.results.length}</span>
            )}
          </button>
          <button
            className="complete-button"
            onClick={() => open("submission")}
            disabled={!inEncounter}
          >
            Complete encounter <ArrowRight size={16} />
          </button>
          <button className="icon-button" aria-label="Controls" onClick={() => open("controls")}>
            <HelpCircle size={20} />
          </button>
        </div>
      </header>
      <div className="session-strip">
        <span>
          <i className="live-dot" />{" "}
          {inEncounter
            ? "Consultation in progress"
            : session.phase === "debrief"
              ? "Attempt complete"
              : "Ready for consultation"}
        </span>
        <span>
          <Clock3 size={14} />
          {time}
        </span>
        <span>
          <Check size={14} />
          {complete} examination types recorded
        </span>
      </div>
      {inEncounter && !panel && !animation && (
        <>
          <div className="room-caption">
            <p className="eyebrow">CONSULTATION ROOM</p>
            <span>Explore. Ask. Examine.</span>
          </div>
          <div className="crosshair" aria-hidden="true" />
          {target && (
            <div className="target-label">
              <kbd>E</kbd>
              {targetExam
                ? `${targetExam === "anterior" ? "Use" : "Pick up"} ${c.exams.find((e) => e.id === targetExam)?.equipment}`
                : target === "patient" && held
                  ? "Examine Arun"
                  : stations.find((s) => s.id === target)?.action}
            </div>
          )}
          {!locked && !sceneFailed && !held && (
            <button
              className={`resume-room primary ${held ? "with-instrument" : ""}`}
              onClick={() => resume(true)}
            >
              Return to room · enable mouse-look <ArrowRight size={16} />
            </button>
          )}
        </>
      )}
      {inEncounter && !panel && !animation && !held && (
        <aside
          className={`station-list ${showStations ? "" : "collapsed"}`}
          aria-label="Accessible station navigation"
        >
          <div className="station-list-heading">
            <div>
              <span className="eyebrow">{stationMode ? "STATION MODE" : "QUICK ACCESS"}</span>
              <h2>Consultation stations</h2>
            </div>
            <button
              className="icon-button"
              aria-label={showStations ? "Collapse stations" : "Expand stations"}
              onClick={() => setShowStations(!showStations)}
            >
              {showStations ? <X size={17} /> : <List size={19} />}
            </button>
          </div>
          {showStations && (
            <>
              <p className="small muted">Choose a station to interact.</p>
              {stations.map((s, i) => (
                <button
                  className="station-button"
                  key={s.id}
                  onClick={() => {
                    setVisit({ id: s.id, seq: Date.now() });
                    interact(s.id);
                  }}
                >
                  <span className="station-number">0{i + 1}</span>
                  <span>
                    <strong>{s.name}</strong>
                    <small>{s.description}</small>
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))}
              {sceneFailed && (
                <p className="notice">
                  3D rendering is unavailable. The complete encounter is available here.
                </p>
              )}
              {pointerMessage && (
                <p className="small muted" role="status">
                  {pointerMessage}
                </p>
              )}
            </>
          )}
        </aside>
      )}
      <footer className="room-footer">
        <span>
          <MapPin size={14} /> Teaching clinic · India
        </span>
        <span>
          {locked ? (
            <>
              <kbd>W A S D</kbd> Move <kbd>Mouse</kbd> Look <kbd>E</kbd> Interact <kbd>Esc</kbd>{" "}
              Release
            </>
          ) : stationMode ? (
            "Drag to look · select a station to interact"
          ) : (
            "Mouse & keyboard · station alternative available"
          )}
        </span>
        <button onClick={() => open("restart")} disabled={session.phase === "briefing"}>
          <RotateCcw size={14} /> Restart
        </button>
      </footer>
      {panel === "briefing" && session.phase === "briefing" && (
        <Panel title="Your patient" eyebrow="CASE 01 / ADULT CONSULTATION" briefing>
          <div className="briefing-patient">
            <span className="avatar large">A</span>
            <div>
              <h2>Meet Arun</h2>
              <p>24 years old · fictional patient</p>
            </div>
          </div>
          <p className="briefing-copy">{c.briefing}</p>
          <blockquote>“{c.patient.openingLine}”</blockquote>
          <div className="briefing-meta">
            <span>
              <Clock3 size={17} /> About 8–12 minutes
            </span>
            <span>
              <BookOpen size={17} /> Scripted patient · no key needed
            </span>
          </div>
          <div className="intro-steps">
            <span>
              <b>01</b> Take a history
            </span>
            <span>
              <b>02</b> Select examinations
            </span>
            <span>
              <b>03</b> Explain your plan
            </span>
          </div>
          <button
            className="primary full"
            disabled={!sceneReady && !sceneFailed}
            onClick={() => {
              dispatch({ type: "start", at: Date.now() });
              resume();
            }}
          >
            Enter consultation <ArrowRight size={18} />
          </button>
          {!sceneReady && !sceneFailed && (
            <p className="small muted" role="status">
              Preparing the room. Station mode is ready now.
            </p>
          )}
          <button
            className="text-button full"
            onClick={() => {
              setStationMode(true);
              dispatch({ type: "start", at: Date.now() });
              setPanel(null);
            }}
          >
            Use click-based station mode
          </button>
          <p className="small muted">
            Fictional case · requires clinician review. Draft feedback assesses decision-making; it
            does not certify clinical competence or manual instrument technique.
          </p>
        </Panel>
      )}
      {panel === "interview" && inEncounter && (
        <Panel
          title="Talk with Arun"
          eyebrow="PATIENT / HISTORY"
          onReturn={resume}
          onDismiss={() => setPanel(null)}
        >
          <Interview
            c={c}
            session={session}
            ask={(question, factId) => {
              const now = Date.now();
              if (lastQuestion.current.key === question && now - lastQuestion.current.at < 450)
                return;
              lastQuestion.current = { key: question, at: now };
              dispatch({ type: "askQuestion", question, factId, at: now });
            }}
          />
        </Panel>
      )}
      {panel === "exams" && inEncounter && (
        <Panel
          title={stations.find((s) => s.id === station)!.name}
          eyebrow="EQUIPMENT / PROCEDURE"
          onReturn={resume}
          onDismiss={() => setPanel(null)}
        >
          <Examinations
            key={station}
            c={c}
            session={session}
            station={station}
            initialExam={initialExam}
            initialConfig={initialConfig}
            onSelect={(examId, config) =>
              dispatch({ type: "selectProcedure", examId, config, at: Date.now() })
            }
            onPerform={(examId, config) => {
              const exam = c.exams.find((e) => e.id === examId)!;
              const selected = { examId, config, equipment: exam.equipment, name: exam.name };
              setInitialConfig(config);
              setPanel(null);
              unlock();
              if (examId === "anterior") {
                setAnimation(selected);
                return;
              }
              setHeld(selected);
              setVisit({ id: "patient", seq: Date.now() });
            }}
          />
        </Panel>
      )}
      {held && !panel && !animation && inEncounter && (
        <section className="held-prompt" aria-label="Selected instrument">
          <p className="eyebrow">INSTRUMENT READY · {held.config.eye}</p>
          <h2>{held.equipment}</h2>
          <p>
            {held.examId === "anterior" ? "Station ready." : "Instrument in hand."} Aim at Arun and
            press E, or examine below.
          </p>
          <div className="held-config">
            <label>
              Eye
              <select
                value={held.config.eye}
                onChange={(e) =>
                  setHeld({
                    ...held,
                    config: { ...held.config, eye: e.target.value as ExamConfig["eye"] },
                  })
                }
              >
                {c.exams
                  .find((e) => e.id === held.examId)!
                  .eyes.map((eye) => (
                    <option key={eye} value={eye}>
                      {eye === "OD" ? "Right · OD" : eye === "OS" ? "Left · OS" : "Both · OU"}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Procedure
              <select
                value={held.config.mode}
                onChange={(e) =>
                  setHeld({ ...held, config: { ...held.config, mode: e.target.value } })
                }
              >
                {c.exams
                  .find((e) => e.id === held.examId)!
                  .modes.map((mode) => (
                    <option key={mode.id} value={mode.id}>
                      {mode.label}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="button-row">
            {!locked && !sceneFailed && (
              <button className="primary full" onClick={() => resume(true)}>
                Return to room · enable mouse-look
              </button>
            )}
            <button
              className="secondary"
              onClick={() => {
                flushSync(() => setHeld(null));
                resume();
              }}
            >
              Put down & return to room
            </button>
            <button
              className="primary"
              onClick={() => {
                unlock();
                const blocked = examBlock(c, session, held.examId, held.config);
                if (blocked) {
                  setToast({ title: "Before this examination", detail: blocked, key: Date.now() });
                  return;
                }
                setAnimation(held);
              }}
            >
              Examine Arun →
            </button>
          </div>
        </section>
      )}
      {animation && inEncounter && (
        <ExaminationView
          key={`${animation.examId}:${animation.config.eye}:${animation.config.mode}`}
          animation={animation}
          onCancel={() => {
            setAnimation(null);
            setPanel(null);
            setVisit({ id: "patient", seq: Date.now() });
          }}
          onComplete={(observation) => {
            perform(animation.examId, animation.config, observation);
            setInitialExam(animation.examId);
            const exam = c.exams.find((e) => e.id === animation.examId)!;
            flushSync(() => {
              setAnimation(null);
              setHeld({
                ...animation,
                config: {
                  ...animation.config,
                  eye:
                    animation.config.eye === "OD" && exam.eyes.includes("OS")
                      ? "OS"
                      : animation.config.eye,
                },
              });
              setPanel(null);
              setVisit({ id: "patient", seq: Date.now() });
            });
            resume();
          }}
        />
      )}
      {toast && (
        <aside key={toast.key} className="finding-toast" role="status">
          <span className="eyebrow">
            {toast.title === "Before this examination"
              ? "PROCEDURE NOTE"
              : "✓ FINDING RECORDED · SAVED TO NOTEBOOK"}
          </span>
          <h3>{toast.title}</h3>
          <p>{toast.detail}</p>
          <button aria-label="Dismiss finding" onClick={() => setToast(null)}>
            ×
          </button>
        </aside>
      )}
      {panel === "notes" && (
        <Panel
          title="Findings notebook"
          eyebrow="ACQUIRED INFORMATION"
          onReturn={inEncounter ? resume : undefined}
          onDismiss={() => setPanel(session.phase === "briefing" ? "briefing" : null)}
        >
          <Notebook c={c} session={session} />
        </Panel>
      )}
      {panel === "submission" && inEncounter && (
        <Panel
          title="Complete the encounter"
          eyebrow="ASSESSMENT & PLAN"
          wide
          onReturn={resume}
          onDismiss={() => setPanel(null)}
        >
          <Submission
            c={c}
            session={session}
            submit={(submission) => {
              dispatch({ type: "submitAssessment", submission, at: Date.now() });
              setPanel(null);
              unlock();
            }}
          />
        </Panel>
      )}
      {session.phase === "debrief" && (
        <Panel title="Consultation debrief" eyebrow="CASE 01 / DRAFT EDUCATIONAL FEEDBACK" wide>
          <Debrief c={c} session={session} restart={restart} />
        </Panel>
      )}
      {panel === "controls" && session.phase !== "debrief" && (
        <Panel
          title="Make yourself at home"
          eyebrow="CONTROLS & SCOPE"
          onReturn={inEncounter ? resume : undefined}
          onDismiss={() => setPanel(session.phase === "briefing" ? "briefing" : null)}
        >
          <div className="control-grid">
            <kbd>W A S D / ↑ ↓ ← →</kbd>
            <p>Move at a walking pace. Furniture and walls have collisions.</p>
            <kbd>Mouse</kbd>
            <p>Look around while captured. Otherwise drag on the room to look.</p>
            <kbd>E / Click</kbd>
            <p>Interact with the targeted object within 2 metres.</p>
            <kbd>Escape</kbd>
            <p>Release the mouse or close a panel. Use Return to room to capture again.</p>
          </div>
          <h2>Station mode</h2>
          <p>
            Use the station list for keyboard, touch, unavailable mouse capture, or unavailable 3D.
            It opens the same interview and examinations.
          </p>
          <button
            className="secondary"
            onClick={() => {
              setStationMode(!stationMode);
              setShowStations(true);
              unlock();
            }}
          >
            {stationMode ? "Enable mouse-capture controls" : "Use station mode"}
          </button>
          <h2>What this encounter teaches</h2>
          <p>
            History taking, examination selection, interpretation, and explaining a plan. All
            examination findings are authored simulation data. The room is not a calibrated acuity
            testing environment.
          </p>
          <p className="small muted">
            One offline scripted case · no AI or voice mode · no records saved after reload. The
            static answer key is inspectable and unsuitable for secure examinations.
          </p>
        </Panel>
      )}
      {panel === "restart" && session.phase !== "debrief" && (
        <Panel
          title="Start a fresh attempt?"
          eyebrow="RESTART ENCOUNTER"
          onDismiss={() => setPanel(null)}
        >
          <p>
            Your current interview, results, and assessment will be cleared. This prototype does not
            save attempts automatically.
          </p>
          <div className="button-row">
            <button className="secondary" onClick={() => setPanel(null)}>
              Keep this attempt
            </button>
            <button className="primary" onClick={restart}>
              Restart encounter
            </button>
          </div>
        </Panel>
      )}
    </main>
  );
}
