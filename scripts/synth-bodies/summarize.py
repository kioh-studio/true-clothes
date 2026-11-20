"""Summarise a generated set: python summarize.py SET_DIR"""
import json, glob, os, sys, numpy as np
d = sys.argv[1]; rows = []
for p in sorted(glob.glob(os.path.join(d, 'body_*'))):
    try:
        m = json.load(open(p + '/meta.json')); g = json.load(open(p + '/gt.json')); f = json.load(open(p + '/meta_full.json'))
        assert len(glob.glob(p + '/*_[0-2].jpg')) == 6
        rows.append((m, g, f))
    except Exception as e:
        print('INCOMPLETE', p, e)
print('bodies', len(rows), 'asianWeight3', sum(r[0]['asianWeight'] == 3 for r in rows), 'female', sum(r[0]['sex'] == 'female' for r in rows))
for sex in ('male', 'female'):
    s = [r for r in rows if r[0]['sex'] == sex]
    if not s: continue
    print(sex, len(s), 'H %.1f+-%.1f' % (np.mean([r[0]['heightCm'] for r in s]), np.std([r[0]['heightCm'] for r in s])),
          'BMI %.1f+-%.1f' % (np.mean([r[2]['actual']['bmi'] for r in s]), np.std([r[2]['actual']['bmi'] for r in s])))
for k in rows[0][1]:
    v = [r[1][k] for r in rows if k in r[1]]; print('%-24s mean %.1f sd %.1f min %.1f max %.1f' % (k, np.mean(v), np.std(v), min(v), max(v)))
print('bbox y0 min %.3f y1 max %.3f' % (min(r[2]['views'][v]['bbox_norm']['y0'] for r in rows for v in ('front', 'side')), max(r[2]['views'][v]['bbox_norm']['y1'] for r in rows for v in ('front', 'side'))))
print('dist range', min(r[2]['views']['front']['camera_distance_m'] for r in rows), max(r[2]['views']['front']['camera_distance_m'] for r in rows))
