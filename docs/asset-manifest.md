# Asset and license manifest

All visual assets used by this prototype are served with the app or generated locally from its source. No hotlinked images, fonts, models or textures; no identifiable real patient imagery; no ripped models.

| Asset | Source | Author | License | Modifications / limitations |
| --- | --- | --- | --- | --- |
| Consulting room, furniture, floor, blinds, signs | `web/scene/Room.tsx`, `web/scene/Models.tsx` | Original procedural geometry authored for this project | CC0-1.0 dedication for this project's visual geometry and generated sign textures | Approximate 4 m × 5 m room; simple lighting and modular furniture |
| Fictional seated adult patient | `Patient` in `web/scene/Models.tsx` | Original project geometry | CC0-1.0 | Stylized figure, static pose; no real-person likeness or animation model |
| Slit lamp, trolley, retinoscope, direct ophthalmoscope, trial frame/lens set, paddles, pen torch and fixation target | `web/scene/Models.tsx` | Original project geometry | CC0-1.0 | Recognizable procedural silhouettes; dimensions are approximate, not manufacturer replicas or manual-technique simulators |
| Acuity chart and local clinic labels | `Sign` in `web/scene/Models.tsx` | Original project canvas textures | CC0-1.0 | Generated locally with system sans-serif font. Decorative chart is not calibrated |
| Interface icons | `lucide-react` npm package | Lucide contributors | ISC | Unmodified icons used as React components; package license in `node_modules/lucide-react/LICENSE` |
| Three.js / React Three Fiber / Drei | npm dependencies listed in lockfile | Respective project contributors | MIT | Runtime libraries, not third-party artistic assets |

No external GLB/glTF models were incorporated. The current geometry is a locally authored stylized MVP, and its recognizability requires pilot review. Manufacturer-accurate or licensed high-fidelity replacement models remain a visual refinement, with provenance required before inclusion. There are no asset downloads that can silently fail at runtime. WebGL/context failures have a complete station-mode fallback.

CC0 text: https://creativecommons.org/publicdomain/zero/1.0/legalcode
