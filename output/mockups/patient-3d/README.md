# Patient 3D visual study

Run the repository Vite server (`npm run dev -- --port 5175`) and open
http://127.0.0.1:5175/output/mockups/patient-3d/ . This isolated desktop preview
does not change the simulator or deploy anything.

The left panel imports the actual `Patient` component. The right panel uses
MakeHuman geometry, a fair skin texture, separate eyes, a custom seated pose
and original chair geometry. Controls provide independent OD/OS movement,
pointer tracking, smooth automatic tracking and reset. Eye rotation uses
frame-rate-independent exponential easing; the original preview snapped
directly to input. Automatic tracking starts only on explicit button press.

## Provenance

- Base mesh, male targets, eye mesh and fitting map: MakeHuman Community,
  https://github.com/makehumancommunity/makehuman/tree/master/makehuman/data
- Skin, eyebrow001 eyebrows, short04 hair and male_casualsuit04 clothing: official MakeHuman system
  assets, https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html
- Download source: https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip
- All these assets are CC0; full text is `assets/LICENSE-CC0.txt`. Asset headers
  credit Data Collection AB, Joel Palmius and Jonas Hauquier; the male target
  also credits Manuel Bastioni. Headers are preserved in source files.
- Modifications: male shape targets, fitted hair/clothing/eyes, seated pose,
  removal of the opaque corneal-mask shell, original procedural iris shader,
  camera setup and original chair/shoes. `prepare-assets.py` regenerates the
  derived `assets/patient.json`. Textures are unmodified.
- No Sketchfab model was downloaded, copied or incorporated.

Eyelids use CC0 MakeHuman open/closed targets, with widened oval openings,
raised/thinned fitted brows and the existing simulator’s blink timing. The visible
upper/lower margins are remapped to oval curves with softened corner transitions;
iris and pupil diameters are enlarged for the clearer existing-patient proportions.

Visual prototype only: clinical gaze/pupil behavior,
production rigging and physical Quest validation remain outstanding. Browser
checks cover rendering and controls, not headset performance or clinical accuracy.

The current preview uses identical procedural spherical eyeballs with mirrored
centred pivots, a shared distant gaze direction and quaternion smoothing. The
local lid patches and closed targets are mirrored; brows are shortened by 25%.
The original imported eye geometry remains in the source assets but is not
rendered. Four-direction desktop screenshots are retained for visual review.

Corner refinement relaxes the local lid-fold topology and clears intrusive skin
from the oval aperture, without changing globe size. The closed blink target
retains its covering surface; the open-eye clearance is not applied to it.
