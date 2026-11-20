# Synthetic body-scan benchmark (Stages A-C; Stage D = emulator replay, pending)

Status: SET2 (3:4 1200x1600, crown-sole fill 0.65-0.85, heels 10-20 cm apart) supersedes set (framing was too small, 9:16, wide stance). Generation + GT + renders done; scoring pending the emulator replay.
(front-only vs front+side, raw vs fuseWithPrior, Asian-weighted 3:1 primary) come from the emulator replay and are NOT here yet.

## Tools and licences
- Blender 5.2.2 LTS (GPL-3.0+), MPFB2 2.0.18 (extension `blender_org/mpfb`, code GPL-3.0-or-later). EEVEE, AgX, 24 samples.
- MPFB/MakeHuman: code GPL; the base mesh and targets are CC0 per the MakeHuman project's licence statement (exported models/renders are not GPL-encumbered). Verified only from the MakeHuman docs' known policy, not re-read from the bundled files: confirm before any redistribution.
- No MPFB system-asset pack installed: no hair, no skin textures, no clothes. Bald plain-material mannequins.

## Sampling (gen_bodies.py, deterministic from SEED + index)
- sex 50/50; age U(18,60); ~90% Asian-dominant (MPFB asian slider U(0.7,1.0)), 10% mixed (asian U(0,0.5), rest split randomly). `asianWeight` = 3 if slider >= 0.6 else 1.
- M height N(165,7) cm, BMI N(24,3.5); F N(155,6), BMI N(23,4); BMI clipped 17-35. Height/mass SOLVED per body by Newton iteration on MPFB sliders (height, weight) to the target stature and mass (mass = mesh volume x 985 kg/m3); the realised stature/mass/BMI are what goes in meta.json.
- MPFB's macro weight slider saturates around BMI 24 for Asian bodies, so heavier targets add local fat targets (belly, torso depth, hip, buttocks, limb fat) via one `fat` scalar. Even so the reachable BMI tops out near 30 (target 35 is not reached) -> upper BMI tail is compressed; realised BMI is reported, not target.
- Asian-typical proportions come only from MPFB's asian race targets (no extra leg/torso sliders invented). muscle, proportions, cup, firmness jittered around defaults.
- Pose: A-pose, upper-arm abduction U(20,30) deg (front), 5-12 deg for the side view (arms relaxed, hands slightly forward); MPFB default stance (feet ~36 cm apart at ankles, wider than "slightly apart"). Variants: 'skin' (shorts + bra band for women) or 'tight' (shorts + tight top); colour only, no thickness change.

## Ground truth (from the rest-pose mesh, tape-like)
Girths = perimeter of the 2D convex hull of the horizontal slice, arm-weighted vertices excluded (weight on arm bones >= 0.5).
- bust: max hull girth in z in [0.68H, 0.78H]; waist: min in [0.57H, 0.71H]; hip: max in [crotch+2cm, crotch+18cm]; crotch = lowest slice height crossing the sagittal centre line.
- shoulder: width of the skin surface at acromion height (shoulder01 bone head z), L-R lateral extremes. Heavy bodies read wide (up to ~46 cm) because fat upper-arm targets bulge there.
- sleeve: acromion -> elbow joint -> wrist joint (joint centres, not skin), mean L/R. inseam: crotch height above floor. torso: neck-base bone z minus waist z (vertical, not along the back).
- Known soft spots: hip band can read high where the thighs begin; tape "shoulder seam" differs from this biacromial-style surface width by a few cm.

## Render settings
1200x1600 (3:4, expo-camera still ratio) JPEG q55, vertical FOV U(58,68) deg, camera height U(1.0,1.3) m; distance AND pitch are solved per view so crown-to-sole fills U(0.65,0.85) of the frame height, vertically centred (pitch comes out around -5..-10 deg, recorded), distance ~1.7-1.9 m. Heels 10-20 cm apart. Yaw jitter N(0,3) deg front, 90 +- 4 deg side (random side). 3 frames/view with camera +-1 cm / +-0.5 deg and subject sway +-0.5 cm. Random walls/floors/box props, sun + area + world light.
`pitchRad` = pi/2 + pitch_up (DeviceMotion beta convention: upright portrait = pi/2, looking up increases beta -- sign inferred, not verified on device).

## Layout
`<set>/body_NNNN/{front_0..2.jpg, side_0..2.jpg, meta.json, gt.json, meta_full.json, rest_mesh.npz}`. meta_full.json has sliders, camera, projected joint positions (normalised image coords), landmark heights, environment.

## Sim-to-real caveats
Mannequin skin/hair-less heads, flat lighting, no clothing thickness/wrinkles, no sensor noise/blur/auto-exposure, perfectly static pose, MPFB body prior (its asian targets are not validated against VN/CN anthropometry), BMI tail compressed, GT is mesh-hull not a real tape (real tape on soft tissue differs 1-3 cm).

## Regenerate
```
scripts/synth-bodies/run_all.sh <OUT_DIR> 1        # seed 1; 20 bodies then continues to 300
blender -b --factory-startup --python scripts/synth-bodies/gen_bodies.py -- <OUT_DIR> <START> <COUNT> <SEED> [WIDTH]
python scripts/synth-bodies/summarize.py <OUT_DIR>  # counts / distributions / GT ranges
```
Windows: Blender at "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"; MPFB enabled per-run via addon_utils (no UI setup needed).
