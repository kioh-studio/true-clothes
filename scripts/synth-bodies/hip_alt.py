"""python hip_alt.py SET_DIR N : alternative hip GT (a current, b buttock-level single section, c max posterior protrusion/ISO 8559) -> gt_hip_alt.json per body + table."""
import numpy as np, math, sys, json, os
SET, N = sys.argv[1], int(sys.argv[2])

def hull_perim(P):
    P = sorted(set(map(tuple, np.round(P, 6))))
    if len(P) < 3: return float('nan')
    cr = lambda o, a, b: (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    lo = []
    for q in P:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], q) <= 0: lo.pop()
        lo.append(q)
    up = []
    for q in reversed(P):
        while len(up) >= 2 and cr(up[-2], up[-1], q) <= 0: up.pop()
        up.append(q)
    H = lo[:-1] + up[:-1]; return sum(math.dist(H[i], H[(i+1) % len(H)]) for i in range(len(H)))

rows = []
for i in range(N):
    d = os.path.join(SET, 'body_%04d' % i)
    z_ = np.load(d + '/rest_mesh.npz'); V = z_['V'].astype(float); armw = z_['armw'].astype(float); F = z_['F']
    m = json.load(open(d + '/meta_full.json')); hj = json.load(open(d + '/hip_joint.json'))
    crotch = m['landmarks']['crotch_z_m']; a_old = json.load(open(d + '/gt.json'))['body_hip']
    # edges + quad->edge map for connectivity
    ed = {}; quads_e = []
    for f in F:
        es = []
        for k in range(4):
            a, b = int(f[k]), int(f[(k+1) % 4]); key = (min(a, b), max(a, b))
            es.append(ed.setdefault(key, len(ed)))
        quads_e.append(es)
    E = np.array(sorted(ed, key=ed.get)); qe = np.array(quads_e)
    z0 = V[E[:, 0], 2]; z1 = V[E[:, 1], 2]; torso = (armw[E[:, 0]] < .5) & (armw[E[:, 1]] < .5)
    def sl(z):
        m_ = ((z0 - z) * (z1 - z) < 0) & torso; idx = np.where(m_)[0]
        a = V[E[idx, 0]]; b = V[E[idx, 1]]; t = ((z - a[:, 2]) / (b[:, 2] - a[:, 2]))[:, None]
        return idx, (a + t * (b - a))
    def ncomp(z):
        idx, _ = sl(z); cross = set(idx.tolist()); par = {e: e for e in cross}
        def find(x):
            while par[x] != x: par[x] = par[par[x]]; x = par[x]
            return x
        for q in qe:
            c = [e for e in q if e in cross]
            for e in c[1:]: par[find(e)] = find(c[0])
        from collections import Counter
        return sum(1 for v in Counter(find(e) for e in cross).values() if v >= 20)  # ignore tiny stray fragments
    def girth(z): return hull_perim(sl(z)[1][:, :2]) * 100
    zsA = np.arange(crotch + .02, crotch + .18, .004); gA = [girth(z) for z in zsA]; ia = int(np.nanargmax(gA))
    zsB = np.arange(crotch + .05, crotch + .15, .004); okB = [(z, girth(z)) for z in zsB if ncomp(z) == 1]
    b = max(okB, key=lambda t: t[1]) if okB else (float('nan'), float('nan'))
    # (c) level of max posterior (+Y) protrusion of non-arm vertices between crotch-5cm and crotch+25cm
    sel = (V[:, 2] > crotch - .05) & (V[:, 2] < crotch + .25) & (armw < .5)
    zc = float(V[sel][np.argmax(V[sel][:, 1]), 2]); c_g = girth(zc); c_n = ncomp(zc); P = sl(zc)[1]; c_w = (P[:, 0].max()-P[:, 0].min())*100; c_d = (P[:, 1].max()-P[:, 1].min())*100
    out = {'a_current_hull_max_cm': gA[ia], 'a_z_m': float(zsA[ia]), 'b_buttock_single_section_cm': b[1], 'b_z_m': b[0],
           'c_max_posterior_protrusion_cm': c_g, 'c_z_m': zc, 'c_n_sections': c_n, 'c_width_cm': c_w, 'c_depth_cm': c_d, 'crotch_z_m': crotch,
           'hip_joint_z_m': hj['hip_joint_z_m'], 'gt_json_hip_cm': a_old}
    json.dump(out, open(d + '/gt_hip_alt.json', 'w'), indent=1); rows.append(out)
rel = lambda k: np.array([r[k] - r['hip_joint_z_m'] for r in rows]) * 100
A = np.array([r['a_current_hull_max_cm'] for r in rows]); B = np.array([r['b_buttock_single_section_cm'] for r in rows]); C = np.array([r['c_max_posterior_protrusion_cm'] for r in rows])
print('id   a(cur)  b(btk1)  c(ISO)   | z-hipjoint cm: a    b    c  | crotch-hipjoint | c nsec')
for i, r in enumerate(rows):
    print('%02d  %6.1f  %6.1f  %6.1f   |  %+5.1f %+5.1f %+5.1f | %+5.1f | %d' % (i, r['a_current_hull_max_cm'], r['b_buttock_single_section_cm'], r['c_max_posterior_protrusion_cm'],
          (r['a_z_m']-r['hip_joint_z_m'])*100, (r['b_z_m']-r['hip_joint_z_m'])*100, (r['c_z_m']-r['hip_joint_z_m'])*100, (r['crotch_z_m']-r['hip_joint_z_m'])*100, r['c_n_sections']))
print('mean c width %.1f depth %.1f' % (np.mean([r['c_width_cm'] for r in rows]), np.mean([r['c_depth_cm'] for r in rows])))
print('mean a %.1f b %.1f c %.1f ; b-a %.1f c-a %.1f' % (np.nanmean(A), np.nanmean(B), np.nanmean(C), np.nanmean(B-A), np.nanmean(C-A)))
print('mean z rel hip joint (cm): a %.1f b %.1f c %.1f ; crotch %.1f' % (rel('a_z_m').mean(), np.nanmean(rel('b_z_m')), rel('c_z_m').mean(), rel('crotch_z_m').mean()))
