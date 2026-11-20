# Anthropometric calibration: ANSUR II + NHANES + AIST (Japan)

Script: `scripts/anthro-fit/fit_ansur.py` (run: `python -I -X utf8 fit_ansur.py <ansur_dir> <nhanes_dir> <aist_2003.txt> <out>`).
All errors in cm. Evaluation = 5-fold out-of-fold (every row held out once, i.e. five 20% hold-outs). Cells read `MAE all-pop | MAE Asian (Asian bias, pred - true)`. Asian is the PRIMARY metric. Pooled "w" fits weight Asian rows 3x (VN would be 4x; no VN data, see below).

## 1. Data, columns, licence

| Source | Rows used | Asian rows | Notes |
|---|---|---|---|
| ANSUR II male (latin-1) | 4082 | 117 (`DODRace==4`) | 117 < 300, so Asian-only fits are reported but pooled-weighted is preferred for geometry |
| ANSUR II female | 1986 | 71 | same |
| NHANES 2017-18 (J) + 2021-23 (L), adults 18-65 | M 3814 / F 4413 | M 414 / F 465 (`RIDRETH3==6`) | >= 300 per sex, Asian-only fit preferred for waist/hip prior |
| WHO STEPS Vietnam 2021 / 2015 | NOT OBTAINED | - | login required, see section 6 |
| AIST/HQL 2003 (Japan) | summary means only (M n=49, F n=48, age 20-35) | - | individual data not offered for this DB |

ANSUR columns (mm; `weightkg` is hectograms): stature `stature`, weight `weightkg`/10, age `Age`, foot `footlength`, biacromial `biacromialbreadth`,
chest `chestcircumference`/`chestbreadth`/`chestdepth`, waist `waistcircumference`/`waistbreadth`/`waistdepth`,
hip (buttock) `buttockcircumference`/`hipbreadth`/`buttockdepth`. Race: `DODRace` (1 White, 2 Black, 3 Hispanic, 4 Asian, 5 Native American, 6 Pacific Islander, 8 Other).
NHANES: BMXHT, BMXWT, BMXWAIST, BMXHIP, RIAGENDR, RIDAGEYR, RIDRETH3.

Licence / terms: ANSUR page says data "published internally in 2012, made available publicly in 2017", files "as originally published"; no explicit licence text found besides the site-wide "Penn State Terms" link (US Army data, public release). NHANES is US-government public domain. AIST page states no application or consent form is needed to use the published statistics (a usage-terms PDF `利用規程` exists). WHO STEPS: see section 6.

Landmark mismatches (important):
- ANSUR `waistcircumference` is at the omphalion (navel level), NOT the narrowest natural waist the app measures. NHANES waist is just above the iliac crest, also not the narrowest row. AIST item 59/60 "minimum waist" IS the natural waist.
- ANSUR breadths/depths are anthropometer (caliper) readings; the app reads silhouette contour widths from a 2D photo. See finding 1.
- ANSUR `chestcircumference` is bust/chest level; `hipbreadth` is the standing max hip breadth, `buttockdepth` max buttock protrusion.

## 2. Key findings (read this first)

1. **Superellipse n fitted on ANSUR is partly a landmark artefact.** With true caliper breadth+depth, the n=2 ellipse underestimates circumference by 19 cm (chest), 4 cm (waist), 8 cm (hip) on Asian males; fitted n = 2.5 / 2.24 / 2.32 gets MAE 1.8 / 1.2 / 1.3 cm. But on the Japanese 3D-scan means (breadth/depth defined closer to a contour), the n that reproduces mean circumference is only **chest 2.32-2.37, waist 2.15, hip 2.06-2.13**, and applying ANSUR n (2.51/2.24/2.32) OVERSHOOTS chest by +4..+12 cm and hip by +6.5..+7 cm. The camera silhouette is closer to AIST geometry than to caliper geometry, so do not paste ANSUR n=2.5 for chest. The waist (the one region where landmarks agree) is consistent: ANSUR 2.24, AIST 2.15.
2. **BMI depth gain of 0.5 is too high**: every fit (both sexes, all regions, Asian or not) gives an equivalent `bmiDepthGain` of 0.17-0.37 (central ~0.25). Age term is noise in Asian-only fits (sign flips): drop it (set `ageWaistGain` 0).
3. **Current guessed-depth formula is biased** (ANSUR Asian, depth MAE cm): male waist depth +5.9 too deep, female waist +3.7, female hip +4.6, male hip +2.2. Fitted linear ratio: depth MAE ~1.0-1.2 cm everywhere.
4. **Asian bodies differ**: Asian depth/breadth ratios are 0.01-0.04 lower than non-Asian (ANSUR), mean circumferences 5-9 cm lower, and prior intercepts differ by 7-25 cm (NHANES hip female Asian intercept 74.8 vs 98.3 non-Asian). A model trained on everyone is biased +1.0 to +1.7 cm on Asian waist/hip.
5. Landmark-honest prior sanity check on AIST mean person (section 4): hip prior matches within 1 cm; waist prior overshoots the natural (narrowest) waist by ~+2 cm (male, ANSUR-Asian) / +7 cm (female, both datasets).

## 3. Recommended constants (existing parametrisation)

### 3a. `K.superellipseN` / shape
Single global constant: **2.15** (waist-consistent across ANSUR and AIST; on AIST means chest is then still under by 5-7 cm (n=2.0: 7-9), waist within 0.1 cm, hip +0.4..+1.6 cm (n=2.0: -0.9..-2.0)). If per-region constants are acceptable (small code change in `circumferenceFromSemiAxes` callers): **chest 2.35, waist 2.15, hip 2.10** (AIST-implied, residual on AIST means chest +1.4/-0.7, waist 0, hip ~0; ANSUR values 2.5/2.24/2.32 are upper bounds). Not validated against a real contour dataset: first real tape fixtures should re-tune this.

### 3b. Depth-ratio model (no side view)
Form kept: `ratio = base * clamp(1 + gain*(BMI-22)/22, 0.8, 1.3)` with `bmiDepthGain = 0.25`, age term removed (`ageWaistGain = 0`).
Bases are the mean of the Asian-weighted ANSUR fit and the AIST Japanese mean ratio (BMI ~22), because the two disagree for chest and waist (landmarks) and the truth for a contour is unknown:

| region | ANSUR w-fit M / F | AIST mean M / F | recommended neutral base | sex tweak |
|---|---|---|---|---|
| chest | 0.814 / 0.872 | 0.686 / 0.807 | **0.75** | female x1.10 (-> 0.825), male x1.0 |
| waist | 0.685 / 0.683 | 0.756 / 0.751 | **0.72** | none (remove male x1.06) |
| hip | 0.668 / 0.635 | 0.740 / 0.647 | **0.70** | female x0.92 (-> 0.644; currently x1.06) |

Note the current code's female hip tweak (x1.06) goes the WRONG way: both ANSUR and AIST show women have a flatter hip section (ratio 0.64-0.65) than men (0.67-0.74). Pure ANSUR-Asian fit alternative (if you trust calipers): chest 0.807/0.854, waist 0.682/0.682, hip 0.665/0.629, gain 0.18-0.37.
Expected accuracy (ANSUR, pure fit, with fitted n): no-side-view circumference MAE for Asian males 3.1 / 1.9 / 1.9 cm (chest/waist/hip) versus current 21.3 / 4.6 / 4.6 cm; females 3.0 / 2.1 / 1.3 versus 14.7 / 2.3 / 2.4. (Waist/hip "current" is only that good because current errors in depth and n=2 partially cancel; chest current is catastrophically low vs caliper truth.) The blended constants above are not separately evaluated.

### 3c. Demographic prior (no camera), circ_cm = int + a*stature_cm + b*kg + c*age
Chosen per the weighting rules: NHANES Asian-only (n >= 300) for waist/hip; ANSUR Asian-weighted pooled (3x) for chest/biacromial (only source, Asian n < 300). `resid SD` = Asian OOF residual SD, use as fusion weight.

| target | source | sex | int | stature | kg | age | MAE Asian | resid SD |
|---|---|---|---|---|---|---|---|---|
| waist | NHANES Asian-only | M | 91.841 | -0.4014 | 0.8095 | 0.1798 | 3.53 | 4.54 |
| waist | NHANES Asian-only | F | 86.405 | -0.3905 | 0.8702 | 0.1641 | 3.73 | 4.78 |
| hip | NHANES Asian-only | M | 77.622 | -0.1252 | 0.5614 | -0.0186 | 2.24 | 2.93 |
| hip | NHANES Asian-only | F | 74.806 | -0.1502 | 0.7383 | 0.0145 | 2.71 | 3.67 |
| chest | ANSUR w | M | 96.775 | -0.2613 | 0.6049 | 0.107 | 2.56 | 3.11 |
| chest | ANSUR w | F | 93.226 | -0.3072 | 0.7077 | 0.1206 | 2.96 | 3.82 |
| biacromial | ANSUR w | M | 21.177 | 0.0885 | 0.0612 | -0.0125 | 1.13 | 1.39 |
| biacromial | ANSUR w | F | 13.891 | 0.1254 | 0.0402 | -0.0170 | 0.89 | 1.14 |

Foot length adds essentially nothing (<= 0.1 cm MAE, waist-only 0.1); skip it. Waist caveat: these predict navel/iliac-crest waist, which runs larger than the narrowest waist. On the AIST mean person ANSUR-Asian waist prior is +2.0 (M) and +7.2 (F) cm above the true minimum waist, NHANES-Asian +4.9 (M) / +7.6 (F). Treat the waist prior as an upper-biased, low-weight estimate (inflate its SD, or subtract ~2 cm M / ~5 cm F until real tape data exist; n=48 only, not enough to bake in). Hip prior reproduces the AIST mean hip within 1 cm (M 91.5 vs 90.8, F 90.2 vs 90.0).

## 4. Asian vs non-Asian (how much population matters)

Prior intercept/mean differences, from the raw tables below: ANSUR male waist mean 86.4 (Asian) vs 94.3, hip 96.5 vs 102.1, chest 100.2 vs 106.0; NHANES female hip intercept 74.8 vs 98.3 (means 97.3 vs 111.1). Depth/breadth ratio ANSUR: male chest 0.843 vs 0.878, waist 0.703 vs 0.728, hip 0.696 vs 0.711; female chest 0.886 vs 0.920, waist 0.694 vs 0.710, hip 0.641 vs 0.659. Using the all-population prior on Asian users biases waist/hip by +1 to +1.7 cm (the "all" rows); Asian-only removes the bias and cuts Asian MAE up to 0.5 cm (NHANES F hip 3.17 -> 2.71), at slightly higher all-population error (expected).

## 5. AIST Japan population-level sanity check
See the AIST block in the raw output. Summary: JP mean depth/breadth ratios (M/F) chest 0.686/0.807, waist 0.756/0.751, hip 0.740/0.647 versus ANSUR Asian 0.843/0.886, 0.703/0.694, 0.696/0.641 (so ANSUR chest ratios are far higher, waist/hip roughly similar but JP waist is rounder). Current code from JP breadth alone gives circumference errors M -5.6/+0.6/-2.7 and F -10.3/-1.5/+1.7 cm (chest/waist/hip) at n=2. Chest is the problem region.

## 6. Vietnam WHO STEPS (not obtained, no workaround attempted)
`extranet.who.int/ncdsmicrodata/index.php/catalog/948` (2021) and `/catalog/590` (2015): the microdata download redirects to `/auth/login/`. Access conditions on the page: acknowledge the data source; share any planned publication with WHO before publishing; cite as "This paper uses data from the Viet Nam 2021 STEPS survey, implemented by [agency] with the support of the World Health Organization". What anh Khoi must do: register a free account on that NADA portal, log in, open each catalog entry's "Get Microdata" (may require a short data-request form), download the CSV/Stata file plus the data dictionary and drop them in a new directory. Then give the column names (expected waist m14 / hip m15, height, weight, age, sex; clean 999/777 placeholders). The script's `prior_block` can be reused with VN weight 4.
Size Korea: raw 3D/1D data requires application and approval via sizekorea.kr (account + request form; not checked in detail).

## 7. Caveats
- ANSUR = US Army personnel (young, fit, 2010-12); only 117 M / 71 F Asian (mixed East/South/Southeast Asian). NHANES Asian is mostly Chinese/Indian/Filipino/Vietnamese-American, tape measures, self-selected adult sample. Neither is Vietnamese-resident; VN STEPS would be the best fit (waist/hip only, no depth).
- Caliper breadth != camera contour width; clothing, pose, lens distance and the app's row selection all add error not modelled here. All n / depth-ratio recommendations are therefore soft and must be re-tuned on real tape fixtures.
- AIST data are 48-49 young adults, means only (no regression possible).
- The waist landmark mismatch (above) affects ANSUR/NHANES waist numbers; chest/hip landmarks are close to the app's.

---
# Raw output (generated by the script)

# Sample sizes
- male: ANSUR n=4082 (Asian 117); NHANES 2017-18+2021-23 adults 18-65 n=3814 (Asian 414)
- female: ANSUR n=1986 (Asian 71); NHANES 2017-18+2021-23 adults 18-65 n=4413 (Asian 465)

# ANSUR II male
## a. side-view path (TRUE breadth+depth -> circumference). cells: MAE all | MAE Asian (bias)
- chest: n=2 20.40 | 18.85 (-18.85) | n_all=2.52 2.13 | 1.78 (+0.45) | n_w=2.51 2.13 | 1.78 (+0.42) | n_AsianOnly=2.51 (rows=117) 2.16 | 1.80 (+0.14) | linear_w 1.347*ell-9.25 2.09 | 1.84 (+0.11)
- waist: n=2 4.85 | 4.31 (-4.31) | n_all=2.24 1.23 | 1.18 (+0.11) | n_w=2.24 1.22 | 1.18 (+0.11) | n_AsianOnly=2.23 (rows=117) 1.25 | 1.19 (-0.15) | linear_w 1.056*ell-0.14 1.23 | 1.18 (+0.14)
- hip: n=2 8.34 | 7.78 (-7.78) | n_all=2.32 1.46 | 1.27 (+0.09) | n_w=2.32 1.46 | 1.27 (+0.08) | n_AsianOnly=2.32 (rows=117) 1.47 | 1.27 (-0.17) | linear_w 1.011*ell+7.24 1.36 | 1.26 (+0.47)
## b. no-side-view path (TRUE breadth + height/weight/age -> guessed depth -> circumference)
- chest: CURRENT depth 2.11 | 1.80 (-1.62) circ(n=2) 23.14 | 21.26 (-21.26)
    new[all] depth 1.40 | 1.23 (+0.45) circ 3.73 | 3.09 (+1.13)
    new[w] depth 1.40 | 1.23 (+0.43) circ 3.72 | 3.07 (+1.07)
    new[AsianOnly] depth 1.45 | 1.16 (+0.07) circ 4.02 | 3.01 (-0.28)
    coefs[w-pooled]: ratio = 0.814 +0.0104*(BMI-22) +0.0096*(age-30)/10 ; n_b=2.51 => base=0.814 bmiDepthGain=0.28 ageGain/decade=0.0119
    coefs[Asian-only]: ratio = 0.807 +0.0101*(BMI-22) -0.0087*(age-30)/10 ; n_b=2.51 => base=0.807 bmiDepthGain=0.28 ageGain/decade=-0.0108
- waist: CURRENT depth 6.14 | 5.92 (+5.92) circ(n=2) 4.59 | 4.63 (+4.45)
    new[all] depth 1.16 | 1.09 (+0.43) circ 2.15 | 1.93 (+0.59)
    new[w] depth 1.16 | 1.08 (+0.41) circ 2.16 | 1.93 (+0.55)
    new[AsianOnly] depth 1.28 | 0.96 (+0.03) circ 2.41 | 1.87 (-0.13)
    coefs[w-pooled]: ratio = 0.685 +0.0054*(BMI-22) +0.0273*(age-30)/10 ; n_b=2.23 => base=0.685 bmiDepthGain=0.17 ageGain/decade=0.0398
    coefs[Asian-only]: ratio = 0.682 +0.0054*(BMI-22) -0.0021*(age-30)/10 ; n_b=2.23 => base=0.682 bmiDepthGain=0.18 ageGain/decade=-0.0031
- hip: CURRENT depth 2.89 | 2.36 (+2.22) circ(n=2) 4.49 | 4.63 (-4.59)
    new[all] depth 1.09 | 1.02 (+0.05) circ 1.97 | 1.85 (+0.05)
    new[w] depth 1.09 | 1.02 (+0.05) circ 1.97 | 1.85 (+0.04)
    new[AsianOnly] depth 1.11 | 1.03 (+0.06) circ 1.99 | 1.87 (+0.06)
    coefs[w-pooled]: ratio = 0.668 +0.0073*(BMI-22) +0.0041*(age-30)/10 ; n_b=2.32 => base=0.668 bmiDepthGain=0.24 ageGain/decade=0.0062
    coefs[Asian-only]: ratio = 0.665 +0.0082*(BMI-22) -0.0028*(age-30)/10 ; n_b=2.32 => base=0.665 bmiDepthGain=0.27 ageGain/decade=-0.0042
## c. demographic prior (ANSUR). cells: MAE all | MAE Asian (bias)
- chest [all]: 2.44 | 2.60 (+0.70) | resid SD Asian 3.13 | coefs[int,stat,kg,age] [98.1927, -0.2687, 0.6025, 0.1111]
- chest [w]: 2.43 | 2.56 (+0.60) | resid SD Asian 3.11 | coefs[int,stat,kg,age] [96.7747, -0.2613, 0.6049, 0.107]
- chest [AsianOnly]: 2.59 | 2.45 (-0.01) | resid SD Asian 3.07 | coefs[int,stat,kg,age] [85.2452, -0.1998, 0.6419, 0.0293]
- chest +foot [all]: 2.43 | 2.64 (+0.80) | resid SD Asian 3.14 | coefs[int,stat,kg,age,foot] [99.5435, -0.2349, 0.6077, 0.1096, -0.284]
- chest +foot [w]: 2.43 | 2.60 (+0.68) | resid SD Asian 3.12 | coefs[int,stat,kg,age,foot] [97.931, -0.2294, 0.6099, 0.1055, -0.2636]
- chest +foot [AsianOnly]: 2.60 | 2.51 (-0.03) | resid SD Asian 3.14 | coefs[int,stat,kg,age,foot] [86.1189, -0.1707, 0.6467, 0.0283, -0.2373]
- waist [all]: 3.22 | 3.31 (+1.72) | resid SD Asian 3.63 | coefs[int,stat,kg,age] [92.7558, -0.3961, 0.7587, 0.1985]
- waist [w]: 3.23 | 3.26 (+1.56) | resid SD Asian 3.63 | coefs[int,stat,kg,age] [90.7185, -0.3866, 0.7606, 0.2019]
- waist [AsianOnly]: 3.57 | 2.99 (+0.02) | resid SD Asian 3.68 | coefs[int,stat,kg,age] [82.0487, -0.3483, 0.7362, 0.284]
- waist +foot [all]: 3.14 | 3.49 (+2.12) | resid SD Asian 3.67 | coefs[int,stat,kg,age,foot] [98.1667, -0.2604, 0.7796, 0.1924, -1.1378]
- waist +foot [w]: 3.14 | 3.38 (+1.89) | resid SD Asian 3.66 | coefs[int,stat,kg,age,foot] [95.3527, -0.2588, 0.7807, 0.1962, -1.0563]
- waist +foot [AsianOnly]: 3.56 | 3.01 (+0.00) | resid SD Asian 3.70 | coefs[int,stat,kg,age,foot] [83.4535, -0.3015, 0.744, 0.2822, -0.3816]
- hip [all]: 2.04 | 1.83 (+0.49) | resid SD Asian 2.25 | coefs[int,stat,kg,age] [83.1666, -0.1496, 0.5436, -0.0474]
- hip [w]: 2.04 | 1.82 (+0.43) | resid SD Asian 2.25 | coefs[int,stat,kg,age] [82.5059, -0.1471, 0.5448, -0.0443]
- hip [AsianOnly]: 2.15 | 1.86 (-0.03) | resid SD Asian 2.28 | coefs[int,stat,kg,age] [78.101, -0.1424, 0.5604, 0.023]
- hip +foot [all]: 2.04 | 1.84 (+0.58) | resid SD Asian 2.27 | coefs[int,stat,kg,age,foot] [84.4851, -0.1165, 0.5487, -0.0489, -0.2772]
- hip +foot [w]: 2.04 | 1.83 (+0.51) | resid SD Asian 2.26 | coefs[int,stat,kg,age,foot] [83.6034, -0.1169, 0.5496, -0.0456, -0.2501]
- hip +foot [AsianOnly]: 2.15 | 1.87 (-0.02) | resid SD Asian 2.30 | coefs[int,stat,kg,age,foot] [78.0378, -0.1445, 0.5601, 0.0231, 0.0172]
- biacromial [all]: 1.13 | 1.13 (-0.26) | resid SD Asian 1.39 | coefs[int,stat,kg,age] [21.0338, 0.0893, 0.0608, -0.0117]
- biacromial [w]: 1.13 | 1.13 (-0.25) | resid SD Asian 1.39 | coefs[int,stat,kg,age] [21.1768, 0.0885, 0.0612, -0.0125]
- biacromial [AsianOnly]: 1.24 | 1.11 (-0.01) | resid SD Asian 1.40 | coefs[int,stat,kg,age] [19.8972, 0.0896, 0.0858, -0.0295]
- biacromial +foot [all]: 1.12 | 1.11 (-0.34) | resid SD Asian 1.36 | coefs[int,stat,kg,age,foot] [19.9665, 0.0626, 0.0567, -0.0105, 0.2244]
- biacromial +foot [w]: 1.13 | 1.10 (-0.32) | resid SD Asian 1.36 | coefs[int,stat,kg,age,foot] [20.1898, 0.0613, 0.0569, -0.0113, 0.225]
- biacromial +foot [AsianOnly]: 1.28 | 1.08 (-0.01) | resid SD Asian 1.36 | coefs[int,stat,kg,age,foot] [18.4712, 0.0422, 0.0779, -0.0278, 0.3874]
### ANSUR male: Asian vs non-Asian prior coefficients [int, stature, kg, age]
- chest: Asian [85.245, -0.2, 0.642, 0.029] (mean 100.2) | non-Asian [99.059, -0.273, 0.601, 0.113] (mean 106.0)
- waist: Asian [82.049, -0.348, 0.736, 0.284] (mean 86.4) | non-Asian [94.01, -0.402, 0.757, 0.197] (mean 94.3)
- hip: Asian [78.101, -0.142, 0.56, 0.023] (mean 96.5) | non-Asian [83.572, -0.151, 0.543, -0.049] (mean 102.1)
- biacromial: Asian [19.897, 0.09, 0.086, -0.03] (mean 40.7) | non-Asian [20.944, 0.09, 0.061, -0.011] (mean 41.6)
### depth/breadth ratio, Asian vs non-Asian: chest 0.843 vs 0.878, waist 0.703 vs 0.728, hip 0.696 vs 0.711

# ANSUR II female
## a. side-view path (TRUE breadth+depth -> circumference). cells: MAE all | MAE Asian (bias)
- chest: n=2 13.45 | 12.48 (-12.48) | n_all=2.44 1.89 | 1.41 (+0.27) | n_w=2.44 1.89 | 1.40 (+0.25) | n_AsianOnly=2.43 (rows=71) 1.90 | 1.42 (+0.05) | linear_w 1.205*ell-3.23 1.90 | 1.40 (+0.23)
- waist: n=2 4.91 | 5.17 (-5.17) | n_all=2.26 1.43 | 1.28 (-0.54) | n_w=2.26 1.43 | 1.27 (-0.51) | n_AsianOnly=2.27 (rows=71) 1.50 | 1.22 (+0.01) | linear_w 1.020*ell+3.27 1.39 | 1.27 (-0.33)
- hip: n=2 8.95 | 8.43 (-8.43) | n_all=2.34 1.30 | 1.11 (+0.03) | n_w=2.34 1.30 | 1.11 (+0.03) | n_AsianOnly=2.34 (rows=71) 1.31 | 1.16 (-0.08) | linear_w 1.008*ell+8.18 1.17 | 1.13 (+0.44)
## b. no-side-view path (TRUE breadth + height/weight/age -> guessed depth -> circumference)
- chest: CURRENT depth 2.00 | 1.78 (-1.45) circ(n=2) 16.09 | 14.69 (-14.69)
    new[all] depth 1.37 | 1.21 (+0.43) circ 3.55 | 3.01 (+1.10)
    new[w] depth 1.37 | 1.20 (+0.40) circ 3.55 | 3.00 (+1.04)
    new[AsianOnly] depth 1.40 | 1.21 (+0.05) circ 3.59 | 3.04 (+0.28)
    coefs[w-pooled]: ratio = 0.872 +0.0115*(BMI-22) +0.0167*(age-30)/10 ; n_b=2.44 => base=0.872 bmiDepthGain=0.29 ageGain/decade=0.0192
    coefs[Asian-only]: ratio = 0.854 +0.0142*(BMI-22) +0.0102*(age-30)/10 ; n_b=2.43 => base=0.854 bmiDepthGain=0.37 ageGain/decade=0.0119
- waist: CURRENT depth 4.17 | 3.69 (+3.69) circ(n=2) 2.79 | 2.28 (+0.19)
    new[all] depth 1.22 | 1.16 (+0.20) circ 2.23 | 2.07 (-0.49)
    new[w] depth 1.22 | 1.16 (+0.19) circ 2.23 | 2.07 (-0.50)
    new[AsianOnly] depth 1.24 | 1.16 (+0.06) circ 2.26 | 2.08 (-0.46)
    coefs[w-pooled]: ratio = 0.683 +0.0066*(BMI-22) +0.0080*(age-30)/10 ; n_b=2.25 => base=0.683 bmiDepthGain=0.21 ageGain/decade=0.0116
    coefs[Asian-only]: ratio = 0.682 +0.0065*(BMI-22) -0.0063*(age-30)/10 ; n_b=2.26 => base=0.682 bmiDepthGain=0.21 ageGain/decade=-0.0093
- hip: CURRENT depth 5.16 | 4.62 (+4.62) circ(n=2) 2.97 | 2.36 (-1.84)
    new[all] depth 1.16 | 0.90 (+0.30) circ 2.01 | 1.27 (+0.31)
    new[w] depth 1.16 | 0.89 (+0.28) circ 2.01 | 1.26 (+0.26)
    new[AsianOnly] depth 1.18 | 0.90 (+0.05) circ 2.06 | 1.23 (+0.02)
    coefs[w-pooled]: ratio = 0.635 +0.0062*(BMI-22) +0.0029*(age-30)/10 ; n_b=2.33 => base=0.635 bmiDepthGain=0.21 ageGain/decade=0.0045
    coefs[Asian-only]: ratio = 0.629 +0.0072*(BMI-22) -0.0094*(age-30)/10 ; n_b=2.34 => base=0.629 bmiDepthGain=0.25 ageGain/decade=-0.0150
## c. demographic prior (ANSUR). cells: MAE all | MAE Asian (bias)
- chest [all]: 3.28 | 2.98 (+0.63) | resid SD Asian 3.84 | coefs[int,stat,kg,age] [93.4551, -0.3054, 0.6985, 0.1255]
- chest [w]: 3.28 | 2.96 (+0.53) | resid SD Asian 3.82 | coefs[int,stat,kg,age] [93.2255, -0.3072, 0.7077, 0.1206]
- chest [AsianOnly]: 3.58 | 3.02 (+0.06) | resid SD Asian 3.79 | coefs[int,stat,kg,age] [102.2394, -0.4333, 0.8961, 0.0877]
- chest +foot [all]: 3.25 | 3.03 (+0.84) | resid SD Asian 3.84 | coefs[int,stat,kg,age,foot] [96.2988, -0.2203, 0.7163, 0.1233, -0.7243]
- chest +foot [w]: 3.25 | 3.00 (+0.72) | resid SD Asian 3.83 | coefs[int,stat,kg,age,foot] [95.8424, -0.2267, 0.725, 0.1184, -0.6841]
- chest +foot [AsianOnly]: 3.58 | 3.09 (+0.10) | resid SD Asian 3.86 | coefs[int,stat,kg,age,foot] [104.0982, -0.4024, 0.9023, 0.0861, -0.2998]
- waist [all]: 3.73 | 3.19 (-0.54) | resid SD Asian 4.05 | coefs[int,stat,kg,age] [96.336, -0.4501, 0.8817, 0.1142]
- waist [w]: 3.74 | 3.20 (-0.49) | resid SD Asian 4.05 | coefs[int,stat,kg,age] [96.7856, -0.4534, 0.8827, 0.1163]
- waist [AsianOnly]: 3.91 | 3.46 (+0.04) | resid SD Asian 4.24 | coefs[int,stat,kg,age] [96.9366, -0.4905, 0.9624, 0.1654]
- waist +foot [all]: 3.68 | 3.33 (-0.25) | resid SD Asian 4.18 | coefs[int,stat,kg,age,foot] [100.2042, -0.3344, 0.906, 0.1111, -0.9852]
- waist +foot [w]: 3.68 | 3.33 (-0.24) | resid SD Asian 4.17 | coefs[int,stat,kg,age,foot] [100.2755, -0.346, 0.9057, 0.1133, -0.9123]
- waist +foot [AsianOnly]: 4.05 | 3.49 (+0.12) | resid SD Asian 4.31 | coefs[int,stat,kg,age,foot] [93.9163, -0.5407, 0.9522, 0.1679, 0.4871]
- hip [all]: 2.33 | 2.63 (+1.47) | resid SD Asian 2.96 | coefs[int,stat,kg,age] [84.3881, -0.1771, 0.6846, 0.0068]
- hip [w]: 2.33 | 2.51 (+1.27) | resid SD Asian 2.91 | coefs[int,stat,kg,age] [80.7112, -0.1556, 0.6858, 0.0067]
- hip [AsianOnly]: 2.58 | 2.19 (-0.07) | resid SD Asian 2.91 | coefs[int,stat,kg,age] [51.6975, 0.0327, 0.6463, 0.0193]
- hip +foot [all]: 2.32 | 2.74 (+1.59) | resid SD Asian 3.02 | coefs[int,stat,kg,age,foot] [85.9552, -0.1302, 0.6944, 0.0055, -0.3991]
- hip +foot [w]: 2.32 | 2.58 (+1.35) | resid SD Asian 2.96 | coefs[int,stat,kg,age,foot] [81.8628, -0.1202, 0.6934, 0.0057, -0.3011]
- hip +foot [AsianOnly]: 2.70 | 2.14 (-0.08) | resid SD Asian 2.85 | coefs[int,stat,kg,age,foot] [46.3729, -0.0558, 0.6283, 0.0239, 0.8587]
- biacromial [all]: 1.14 | 0.88 (-0.04) | resid SD Asian 1.14 | coefs[int,stat,kg,age] [13.9276, 0.1252, 0.0398, -0.0164]
- biacromial [w]: 1.14 | 0.89 (-0.04) | resid SD Asian 1.14 | coefs[int,stat,kg,age] [13.8908, 0.1254, 0.0402, -0.017]
- biacromial [AsianOnly]: 1.15 | 0.91 (-0.01) | resid SD Asian 1.17 | coefs[int,stat,kg,age] [13.1747, 0.1273, 0.0508, -0.0234]
- biacromial +foot [all]: 1.13 | 0.88 (-0.11) | resid SD Asian 1.11 | coefs[int,stat,kg,age,foot] [12.8924, 0.0942, 0.0333, -0.0156, 0.2637]
- biacromial +foot [w]: 1.13 | 0.88 (-0.11) | resid SD Asian 1.12 | coefs[int,stat,kg,age,foot] [12.8783, 0.0942, 0.0335, -0.0161, 0.2647]
- biacromial +foot [AsianOnly]: 1.15 | 0.93 (-0.02) | resid SD Asian 1.18 | coefs[int,stat,kg,age,foot] [10.9287, 0.0899, 0.0432, -0.0214, 0.3622]
### ANSUR female: Asian vs non-Asian prior coefficients [int, stature, kg, age]
- chest: Asian [102.239, -0.433, 0.896, 0.088] (mean 90.2) | non-Asian [93.693, -0.305, 0.693, 0.128] (mean 94.9)
- waist: Asian [96.937, -0.491, 0.962, 0.165] (mean 82.1) | non-Asian [96.042, -0.448, 0.881, 0.113] (mean 86.2)
- hip: Asian [51.698, 0.033, 0.646, 0.019] (mean 96.3) | non-Asian [86.654, -0.19, 0.683, 0.007] (mean 102.3)
- biacromial: Asian [13.175, 0.127, 0.051, -0.023] (mean 35.7) | non-Asian [13.95, 0.125, 0.04, -0.016] (mean 36.6)
### depth/breadth ratio, Asian vs non-Asian: chest 0.886 vs 0.920, waist 0.694 vs 0.710, hip 0.641 vs 0.659

# NHANES 2017-18 + 2021-23 prior (waist = just above iliac crest, hip = max buttock). cells: MAE all | MAE Asian (bias)
## NHANES male (n=3814, Asian=414)
- waist [all]: 3.75 | 3.58 (+0.17) | resid SD Asian 4.59 | coefs[int,stat,kg,age] [104.9034, -0.4615, 0.7654, 0.1982]
- waist [w]: 3.75 | 3.56 (+0.06) | resid SD Asian 4.56 | coefs[int,stat,kg,age] [102.4817, -0.4487, 0.7694, 0.1935]
- waist [AsianOnly]: 3.86 | 3.53 (+0.03) | resid SD Asian 4.54 | coefs[int,stat,kg,age] [91.841, -0.4014, 0.8095, 0.1798]
- hip [all]: 2.73 | 2.27 (-0.12) | resid SD Asian 2.93 | coefs[int,stat,kg,age] [86.493, -0.1748, 0.5623, -0.0325]
- hip [w]: 2.73 | 2.26 (-0.12) | resid SD Asian 2.93 | coefs[int,stat,kg,age] [85.4664, -0.1688, 0.5617, -0.0311]
- hip [AsianOnly]: 2.76 | 2.24 (-0.01) | resid SD Asian 2.93 | coefs[int,stat,kg,age] [77.6215, -0.1252, 0.5614, -0.0186]
### NHANES male: Asian vs non-Asian prior coefficients [int, stature, kg, age]
- waist: Asian [91.841, -0.401, 0.809, 0.18] (mean 93.7) | non-Asian [106.832, -0.472, 0.763, 0.202] (mean 102.1)
- hip: Asian [77.621, -0.125, 0.561, -0.019] (mean 99.0) | non-Asian [87.138, -0.178, 0.563, -0.033] (mean 105.5)
## NHANES female (n=4413, Asian=465)
- waist [all]: 4.65 | 3.88 (+0.63) | resid SD Asian 4.83 | coefs[int,stat,kg,age] [95.8594, -0.4093, 0.7729, 0.1664]
- waist [w]: 4.63 | 3.83 (+0.39) | resid SD Asian 4.82 | coefs[int,stat,kg,age] [94.1562, -0.4029, 0.7806, 0.1661]
- waist [AsianOnly]: 4.83 | 3.73 (+0.02) | resid SD Asian 4.78 | coefs[int,stat,kg,age] [86.4045, -0.3905, 0.8702, 0.1641]
- hip [all]: 3.49 | 3.17 (+1.46) | resid SD Asian 3.74 | coefs[int,stat,kg,age] [94.0057, -0.2559, 0.7059, 0.0335]
- hip [w]: 3.48 | 2.97 (+1.01) | resid SD Asian 3.70 | coefs[int,stat,kg,age] [89.1435, -0.2295, 0.7127, 0.03]
- hip [AsianOnly]: 3.58 | 2.71 (-0.00) | resid SD Asian 3.67 | coefs[int,stat,kg,age] [74.8058, -0.1502, 0.7383, 0.0145]
### NHANES female: Asian vs non-Asian prior coefficients [int, stature, kg, age]
- waist: Asian [86.405, -0.391, 0.87, 0.164] (mean 85.8) | non-Asian [97.554, -0.417, 0.767, 0.167] (mean 99.2)
- hip: Asian [74.806, -0.15, 0.738, 0.014] (mean 97.3) | non-Asian [98.263, -0.279, 0.7, 0.036] (mean 111.1)

# AIST/HQL 2003 (Japanese young adults, summary MEANS; cm) vs ANSUR-fitted shape
- JP male: height 169.7 cm, weight 63.4 kg, BMI 22.0
    chest: JP-implied n (reproduces mean circ from true b+d) = 2.32; CURRENT code from JP breadth only (n=2, guessed depth) = 83.2 (-5.6)
    chest: JP breadth 30.6 depth 21.0 ratio 0.686 (ANSUR all 0.877, ANSUR Asian 0.843; CURRENT-code ratio at JP BMI/age<30 0.720) | true circ 88.8 | n=2 pred 81.7 (-7.2) | n_w=2.51 pred 100.8 (+12.0)
    waist: JP-implied n (reproduces mean circ from true b+d) = 2.15; CURRENT code from JP breadth only (n=2, guessed depth) = 75.3 (+0.6)
    waist: JP breadth 26.2 depth 19.8 ratio 0.756 (ANSUR all 0.727, ANSUR Asian 0.703; CURRENT-code ratio at JP BMI/age<30 0.827) | true circ 74.6 | n=2 pred 72.5 (-2.1) | n_w=2.24 pred 76.4 (+1.8)
    hip: JP-implied n (reproduces mean circ from true b+d) = 2.06; CURRENT code from JP breadth only (n=2, guessed depth) = 88.0 (-2.7)
    hip: JP breadth 32.7 depth 24.2 ratio 0.740 (ANSUR all 0.710, ANSUR Asian 0.696; CURRENT-code ratio at JP BMI/age<30 0.700) | true circ 90.8 | n=2 pred 89.9 (-0.9) | n_w=2.32 pred 97.9 (+7.1)
- JP female: height 157.8 cm, weight 52.4 kg, BMI 21.0
    chest: JP-implied n (reproduces mean circ from true b+d) = 2.37; CURRENT code from JP breadth only (n=2, guessed depth) = 76.5 (-10.3)
    chest: JP breadth 27.4 depth 22.1 ratio 0.807 (ANSUR all 0.918, ANSUR Asian 0.886; CURRENT-code ratio at JP BMI/age<30 0.775) | true circ 86.9 | n=2 pred 77.9 (-9.0) | n_w=2.44 pred 90.5 (+3.7)
    waist: JP-implied n (reproduces mean circ from true b+d) = 2.15; CURRENT code from JP breadth only (n=2, guessed depth) = 65.8 (-1.5)
    waist: JP breadth 23.6 depth 17.8 ratio 0.751 (ANSUR all 0.709, ANSUR Asian 0.694; CURRENT-code ratio at JP BMI/age<30 0.763) | true circ 67.3 | n=2 pred 65.3 (-1.9) | n_w=2.26 pred 69.3 (+2.1)
    hip: JP-implied n (reproduces mean circ from true b+d) = 2.13; CURRENT code from JP breadth only (n=2, guessed depth) = 91.8 (+1.7)
    hip: JP breadth 33.6 depth 21.8 ratio 0.647 (ANSUR all 0.658, ANSUR Asian 0.641; CURRENT-code ratio at JP BMI/age<30 0.726) | true circ 90.0 | n=2 pred 88.0 (-2.0) | n_w=2.34 pred 96.5 (+6.5)

---
## 8. Additional Asian datasets (2026-11-19)

Script: `scripts/anthro-fit/fit_nhanes_asian_waist.py` (run: `python -I -X utf8 fit_nhanes_asian_waist.py <nhanes 2011-16 dir (BMX/DEMO G,H,I)> <nhanes 2017-23 dir (J,L)>`). Errors in cm, 5-fold out-of-fold.

**Result in one line: no open individual-level Asian dataset with breadth + depth + circumference exists (Tier G: none found). The only usable new data is the NHANES 2011-16 Asian oversample (waist only, 870 M / 869 F). Geometry constants (n, depth ratios) and hip/chest priors: NO CHANGE NEEDED. Waist prior coefficients change by < 1 cm in prediction (optional swap); the min-waist offset hack should move from -2/-5 to about -3.5/-6.5.**

### 8a. Datasets checked

| Dataset | Country | n (M/F) | Tier | Instrument | Licence | URL | Used? |
|---|---|---|---|---|---|---|---|
| NHANES 2011-12, 2013-14, 2015-16 (cycles G/H/I), `RIDRETH3==6`, age 18-65, waist non-null | US-resident Asian (no country field) | 870 / 869 | P (waist only; `BMXHIP` not collected before 2017) | tape, just above iliac crest | US gov, public domain | https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2011/DataFiles/BMX_G.xpt (+ DEMO_G; 2013/H, 2015/I) | **Y**, waist prior (same landmark as 2017-23, pooled) |
| NHANES 2017-18, 2021-23 | US Asian | 414 / 465 | P | tape | public domain | already in section 1 | Y (already used) |
| Size Korea (KATS), data.go.kr entry "인체치수조사 보고서" | Korea | report only | - | caliper + 3D scan | none stated on the data.go.kr page; entry is an XML-linked report, NOT individual rows | https://www.data.go.kr (search 사이즈코리아); raw 1D/3D data at sizekorea.kr (account + request) | N, no individual data without application |
| Mendeley "Body Measurements Datasets" (HUSM, Malaysia) | Malaysia (institution only) | 391 / 324, ages 1+ | - | tape, inches; values implausible (waist 14, height 52), no weight column | CC BY 4.0 | https://data.mendeley.com/datasets/bjv6c9pmp4/1 | N, no weight, quality unclear |
| Mendeley NMB-2017 (India, 7496 adults, waist/height/weight/age) | India | 7496 | P (South Asian waist) | unknown | CC0 | https://data.mendeley.com/datasets/twp8xw6p25/1 | N, the deposit's only file is `ObesityAnalysis.pdf`; raw rows not published |
| Mendeley "100 3D Body Scans" (Manchester; 50 White British / 50 Chinese women) | UK-resident | 0 / 100 | G-like (scans) | Size Stream 3D | CC BY-NC 3.0 | https://data.mendeley.com/datasets/xgrcptfpwt | N, non-commercial |
| BodyM (Amazon, silhouettes + 14 measurements, mixed ethnicity) | US | 2505 subjects | - | photos + tape | CC BY-NC 4.0 | https://registry.opendata.aws/bodym/ | N, non-commercial, not Asian-specific |
| IEEE IC 3DBP anthropometry | mixed | - | - | - | CC BY-NC-SA 4.0 | https://ieee-dataport.org/open-access/dataset-ieee-ic-3dbp-comaprative-analysis-anthropometric-methods | N, non-commercial |
| AIST/HQL 1991-92, 1997-98 individual data | Japan | hundreds | G (breadth + depth + circ, 3D scan) | 3D scan | release agreement / application | https://www.airc.aist.go.jp/dhrt/ | N, agreement required (8f) |
| PolygomHuman (Korean 3D scans) | Korea | large | G | 3D scan | "on contact" only | https://jseobyun.github.io/PolygomHumanPage | N, not freely available |
| NOMO-3d-400 scans (Zenodo, Tampere/NOMO) | Finland | 194 / 181 | G-like | 3D scan | CC BY 4.0 | https://zenodo.org/records/3735905 | N, not an Asian population |

Searched without finding other open individual-level Asian data: Korea data.go.kr, Japan AIST/e-Stat, and Mendeley / figshare / Zenodo / Kaggle / GitHub / government portals via web search. Effort was capped, so "not found" means not found by search, not proof of non-existence.

### 8b. Tier G (geometry): nothing new
No open dataset provides breadth + depth + circumference for the same Asian person. Section 3a/3b constants stand (n chest 2.35 / waist 2.15 / hip 2.10; bases 0.75 / 0.72 / 0.70; female chest x1.10, female hip x0.92; gain 0.25): **no change needed**. They remain based on ANSUR-Asian (117 M / 71 F, calipers) + AIST means (3D scan). The remaining gap is a 3D-scan Asian set (AIST individual data or Size Korea), both behind an application.

### 8c. Tier P: NHANES Asian waist, 2011-23 pooled
Holding out the 2011-16 rows against the CURRENT section 3c coefficients (fit on 2017-23 only) is an independent test.

| sex | n 2011-16 / 2017-23 | current coefs on 2011-16 (MAE, bias) | pooled 2011-23 5-fold OOF MAE / bias / resid SD | pooled coefs [int, stature, kg, age] |
|---|---|---|---|---|
| M | 870 / 416 | 3.03, -0.15 | 3.18 / +0.01 / 4.05 | [88.854, -0.3906, 0.8210, 0.1896] |
| F | 869 / 466 | 3.38, -0.94 | 3.46 / +0.00 / 4.45 | [86.788, -0.3875, 0.8786, 0.1462] |

OOF MAE on the 2017-23 rows alone: M 3.51, F 3.73 (vs 3.53 / 3.73 before), so no real accuracy gain; the pooled fit mainly lowers the residual SD (M 4.54 -> 4.05, F 4.78 -> 4.45, driven by the 2011-16 rows being less scattered) and removes the -0.94 cm female bias on the new cycles.

### 8d. Recommended prior table (same format as 3c; only the waist rows changed)

| target | source | sex | int | stature | kg | age | MAE Asian | resid SD |
|---|---|---|---|---|---|---|---|---|
| waist | NHANES Asian-only 2011-23 (n=1286) | M | 88.854 | -0.3906 | 0.8210 | 0.1896 | 3.18 | 4.05 |
| waist | NHANES Asian-only 2011-23 (n=1335) | F | 86.788 | -0.3875 | 0.8786 | 0.1462 | 3.46 | 4.45 |
| hip | NHANES Asian-only 2017-23 | M | 77.622 | -0.1252 | 0.5614 | -0.0186 | 2.24 | 2.93 |
| hip | NHANES Asian-only 2017-23 | F | 74.806 | -0.1502 | 0.7383 | 0.0145 | 2.71 | 3.67 |
| chest | ANSUR w | M | 96.775 | -0.2613 | 0.6049 | 0.107 | 2.56 | 3.11 |
| chest | ANSUR w | F | 93.226 | -0.3072 | 0.7077 | 0.1206 | 2.96 | 3.82 |
| biacromial | ANSUR w | M | 21.177 | 0.0885 | 0.0612 | -0.0125 | 1.13 | 1.39 |
| biacromial | ANSUR w | F | 13.891 | 0.1254 | 0.0402 | -0.0170 | 0.89 | 1.14 |

Materiality: intercepts move 3 cm but are offset by the other terms; on the AIST mean person the prediction changes M 79.5 -> 79.4, F 74.5 -> 75.3. **Optional swap, not material.** Asian waist MAE before/after: M 3.53 -> 3.18, F 3.73 -> 3.46 (different, larger sample, so not a like-for-like gain). Asian-only already has >= 300 rows per sex, so Asian-only is preferred per the rule; the Southeast 4 / East 3 / South 2 weighting does not apply (NHANES has no sub-region field, no hip/chest data added).

### 8e. Waist landmark offset (minimum waist vs iliac crest / navel)
No new open dataset records the natural/minimum waist. The only reference is still AIST minimum waist (n=48-49, young Japanese, means). Predicting the AIST mean person (M 169.7 cm / 63.4 kg, F 157.8 / 52.4, age 25 assumed):

| sex | true min waist | NHANES-Asian prior (iliac) | ANSUR-Asian prior (navel) |
|---|---|---|---|
| M | 74.6 | 79.4 (+4.8) | +2.0 |
| F | 67.3 | 75.3 (+8.0) | +7.2 |

The current hack (subtract 2 M / 5 F, SD x1.5) is on the low side for the NHANES-derived waist. **Recommendation: subtract 3.5 cm (M) and 6.5 cm (F), keep SD x1.5** (roughly the midpoint of the two sources, shaded down because applying the age/weight terms to a young slim mean person is an extrapolation). Low confidence (single n=48 sample, assumed age); replace when tape fixtures or AIST individual data exist.

### 8f. Login / application required (not attempted; steps for anh Khoi)
1. **WHO STEPS Vietnam 2021 / 2015**: see section 6 (register on the extranet.who.int NADA portal, request microdata). Best fit for VN waist/hip.
2. **AIST/HQL individual data 1991-92 and 1997-98 (Japan, 3D scan, breadth + depth + circumference = Tier G)**: start at https://www.airc.aist.go.jp/dhrt/ , find the body dimension database pages, fill in the release agreement (a copy circulates as `ReleaseAgreement_E.pdf`), and email the Digital Human Research Team (contact on the site). Ask explicitly whether derived coefficients in a commercial app are allowed.
3. **Size Korea raw data (Tier G, best candidate)**: https://sizekorea.kr -> sign up -> human body data download request (1D direct + 3D measures); Size Korea Center phone 02-2052-7778~7779. Confirm commercial derived-use terms. (The site failed TLS verification from my fetcher, so terms were not read.)
4. **KNHANES (Korea; waist, weight, height, age, thousands of rows)**: https://knhanes.kdca.go.kr -> member sign-up -> raw data download. Tier P, no hip.
5. **CHARLS / CHNS (China)**: free registration (charls.pku.edu.cn; cpc.unc.edu/projects/china); waist, height, weight. Tier P.
6. **IFLS (Indonesia; waist + hip)**: register at RAND (IFLS data page). Tier P, Southeast Asian (weight 4).
7. **DHS / Thailand NHES and other national surveys**: application/registration (dhsprogram.com). Lower priority.
