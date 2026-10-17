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

export default defineConfig({
  plugins: [react(), perfLog()],
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
