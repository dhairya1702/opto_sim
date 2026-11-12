import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createPerfHandler, perfLogEnabled } from "./server/perf.mjs";

/** Same opt-in /api/perf log as the Express server; 404 and silent unless PERF_LOG=1. */
function perfLog(): Plugin {
  const mount = (middlewares: { use: (path: string, handler: ReturnType<typeof createPerfHandler>) => unknown }) => {
    const enabled = perfLogEnabled();
    middlewares.use("/api/perf", createPerfHandler({ enabled }));
    if (enabled) console.log("[perf] PERF_LOG=1: printing reports from ?perf=1 clients on this network.");
  };
  return {
    name: "opto-perf-log",
    configureServer(server) { mount(server.middlewares); },
    configurePreviewServer(server) { mount(server.middlewares); },
  };
}

// Version the entire patient bundle together, including texture references in JSON.
function patientAssets(): Plugin {
  const root = fileURLToPath(new URL("./public/assets/patient-prototype/", import.meta.url));
  const files = readdirSync(root).sort().map(name => ({ name, source: readFileSync(root + name) }));
  const hash = createHash("sha256");
  files.forEach(file => { hash.update(file.name); hash.update(file.source); });
  const directory = "assets/patient-" + hash.digest("hex").slice(0, 16);
  return {
    name: "versioned-patient-assets",
    config: () => ({ define: { __PATIENT_ASSET_BASE__: JSON.stringify("/" + directory + "/") } }),
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (request.url?.startsWith("/" + directory + "/"))
          request.url = request.url.replace("/" + directory + "/", "/assets/patient-prototype/");
        next();
      });
    },
    generateBundle() {
      files.forEach(file => this.emitFile({ type: "asset", fileName: directory + "/" + file.name, source: file.source }));
    },
  };
}

export default defineConfig({
  plugins: [react(), perfLog(), patientAssets()],
  test: { include: ["web/tests/**/*.test.ts", "server/**/*.test.mjs"] },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
          scene: ["@react-three/fiber", "@react-three/drei"],
        },
      },
    },
  },
});
