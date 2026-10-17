import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./ui/styles.css";
import { perfEnabled } from "./perf/perfFlag";

// Developer perf logger: loaded only with ?perf=1 (see README "Performance logging").
if (perfEnabled) void import("./perf/probe").then(module => module.startPerfProbe());
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
