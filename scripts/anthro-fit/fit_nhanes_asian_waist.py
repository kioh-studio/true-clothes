"""Section 8 add-on: Asian waist prior from NHANES 2011-2023 (all cycles with RIDRETH3==6 oversample; waist only, hip not measured before 2017).
Usage: python -I -X utf8 fit_nhanes_asian_waist.py <old_dir(G,H,I)> <new_dir(J,L)>   cm; 5-fold OOF; same folds rule as fit_ansur.py"""
import sys, numpy as np, pandas as pd
def load(d, sufs):
    fr = []
    for s in sufs:
        b = pd.read_sas(f"{d}/BMX_{s}.xpt", format='xport'); m = pd.read_sas(f"{d}/DEMO_{s}.xpt", format='xport')
        x = b[['SEQN', 'BMXHT', 'BMXWT', 'BMXWAIST']].merge(m[['SEQN', 'RIAGENDR', 'RIDAGEYR', 'RIDRETH3']], on='SEQN').dropna()
        x['cyc'] = s; fr.append(x)
    x = pd.concat(fr); x = x[(x.RIDAGEYR.between(18, 65)) & (x.RIDRETH3 == 6)]
    return x.rename(columns=dict(BMXHT='h', BMXWT='kg', BMXWAIST='w', RIDAGEYR='age')).assign(sex=lambda t: t.RIAGENDR.map({1: 'M', 2: 'F'}))
def ols(X, y):
    X = np.c_[np.ones(len(X)), X]; return np.linalg.lstsq(X, y, rcond=None)[0]
def pr(c, X): return c[0] + X @ c[1:]
def oof(X, y):
    o = np.empty(len(y)); p = np.random.RandomState(0).permutation(len(y))
    for k in range(5):
        te = p[k::5]; tr = np.setdiff1d(p, te); o[te] = pr(ols(X[tr], y[tr]), X[te])
    return o
old, new = load(sys.argv[1], 'GHI'), load(sys.argv[2], 'JL')
CUR = {'M': [91.841, -0.4014, 0.8095, 0.1798], 'F': [86.405, -0.3905, 0.8702, 0.1641]}  # section 3c (2017-23 Asian only)
JP = {'M': (169.7, 63.4, 25, 74.6), 'F': (157.8, 52.4, 25, 67.3)}  # AIST means, true MINIMUM waist
for sx in 'MF':
    a, b = old[old.sex == sx], new[new.sex == sx]; al = pd.concat([a, b])
    X = lambda t: t[['h', 'kg', 'age']].values
    print(f"## {sx}: n 2011-16={len(a)} 2017-23={len(b)} pooled={len(al)}")
    c = np.array(CUR[sx]); print(f"  CURRENT coefs on 2011-16 rows (independent hold-out): MAE {np.abs(c[0]+X(a)@c[1:]-a.w).mean():.2f} bias {(c[0]+X(a)@c[1:]-a.w).mean():+.2f}")
    e = oof(X(al), al.w.values) - al.w.values
    cf = ols(X(al), al.w.values); res = al.w.values - (cf[0] + X(al) @ cf[1:])
    print(f"  POOLED 2011-23 OOF: MAE {np.abs(e).mean():.2f} bias {e.mean():+.2f} SD {e.std():.2f} | MAE on 2017-23 rows only {np.abs(e[len(a):]).mean():.2f}")
    print(f"  coefs [int,stat,kg,age] {np.round(cf, 4).tolist()}  (sd-resid {res.std():.2f}, mean waist {al.w.mean():.1f})")
    h, kg, ag, tw = JP[sx]; pw = cf[0] + cf[1] * h + cf[2] * kg + cf[3] * ag
    pc = c[0] + c[1] * h + c[2] * kg + c[3] * ag
    print(f"  AIST mean person (true min waist {tw}): new prior {pw:.1f} (+{pw-tw:.1f}) | current prior {pc:.1f} (+{pc-tw:.1f})")
