# This is a sample Python script.

# Press ⌃R to execute it or replace it with your code.
# Press Double ⇧ to search everywhere for classes, files, tool windows, actions, and settings.


def print_hi(name):
    # Use a breakpoint in the code line below to debug your script.
    print(f'Hi, {name}')  # Press ⌘F8 to toggle the breakpoint.


# Press the green button in the gutter to run the script.
if __name__ == '__main__':
    print_hi('PyCharm')

# See PyCharm help at https://www.jetbrains.com/help/pycharm/

"""

for bruckner, OD bright whatveer, why is it yellow and red, shouldbt it be red but illuminated less types, talk to me abt this please
voice over, voice control, talk

when the student makes a mistake, it should rectify. basically give instructions

make the charater blink eyes, when talking move mouth etc,

have more characters and cases type shit, and change the character, make it random for each consulatation etc

light is falling in the center of the pupil, more test cases

see whats haopening in VR on laptop? start on laptop but use VR

every test should have guided practise taht tells u what step to do next, this is other than the quest/xr mode, it is the same except u are told what to do at each step

remove the webxr whatveer button for all, have guided practise and test as buttons, when we click, inside it show, Vr mode or keywboard mouse and then enable voice disable voice, once u select, then go into the thing, get it??

kriskys i dont understand wtf?

remove quick access shit in the consulation, not needed

› and wtf is thus near stand and worth distance dock?? i dont get that shit, move them away, what is it even needed for ?

when i press a/b one menu co es up, its too close to the eyes, its very distorting, move it back

please look at the light, look at the light, etc doesnt work, only look directly at the eye works, why?

can u please look at the light etc doesnt work, only look at the light works, why tf

why does it feel laggy man

extraculor
make the rings a bit smaller, remove labels, its taking away from the eye movements

burncwick
working siatnce not showing, as in where the light is at currently, the distance, so its hard to adjust, this was there earlier but now there now


in heirschberg
the deviation comes, the white dots, but they disappear immedaitly even if i keep flashing the light, that is really bad man wtf?


krimskys



cover uncover


  ## Confirmed VR procedure defects

  3. 6.5 Vergence facility lacks a proper VR procedure state

     The module uses the older generic controller. It lacks:
      • Explicit initial-clear confirmation.
      • Dedicated guided states.
      • A frozen timed-run capture.
      • Clear feedback for premature or invalid flips.
      • A distinct finished-timer/recording state.
      • The interruption protections used by 7.4.
      • PracticeBatchVRStage.tsx (web/practice/xr/PracticeBatchVRStage.tsx:47)
      • xrVergencePractice.ts (web/interaction/xrVergencePractice.ts:23)

  4. 7.4 Accommodative facility skips fixation after changing eyes

     After OD is recorded, the run advances to OS with fixation: true; the same can happen for OU. After changing occlusion and repositioning the flipper, the learner is not
     required to re-establish clarity/fixation.
      • accommodativeFacilityProcedure.ts (web/interaction/accommodativeFacilityProcedure.ts:127)

  ## VR technique-quality problems

  5. 3.1 Motility credits destinations without enforcing a smooth H-pattern

     The nine gaze positions are present, but the procedure awards each point independently. It does not verify:
      • Smooth continuous movement.
      • A recognizable H-shaped route.
      • Controlled transition speed.
      • Whether fixation was lost between points.

     A learner can move the penlight directly between unrelated positions and still complete the test.

  6. 3.2 Bruckner freezes evidence immediately

     Once the ophthalmoscope is at the correct distance, uses the large aperture, illuminates both pupils, and opens the scope view, the observation is captured on the first
     valid frame.
      • BrucknerPracticeController.tsx (web/practice/xr/BrucknerPracticeController.tsx:50)

     Add a short stable binocular inspection dwell, ideally around 500–800 ms.

  7. 3.3 Hirschberg also freezes on the first valid frame

     Correct penlight position, aim, fixation, and examiner view immediately create the capture.
      • HirschbergPracticeController.tsx (web/practice/xr/HirschbergPracticeController.tsx:125)

     A short dwell would make the learner actually maintain the centred viewing position.

  8. 3.4 Krimsky does not capture the baseline reflex relationship

     The learner should first observe the unequal corneal reflexes without prism, then introduce prism and compare the change. Currently the important frozen evidence is the
     completed prism comparison; the initial baseline is not separately verified.

     Recommended sequence:

     stable penlight setup → baseline capture → introduce prism → adjust power/base → stable neutral comparison → record

  9. 6.2 and 6.3 distance targets are not physical instruments

     The learner confirms that a mirrored isolated target has been prepared, but the clinic does not verify an actual target’s:
      • Position.
      • Orientation.
      • Visibility.
      • Isolation.
      • Relationship to the patient.

     This is less convincing than the physical 40 cm target used in 6.4.

  10. 7.4 premature flips provide weak feedback

  Triggering the flipper before the fictional patient has cleared simply leaves the state unchanged. In VR, that can feel like an unresponsive controller rather than technique
  feedback. It should respond with something like “Not clear yet—hold this side.”

  ## Tool and orientation concerns requiring headset testing

  These are not confirmed code defects, but they need physical-device validation before calling the VR setups complete.

  ### Maddox rod

  The horizontal/vertical fitting sockets rotate the whole rod model. Verify in-headset that:

  • The visible grooves clearly rotate by 90°.
  • The streak orientation taught by the guide matches what the learner sees.
  • The fitted rod does not clip into the correction frame.
  • Removing, rolling, and refitting is physically understandable.

  ### Prism bars

  For Krimsky, Maddox, and alternating cover, verify:

  • Base arrows remain readable while the bar is before the eye.
  • Patient-view versus examiner-view base orientation is not reversed.
  • The selected cell actually remains centred before the intended eye.
  • The controller grip does not hide the power labels.
  • The bar does not collide visually with the penlight or occluder.

  ### Rotary prisms

  For 6.2–6.4, verify:

  • Physical roll maps correctly to BI/BO/BU/BD from the patient’s perspective.
  • The ±30° tolerance does not accept visually ambiguous orientations.
  • The free-hand dial is reachable without moving the prism aperture away from OD.
  • Rotating the dial does not accidentally change the instrument’s base orientation.
  • Haptic feedback clearly distinguishes dial engagement from ordinary trigger input.

  ### Scope view

  Bruckner uses a floating scope observation overlay rather than a strictly eyepiece-aligned optical view. Verify:

  • The overlay appears at a comfortable binocular distance.
  • It does not cause eye strain or double imagery.
  • Opening the view does not obscure the patient or technique feedback.
  • Learners understand that they must look through the instrument rather than merely open a panel.

  ### Near targets and stands

  For stereopsis, Thorington, NPC, vergence, and accommodation, verify:

  • The target is readable at its simulated 40 cm distance.
  • Patient-facing versus examiner-facing sides are unmistakable.
  • Socket placement does not invert text.
  • The stand frees a hand without placing the target below the patient’s natural line of sight.
  • Tools placed before the eyes do not obscure the target completely.

  ## VR modules that look structurally sound

  No major source-level VR procedure defect was found in:

  • 4.1 Worth four dot: separate near/distance captures and fitting invalidation.
  • 4.2 Stereopsis: correct page progression, two-error stopping rule, and threshold capture.
  • 4.3 4Δ base-out: OD → withdrawal → OS order, dwell, orientation, and bilateral evidence.
  • 5.1 Maddox: all four distance/near and horizontal/vertical trials are represented in VR.
  • 5.2 Modified Thorington: strong card-distance, facing, upright, aperture, illumination, rod-refit, and stability checks.
  • 6.1 NPC: strong three-trial movement and capture state.
  • 6.4 Near vergence: physical supported target and dedicated endpoint state.
  • 7.1 Push-up: strong OD/OS/OU workflow and immutable endpoint capture.
  • 7.2 Minus lens: strong initial-clear and sustained-blur sequence.
  • 7.3 NRA/PRA: strong plus → zero → reconfirm → minus sequence.
"""
