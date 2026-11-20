"""Calibrate landmarksToMeasurements geometry constants on ANSUR II + NHANES (+AIST summary check).
Usage: python -I -X utf8 fit_ansur.py <ansur_dir> <nhanes_dir> <aist_2003.txt> <out.md>
Errors in cm. 5-fold out-of-fold (each row held out once = 5 x 20% splits). Asian rows weighted 3x in 'w' fits.
Cells read: MAE all | MAE Asian (Asian bias)."""
import sys, re, numpy as np, pandas as pd
from scipy.optimize import minimize_scalar

R = {'chest': ('chestcircumference', 'chestbreadth', 'chestdepth'),
     'waist': ('waistcircumference', 'waistbreadth', 'waistdepth'),
     'hip':   ('buttockcircumference', 'hipbreadth', 'buttockdepth')}
WA = 3.0  # Asian sample weight (VN=4 would apply if STEPS data were available)

# ---- faithful port of TS (Ramanujan at n==2, else Simpson 64 steps) ----
def ramanujan(a, b):
    h = (a - b) ** 2 / (a + b) ** 2
    return np.pi * (a + b) * (1 + 3 * h / (10 + np.sqrt(4 - 3 * h)))
def superellipse(a, b, n, steps=64):
    if n == 2: return ramanujan(np.atleast_1d(a), np.atleast_1d(b))
    t = np.clip(np.linspace(0, np.pi / 2, steps + 1), 1e-7, np.pi / 2 - 1e-7)
    c, s = np.cos(t), np.sin(t); a = np.atleast_1d(a)[:, None]; b = np.atleast_1d(b)[:, None]
    f = np.hypot(-a * (2 / n) * s * c ** (2 / n - 1), b * (2 / n) * s ** (2 / n - 1) * c)
    w = np.ones(steps + 1); w[1:-1:2] = 4; w[2:-1:2] = 2
    return 4 * (np.pi / 2 / steps) / 3 * (f * w).sum(1)
BASE = dict(chest=0.72, waist=0.78, hip=0.70)
def cur_ratio(reg, sex, bmi, age):
    r = BASE[reg] * ({'chest': 1.10, 'waist': 1, 'hip': 1.06}[reg] if sex == 'female' else {'chest': 1, 'waist': 1.06, 'hip': 1}[reg])
    f = np.clip(1 + 0.5 * (bmi - 22) / 22, 0.8, 1.3)
    if reg == 'waist': f = f * np.clip(1 + np.maximum(age - 30, 0) / 10 * 0.015, 1, 1.06)
    return np.clip(r * f, 0.55, 0.95)

# ---- helpers ----
def wols(X, y, w):
    X = np.c_[np.ones(len(X)), X]; s = np.sqrt(w)
    c = np.linalg.lstsq(X * s[:, None], y * s, rcond=None)[0]
    return c, (lambda Z: np.c_[np.ones(len(Z)), Z] @ c)
def folds(n, k=5):
    p = np.random.RandomState(0).permutation(n); return [p[i::k] for i in range(k)]
def oof(n, fit, pred, w, asian, asian_only=False):
    """fit(idx,w)->params ; pred(params,idx)->array. Returns OOF preds."""
    out = np.full(n, np.nan)
    for te in folds(n):
        tr = np.setdiff1d(np.arange(n), te)
        if asian_only: tr = tr[asian[tr]]
        out[te] = pred(fit(tr, w[tr]), te)
    return out
def rep(err, asian):
    ea = err[asian]
    return f"{np.abs(err).mean():.2f} | {np.abs(ea).mean():.2f} ({ea.mean():+.2f})"
def fit_n(Ab, Bd, Cc, ww):
    return minimize_scalar(lambda k: (ww * np.abs(superellipse(Ab, Bd, k) - Cc)).sum() / ww.sum(), bounds=(1.5, 4), method='bounded').x

out = []
def P(s=""): print(s); out.append(s)
A_dir, N_dir, AIST, OUT = sys.argv[1:5]

def load_ansur(sex):
    df = pd.read_csv(f"{A_dir}/ANSUR_II_{sex.upper()}_Public.csv", encoding='latin-1')
    need = [c for t in R.values() for c in t] + ['weightkg', 'stature', 'Age', 'footlength', 'biacromialbreadth', 'DODRace']
    df = df.dropna(subset=need).reset_index(drop=True)
    d = pd.DataFrame(dict(h=df.stature / 10, kg=df.weightkg / 10, age=df.Age, foot=df.footlength / 10, bi=df.biacromialbreadth / 10,
                          asian=(df.DODRace == 4).values))
    for r, (c, b, dd) in R.items(): d[r], d[r + '_b'], d[r + '_d'] = df[c] / 10, df[b] / 10, df[dd] / 10
    d['bmi'] = d.kg / (d.h / 100) ** 2; return d
def load_nhanes():
    fr = []
    for suf in 'JL':
        b = pd.read_sas(f"{N_dir}/BMX_{suf}.xpt", format='xport'); dm = pd.read_sas(f"{N_dir}/DEMO_{suf}.xpt", format='xport')
        fr.append(b[['SEQN', 'BMXHT', 'BMXWT', 'BMXWAIST', 'BMXHIP']].merge(dm[['SEQN', 'RIAGENDR', 'RIDAGEYR', 'RIDRETH3']], on='SEQN'))
    m = pd.concat(fr).dropna(); m = m[(m.RIDAGEYR >= 18) & (m.RIDAGEYR <= 65)]
    d = pd.DataFrame(dict(h=m.BMXHT, kg=m.BMXWT, age=m.RIDAGEYR, waist=m.BMXWAIST, hip=m.BMXHIP, asian=(m.RIDRETH3 == 6).values,
                          sex=m.RIAGENDR.map({1: 'male', 2: 'female'}).values))
    d['bmi'] = d.kg / (d.h / 100) ** 2; return d.reset_index(drop=True)
NH = load_nhanes()

P("# Sample sizes")
SEX = {}
for sex in ['male', 'female']:
    SEX[sex] = load_ansur(sex); nh = NH[NH.sex == sex]
    P(f"- {sex}: ANSUR n={len(SEX[sex])} (Asian {SEX[sex].asian.sum()}); NHANES 2017-18+2021-23 adults 18-65 n={len(nh)} (Asian {nh.asian.sum()})")

def prior_block(d, targets, feats, label):
    n = len(d); asian = d.asian.values; w = np.where(asian, WA, 1.0)
    for reg, col in targets.items():
        y = d[col].values
        for useF in feats:
            X = np.c_[d.h, d.kg, d.age] if not useF else np.c_[d.h, d.kg, d.age, d.foot]
            for name, ww, ao in [('all', np.ones(n), False), ('w', w, False), ('AsianOnly', np.ones(n), True)]:
                fit = lambda idx, wt: wols(X[idx], y[idx], wt)[0]
                pr = lambda c, idx: c[0] + X[idx] @ c[1:]
                e = oof(n, fit, pr, ww, asian, ao) - y
                co = wols(X, y, w)[0] if name == 'w' else (wols(X[asian], y[asian], np.ones(asian.sum()))[0] if ao else wols(X, y, np.ones(n))[0])
                P(f"- {reg}{' +foot' if useF else ''} [{name}]: {rep(e,asian)} | resid SD Asian {e[asian].std():.2f} | coefs[int,stat,kg,age{',foot' if useF else ''}] {np.round(co,4).tolist()}")
    P(f"### {label}: Asian vs non-Asian prior coefficients [int, stature, kg, age]")
    X = np.c_[d.h, d.kg, d.age]
    for reg, col in targets.items():
        y = d[col].values
        ca = wols(X[asian], y[asian], np.ones(asian.sum()))[0]; cn = wols(X[~asian], y[~asian], np.ones((~asian).sum()))[0]
        P(f"- {reg}: Asian {np.round(ca,3).tolist()} (mean {y[asian].mean():.1f}) | non-Asian {np.round(cn,3).tolist()} (mean {y[~asian].mean():.1f})")

for sex in ['male', 'female']:
    d = SEX[sex]; n = len(d); asian = d.asian.values; w = np.where(asian, WA, 1.0)
    P(f"\n# ANSUR II {sex}")
    P("## a. side-view path (TRUE breadth+depth -> circumference). cells: MAE all | MAE Asian (bias)")
    for reg in R:
        Cc, Ab, Bd = d[reg].values, d[reg + '_b'].values / 2, d[reg + '_d'].values / 2
        fn = lambda idx, ww: fit_n(Ab[idx], Bd[idx], Cc[idx], ww)
        pn = lambda k, idx: superellipse(Ab[idx], Bd[idx], k)
        e2 = ramanujan(Ab, Bd) - Cc
        eA = oof(n, fn, pn, np.ones(n), asian) - Cc
        eW = oof(n, fn, pn, w, asian) - Cc
        eO = oof(n, fn, pn, np.ones(n), asian, True) - Cc
        ell = ramanujan(Ab, Bd)
        lf = lambda idx, ww: wols(ell[idx, None], Cc[idx], ww)[0]
        lp = lambda c, idx: c[0] + c[1] * ell[idx]
        eL = oof(n, lf, lp, w, asian) - Cc
        ai = np.where(asian)[0]; al = np.arange(n)
        cL = lf(al, w)
        P(f"- {reg}: n=2 {rep(e2,asian)} | n_all={fn(al,np.ones(n)):.2f} {rep(eA,asian)} | n_w={fn(al,w):.2f} {rep(eW,asian)} | n_AsianOnly={fn(ai,np.ones(len(ai))):.2f} (rows={len(ai)}) {rep(eO,asian)} | linear_w {cL[1]:.3f}*ell{cL[0]:+.2f} {rep(eL,asian)}")
    P("## b. no-side-view path (TRUE breadth + height/weight/age -> guessed depth -> circumference)")
    for reg in R:
        Cc, Bw, Dp = d[reg].values, d[reg + '_b'].values, d[reg + '_d'].values
        X = np.c_[d.bmi - 22, np.maximum(d.age - 30, 0) / 10]
        cur = cur_ratio(reg, sex, d.bmi.values, d.age.values)
        P(f"- {reg}: CURRENT depth {rep(cur*Bw-Dp,asian)} circ(n=2) {rep(ramanujan(Bw/2,Bw/2*cur)-Cc,asian)}")
        def fit(idx, ww):
            c, f = wols(X[idx], (Dp / Bw)[idx], ww); r = f(X[idx])
            k = minimize_scalar(lambda k: (ww * np.abs(superellipse(Bw[idx] / 2, Bw[idx] / 2 * r, k) - Cc[idx])).sum() / ww.sum(), bounds=(1.5, 4), method='bounded').x
            return c, k
        for name, ww, ao in [('all', np.ones(n), False), ('w', w, False), ('AsianOnly', np.ones(n), True)]:
            r = np.full(n, np.nan); cc = np.full(n, np.nan)
            for te in folds(n):
                tr = np.setdiff1d(np.arange(n), te)
                if ao: tr = tr[asian[tr]]
                p = fit(tr, ww[tr]); r[te] = p[0][0] + X[te] @ p[0][1:]
                cc[te] = superellipse(Bw[te] / 2, Bw[te] / 2 * r[te], p[1])
            P(f"    new[{name}] depth {rep(r*Bw-Dp,asian)} circ {rep(cc-Cc,asian)}")
        for tag, idx, ww in [('w-pooled', np.arange(n), w), ('Asian-only', np.where(asian)[0], np.ones(asian.sum()))]:
            c, k = fit(idx, ww)
            P(f"    coefs[{tag}]: ratio = {c[0]:.3f} {c[1]:+.4f}*(BMI-22) {c[2]:+.4f}*(age-30)/10 ; n_b={k:.2f} => base={c[0]:.3f} bmiDepthGain={c[1]*22/c[0]:.2f} ageGain/decade={c[2]/c[0]:.4f}")
    P("## c. demographic prior (ANSUR). cells: MAE all | MAE Asian (bias)")
    prior_block(d, {'chest': 'chest', 'waist': 'waist', 'hip': 'hip', 'biacromial': 'bi'}, (0, 1), f"ANSUR {sex}")
    P("### depth/breadth ratio, Asian vs non-Asian: " + ", ".join(f"{r} {(d[r+'_d']/d[r+'_b'])[asian].mean():.3f} vs {(d[r+'_d']/d[r+'_b'])[~asian].mean():.3f}" for r in R))

P("\n# NHANES 2017-18 + 2021-23 prior (waist = just above iliac crest, hip = max buttock). cells: MAE all | MAE Asian (bias)")
for sex in ['male', 'female']:
    d = NH[NH.sex == sex].reset_index(drop=True)
    P(f"## NHANES {sex} (n={len(d)}, Asian={d.asian.sum()})")
    prior_block(d, {'waist': 'waist', 'hip': 'hip'}, (0,), f"NHANES {sex}")

# ---------- AIST summary check ----------
P("\n# AIST/HQL 2003 (Japanese young adults, summary MEANS; cm) vs ANSUR-fitted shape")
lines = open(AIST, encoding='utf-8').read().split('\n'); cut = next(i for i, l in enumerate(lines) if '青年女性群' in l)
def grab(seg, no):
    for l in seg:
        if re.match(rf'^(?:[^\d\s]+\s+)?{no} ', l):
            try: v = float(l.split()[-8:][1]); return v if no == 1 else v / 10
            except (ValueError, IndexError): continue
items = dict(h=2, kg=1, chest_b=29, chest_d=41, chest=56, waist_b=31, waist_d=44, waist=59, hip_b=36, hip_d=47, hip=62)
for sex, seg in [('male', lines[:cut]), ('female', lines[cut:])]:
    j = {k: grab(seg, v) for k, v in items.items()}; bmi = j['kg'] / (j['h'] / 100) ** 2
    d = SEX[sex]; ww = np.where(d.asian.values, WA, 1.0)
    P(f"- JP {sex}: height {j['h']:.1f} cm, weight {j['kg']:.1f} kg, BMI {bmi:.1f}")
    for reg in R:
        b, dp, c = j[reg + '_b'], j[reg + '_d'], j[reg]
        ar = d[reg + '_d'] / d[reg + '_b']
        k = fit_n(d[reg + '_b'].values / 2, d[reg + '_d'].values / 2, d[reg].values, ww)
        pk = float(superellipse(b / 2, dp / 2, k)[0]); p2 = float(ramanujan(b / 2, dp / 2))
        from scipy.optimize import brentq
        nj = brentq(lambda q: float(superellipse(b / 2, dp / 2, q)[0]) - c, 1.5, 4)
        cr = float(cur_ratio(reg, sex, bmi, 25)); cc_ = float(ramanujan(b / 2, b / 2 * cr))
        P(f"    {reg}: JP-implied n (reproduces mean circ from true b+d) = {nj:.2f}; CURRENT code from JP breadth only (n=2, guessed depth) = {cc_:.1f} ({cc_-c:+.1f})")
        P(f"    {reg}: JP breadth {b:.1f} depth {dp:.1f} ratio {dp/b:.3f} (ANSUR all {ar.mean():.3f}, ANSUR Asian {ar[d.asian].mean():.3f}; CURRENT-code ratio at JP BMI/age<30 {float(cur_ratio(reg, sex, bmi, 25)):.3f}) | true circ {c:.1f} | n=2 pred {p2:.1f} ({p2-c:+.1f}) | n_w={k:.2f} pred {pk:.1f} ({pk-c:+.1f})")
open(OUT, 'w', encoding='utf-8').write("\n".join(out))
