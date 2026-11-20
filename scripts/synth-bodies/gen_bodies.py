"""Synthetic body generator for the MIEN body-scan benchmark (Blender headless + MPFB2).

Run:  blender -b --factory-startup --python gen_bodies.py -- OUT_DIR START COUNT [SEED] [WIDTH]
Layout per body:  OUT_DIR/body_0007/{front.png, side.png, gt.json, meta.json, rest_mesh.npz}
Everything is deterministic from (SEED, index).
"""
import bpy, sys, os, json, math, random, time
import numpy as np
import addon_utils, bmesh
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index('--') + 1:]
OUT = argv[0]; START = int(argv[1]); COUNT = int(argv[2])
SEED = int(argv[3]) if len(argv) > 3 else 1234
RW = int(argv[4]) if len(argv) > 4 else 1200
RH = RW * 4 // 3  # 3:4 portrait = expo-camera still ratio
DENSITY = 985.0  # kg/m3, living body incl. lungs (assumption, see report)
ASIAN_FRAC = 0.9

addon_utils.enable("bl_ext.blender_org.mpfb", default_set=True, persistent=False)
from bl_ext.blender_org.mpfb.services.humanservice import HumanService


# ---------------------------------------------------------------- sampling
def clipn(rng, mu, sd, lo, hi):
    return float(min(hi, max(lo, rng.gauss(mu, sd))))


def sample_params(rng):
    male = rng.random() < 0.5
    if rng.random() < ASIAN_FRAC:
        asian = rng.uniform(0.7, 1.0)
    else:
        asian = rng.uniform(0.0, 0.5)
    rest = 1 - asian
    split = rng.random()
    cauc, afr = rest * split, rest * (1 - split)
    if male:
        h = clipn(rng, 165, 7, 165 - 2.5 * 7, 165 + 2.5 * 7); bmi = clipn(rng, 24, 3.5, 17, 35)
    else:
        h = clipn(rng, 155, 6, 155 - 2.5 * 6, 155 + 2.5 * 6); bmi = clipn(rng, 23, 4, 17, 35)
    age = rng.uniform(18, 60)
    return dict(
        sex='male' if male else 'female', age_years=age, asian=asian, caucasian=cauc, african=afr,
        target_height_cm=h, target_bmi=bmi, target_mass_kg=bmi * (h / 100) ** 2,
        muscle=float(min(1, max(0, rng.gauss(0.55 if male else 0.42, 0.12)))),
        proportions=float(min(0.8, max(0.2, rng.gauss(0.5, 0.08)))),
        cupsize=float(min(1, max(0, rng.gauss(0.5, 0.15)))), firmness=float(min(1, max(0, rng.gauss(0.5, 0.15)))),
        variant=rng.choice(['skin', 'skin', 'tight']),
    )


def age_slider(y):  # MPFB: 1y->0, 11y->.1875, 25y->.5, 90y->1
    if y < 11: return 0.1875 * (y - 1) / 10
    if y < 25: return 0.1875 + (y - 11) / 14 * (0.5 - 0.1875)
    return 0.5 + (y - 25) / 65 * 0.5


def macro(p, hs, ws):
    return {"gender": 1.0 if p['sex'] == 'male' else 0.0, "age": age_slider(p['age_years']),
            "muscle": p['muscle'], "weight": ws, "height": hs, "proportions": p['proportions'],
            "cupsize": p['cupsize'], "firmness": p['firmness'],
            "race": {"asian": p['asian'], "caucasian": p['caucasian'], "african": p['african']}}


# ---------------------------------------------------------------- build / measure
# MPFB's macro 'weight' slider saturates near BMI ~24 for Asian bodies, so heavier bodies add local
# fat targets (belly/torso/hip/buttocks/limb fat) driven by a single 'fat' in [0,1].
FAT_TARGETS = [('stomach/stomach-pregnant-incr', .9), ('torso/torso-scale-depth-incr', .6),
               ('hip/hip-scale-horiz-incr', .6), ('hip/hip-scale-depth-incr', .6), ('buttocks/buttocks-volume-incr', 1.0),
               ('legs/l-upperleg-fat-incr', .8), ('legs/r-upperleg-fat-incr', .8), ('legs/l-lowerleg-fat-incr', .6), ('legs/r-lowerleg-fat-incr', .6),
               ('arms/l-upperarm-fat-incr', .8), ('arms/r-upperarm-fat-incr', .8), ('arms/l-lowerarm-fat-incr', .5), ('arms/r-lowerarm-fat-incr', .5)]


_FAT_PATHS = {}


def build_human(p, hs, ws, fat):
    from bl_ext.blender_org.mpfb.services.targetservice import TargetService
    ob = HumanService.create_human(macro_detail_dict=macro(p, hs, ws), feet_on_ground=False)
    if fat > 0:
        for name, w in FAT_TARGETS:
            nm = name.split('/')[1]
            if nm not in _FAT_PATHS: _FAT_PATHS[nm] = TargetService.target_full_path(nm)
            TargetService.load_target(ob, _FAT_PATHS[nm], weight=w * fat, name=nm)
    co = shape_mixed_coords(ob)
    bset = np.zeros(len(co), bool); bset[body_verts(ob)] = True
    ob.location = (0, 0, -co[bset, 2].min())  # feet on ground
    for o in bpy.context.view_layer.objects: o.select_set(False)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    return ob

def body_verts(ob):
    vg = ob.vertex_groups['body'].index
    return [v.index for v in ob.data.vertices if any(g.group == vg for g in v.groups)]


def shape_mixed_coords(ob):
    """Vertex coords with shape keys mixed (ignoring modifiers)."""
    n = len(ob.data.vertices)
    arr = np.empty(n * 3, dtype=np.float32)
    ob.data.vertices.foreach_get('co', arr)
    co = arr.reshape(n, 3).astype(np.float64)
    sk = ob.data.shape_keys
    if sk:
        base = sk.reference_key
        out = co.copy()
        for k in sk.key_blocks:
            if k == base or k.mute or k.value == 0: continue
            kc = np.empty(n * 3, dtype=np.float32); k.data.foreach_get('co', kc)
            out += (kc.reshape(n, 3) - co) * k.value
        co = out
    return co


def quick_eval(p, hs, ws, fat=0.0):
    ob = build_human(p, hs, ws, fat)
    co = shape_mixed_coords(ob)
    bi = body_verts(ob)
    bset = np.zeros(len(co), bool); bset[bi] = True
    z = co[bset, 2]
    stat = z.max() - z.min()
    # volume of body-group faces (closed enough; holes tiny)
    me = ob.data
    vol = 0.0
    for poly in me.polygons:
        vs = poly.vertices
        if not all(bset[i] for i in vs): continue
        a = co[vs[0]]
        for k in range(1, len(vs) - 1):
            b = co[vs[k]]; c = co[vs[k + 1]]
            vol += np.dot(a, np.cross(b, c)) / 6.0
    bpy.data.objects.remove(ob, do_unlink=True)
    return stat * 100, abs(vol) * DENSITY


def newton(p, f, x0, tgt, lo=0.0, hi=1.0, d=0.15):
    """2-var Newton on f(x)->(stature_cm, mass_kg)."""
    c0 = np.array(f(*x0)); J = np.zeros((2, 2))
    for k in range(2):
        x = list(x0); x[k] += d; J[:, k] = (np.array(f(*x)) - c0) / d
    x = np.array(x0, float); cur = c0
    for it in range(5):
        x = np.clip(x + np.linalg.solve(J, tgt - cur), lo, hi)
        cur = np.array(f(*x))
        if abs(cur[0] - tgt[0]) < 0.4 and abs(cur[1] - tgt[1]) < 0.8: break
    return x, cur


def solve(p):
    tgt = np.array([p['target_height_cm'], p['target_mass_kg']])
    x, cur = newton(p, lambda h, w: quick_eval(p, h, w), (0.5, 0.5), tgt)
    hs, ws, fat = float(x[0]), float(x[1]), 0.0
    if ws > 0.995 and tgt[1] - cur[1] > 1.5:  # macro weight saturated -> add local fat
        x, cur = newton(p, lambda h, f: quick_eval(p, h, 1.0, f), (hs, 0.5), tgt, d=0.2)
        hs, ws, fat = float(x[0]), 1.0, float(x[1])
    return hs, ws, fat, float(cur[0]), float(cur[1])


# ---------------------------------------------------------------- geometry helpers
def hull_perimeter(pts):
    P = sorted(set(map(tuple, np.round(pts, 6))))
    if len(P) < 3: return 0.0
    def cross(o, a, b): return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    lo = []
    for q in P:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], q) <= 0: lo.pop()
        lo.append(q)
    up = []
    for q in reversed(P):
        while len(up) >= 2 and cross(up[-2], up[-1], q) <= 0: up.pop()
        up.append(q)
    H = lo[:-1] + up[:-1]
    return sum(math.dist(H[i], H[(i + 1) % len(H)]) for i in range(len(H)))


class Mesh:
    def __init__(self, V, F, armw):
        self.V = V; self.F = F; self.armw = armw
        e = set()
        for f in F:
            for k in range(len(f)):
                a, b = f[k], f[(k + 1) % len(f)]
                e.add((min(a, b), max(a, b)))
        self.E = np.array(sorted(e))
        self.Ez0 = V[self.E[:, 0], 2]; self.Ez1 = V[self.E[:, 1], 2]
        self.torso_edge = (armw[self.E[:, 0]] < 0.5) & (armw[self.E[:, 1]] < 0.5)

    def slice(self, z, torso_only=True, center_only=None):
        m = (self.Ez0 - z) * (self.Ez1 - z) < 0
        if torso_only: m &= self.torso_edge
        E = self.E[m]
        a = self.V[E[:, 0]]; b = self.V[E[:, 1]]
        t = ((z - a[:, 2]) / (b[:, 2] - a[:, 2]))[:, None]
        return a + t * (b - a)

    def girth(self, z):
        pts = self.slice(z)
        return hull_perimeter(pts[:, :2]) * 100 if len(pts) > 3 else float('nan')


def measure_gt(M, H, joints):
    """M: rest-pose Mesh (m). H stature (m). joints: dict name->np.array world rest."""
    # crotch: lowest z above which the sagittal centre line (|x|<1cm) is crossed
    crotch = None
    for z in np.arange(0.30 * H, 0.60 * H, 0.002):
        pts = M.slice(z, torso_only=False)
        if len(pts) and np.any(np.abs(pts[:, 0]) < 0.01):
            crotch = z; break
    zs = lambda lo, hi, n=60: np.linspace(lo, hi, n)
    bz = zs(0.68 * H, 0.78 * H); bg = [M.girth(z) for z in bz]
    wz = zs(0.57 * H, 0.71 * H); wg = [M.girth(z) for z in wz]
    hz = zs(crotch + 0.02, crotch + 0.18); hg = [M.girth(z) for z in hz]
    ib = int(np.nanargmax(bg)); iw = int(np.nanargmin(wg)); ih = int(np.nanargmax(hg))
    # shoulder (acromion level = shoulder01 head z): lateral-most skin each side
    out = {}
    zsh = float(np.mean([joints['shoulder01.L'][2], joints['shoulder01.R'][2]]))
    pts = M.slice(zsh, torso_only=False)
    xl = pts[:, 0].max(); xr = pts[:, 0].min()
    acr = {}
    for side, sx in (('L', xl), ('R', xr)):
        sel = pts[np.argmin(np.abs(pts[:, 0] - sx))]
        acr[side] = sel
    shoulder = (xl - xr) * 100
    sleeve = []
    for s in 'LR':
        a = acr[s]; el = joints['lowerarm01.' + s]; wr = joints['wrist.' + s]
        sleeve.append((np.linalg.norm(a - el) + np.linalg.norm(el - wr)) * 100)
    neck_z = joints['neck01'][2]
    gt = {
        'body_bust': bg[ib], 'body_waist': wg[iw], 'body_hip': hg[ih],
        'body_shoulder_width': shoulder, 'body_sleeve_length': float(np.mean(sleeve)),
        'body_inseam': crotch * 100, 'body_upper_body_length': (neck_z - wz[iw]) * 100,
    }
    lm = {'bust_z_m': float(bz[ib]), 'waist_z_m': float(wz[iw]), 'hip_z_m': float(hz[ih]), 'crotch_z_m': float(crotch),
          'shoulder_z_m': zsh, 'neck_base_z_m': float(neck_z), 'sleeve_LR_cm': [float(x) for x in sleeve]}
    return {k: round(float(v), 2) for k, v in gt.items()}, lm


# ---------------------------------------------------------------- scene
def clear_scene():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        if m.users == 0: bpy.data.meshes.remove(m)


def mat(name, rgb, rough=0.6, sss=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rough
    if sss and 'Subsurface Weight' in b.inputs: b.inputs['Subsurface Weight'].default_value = sss
    return m


def srgb2lin(c): return [(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c]


def set_arms(rig, target_abd_deg, forward_deg=0.0):
    for pb in rig.pose.bones:
        pb.rotation_mode = 'XYZ'; pb.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    for s, sgn in (('L', 1), ('R', -1)):
        pb = rig.pose.bones['upperarm01.' + s]
        v = pb.tail - pb.head
        rest = math.degrees(math.atan2(abs(v.x), -v.z))
        Mx = pb.matrix.copy(); h = Mx.translation.copy()
        R = Matrix.Rotation(sgn * math.radians(rest - target_abd_deg), 4, 'Y')
        if forward_deg:
            R = Matrix.Rotation(math.radians(-forward_deg), 4, 'X') @ R
        pb.matrix = Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ Mx
        bpy.context.view_layer.update()


def set_legs(rig, heel_gap_m):
    """Adduct both legs (call AFTER set_arms, which resets the pose) so ankle joints end up heel_gap apart."""
    for s_, sgn in (('L', 1), ('R', -1)):
        pb = rig.pose.bones['upperleg01.' + s_]; pa = rig.pose.bones['foot.' + s_]
        dx = abs(pa.head.x - pb.head.x) * (1 if pa.head.x * sgn > pb.head.x * sgn else -1)  # signed outward offset
        Lz = abs(pa.head.z - pb.head.z); tgt = heel_gap_m / 2 - abs(pb.head.x)
        th = math.atan2(dx, Lz) - math.atan2(tgt, Lz)
        Mx = pb.matrix.copy(); h = Mx.translation.copy()
        pb.matrix = Matrix.Translation(h) @ Matrix.Rotation(sgn * th, 4, 'Y') @ Matrix.Translation(-h) @ Mx
        bpy.context.view_layer.update()


def arm_abduction(rig):
    r = []
    for s in 'LR':
        pb = rig.pose.bones['upperarm02.' + s]; v = pb.tail - pb.head
        r.append(math.degrees(math.atan2(abs(v.x), -v.z)))
    return r


JOINTS = {'leftShoulder': 'upperarm01.L', 'rightShoulder': 'upperarm01.R', 'leftElbow': 'lowerarm01.L',
          'rightElbow': 'lowerarm01.R', 'leftWrist': 'wrist.L', 'rightWrist': 'wrist.R',
          'leftHip': 'upperleg01.L', 'rightHip': 'upperleg01.R', 'leftKnee': 'lowerleg01.L',
          'rightKnee': 'lowerleg01.R', 'leftAnkle': 'foot.L', 'rightAnkle': 'foot.R', 'neckBase': 'neck01',
          'headTop': 'head'}


def joint_world(rig, bone, tail=False):
    pb = rig.pose.bones[bone]
    return rig.matrix_world @ (pb.tail if tail else pb.head)


def project(cam, p):
    c = world_to_camera_view(bpy.context.scene, cam, Vector(p))
    return [float(c.x), float(1 - c.y)]  # normalised image coords, y down


def mesh_bbox_px(ob, cam):
    dg = bpy.context.evaluated_depsgraph_get()
    e = ob.evaluated_get(dg); me = e.to_mesh()
    n = len(me.vertices); arr = np.empty(n * 3, np.float32); me.vertices.foreach_get('co', arr)
    co = arr.reshape(n, 3); W = np.array(e.matrix_world)
    co = co @ W[:3, :3].T + W[:3, 3]
    e.to_mesh_clear()
    pts = [world_to_camera_view(bpy.context.scene, cam, Vector(v)) for v in co[::4]]
    xs = [q.x for q in pts]; ys = [1 - q.y for q in pts]
    return min(xs), max(xs), min(ys), max(ys)


def setup_render(scene):
    for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'CYCLES'):
        try:
            scene.render.engine = eng; break
        except TypeError:
            continue
    scene.render.resolution_x = RW; scene.render.resolution_y = RH; scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'JPEG'; scene.render.image_settings.quality = 55
    try: scene.view_settings.view_transform = 'AgX'
    except Exception: pass
    if scene.render.engine == 'CYCLES':
        scene.cycles.samples = 24; scene.cycles.use_denoising = True
    else:
        try: scene.eevee.taa_render_samples = 24
        except Exception: pass


def build_environment(rng, scene):
    wall_cols = [(0.93, 0.92, 0.9), (0.8, 0.78, 0.74), (0.62, 0.64, 0.66), (0.9, 0.85, 0.78), (0.35, 0.36, 0.4), (0.75, 0.82, 0.8), (0.96, 0.96, 0.97)]
    floor_cols = [(0.45, 0.33, 0.22), (0.6, 0.5, 0.38), (0.5, 0.5, 0.52), (0.75, 0.74, 0.72), (0.25, 0.25, 0.27)]
    wc, fc = rng.choice(wall_cols), rng.choice(floor_cols)
    wall_y = rng.uniform(1.0, 2.0)
    bpy.ops.mesh.primitive_plane_add(size=1); wall = bpy.context.object
    wall.scale = (12, 6, 1); wall.rotation_euler = (math.radians(90), 0, 0); wall.location = (0, wall_y, 2.0)
    wall.data.materials.append(mat('wall', srgb2lin(wc), 0.9))
    bpy.ops.mesh.primitive_plane_add(size=1); fl = bpy.context.object
    fl.scale = (14, 14, 1); fl.data.materials.append(mat('floor', srgb2lin(fc), 0.5))
    # a few indoor-ish props (never occluding the person: placed to the sides/back)
    for _ in range(rng.choice([0, 1, 2, 3])):
        bpy.ops.mesh.primitive_cube_add(size=1); c = bpy.context.object
        w, d, h = rng.uniform(0.3, 1.0), rng.uniform(0.3, 0.8), rng.uniform(0.4, 2.0)
        c.scale = (w, d, h); side = rng.choice([-1, 1])
        c.location = (side * rng.uniform(1.2, 2.2), wall_y - d / 2 - 0.05, h / 2)
        c.data.materials.append(mat('prop', srgb2lin([rng.uniform(0.1, 0.9) for _ in range(3)]), 0.7))
    # lighting
    w = scene.world or bpy.data.worlds.new('w'); scene.world = w; w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    g = rng.uniform(0.35, 1.0); bg.inputs['Color'].default_value = (g, g * rng.uniform(.92, 1.05), g * rng.uniform(.85, 1.1), 1)
    bg.inputs['Strength'].default_value = rng.uniform(0.3, 0.9)
    bpy.ops.object.light_add(type='SUN'); sun = bpy.context.object
    sun.rotation_euler = (math.radians(rng.uniform(25, 75)), 0, math.radians(rng.uniform(-70, 70)))
    sun.data.energy = rng.uniform(0.6, 2.2); sun.data.angle = math.radians(rng.uniform(1, 12))
    sun.data.color = (1, rng.uniform(.88, 1), rng.uniform(.75, 1))
    bpy.ops.object.light_add(type='AREA'); ar = bpy.context.object
    ar.location = (rng.uniform(-2, 2), -rng.uniform(1.5, 3.5), rng.uniform(1.8, 3)); ar.data.energy = rng.uniform(40, 200)
    ar.data.size = rng.uniform(1.0, 3.0)
    ar.rotation_euler = (math.radians(rng.uniform(60, 90)), 0, 0)
    return dict(wall_rgb=wc, floor_rgb=fc, wall_y=wall_y)


# ---------------------------------------------------------------- main per-body
SKIN_LIGHT, SKIN_DARK = (0.93, 0.76, 0.64), (0.55, 0.36, 0.26)


def make_body(idx):
    rng = random.Random(SEED * 100003 + idx)
    p = sample_params(rng)
    d = os.path.join(OUT, f'body_{idx:04d}'); os.makedirs(d, exist_ok=True)
    clear_scene()
    t0 = time.time()
    hs, ws, fat, stat_cm, mass_kg = solve(p)
    clear_scene()
    ob = build_human(p, hs, ws, fat)
    rig = HumanService.add_builtin_rig(ob, "default")
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.view_layer.objects: o.select_set(False)
    ob.select_set(True)
    bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    # keep skin body + eyes, drop all other helper geometry
    keep_groups = [ob.vertex_groups[n].index for n in ('body', 'helper-l-eye', 'helper-r-eye') if n in ob.vertex_groups]
    eye_groups = [ob.vertex_groups[n].index for n in ('helper-l-eye', 'helper-r-eye') if n in ob.vertex_groups]
    bm = bmesh.new(); bm.from_mesh(ob.data)
    dl = bm.verts.layers.deform.active
    kill = [v for v in bm.verts if not any(g in v[dl] for g in keep_groups)]
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(ob.data); bm.free()
    for m in list(ob.modifiers):
        if m.type != 'ARMATURE': ob.modifiers.remove(m)
    bpy.context.view_layer.update()

    # --- rest-pose (arms at MPFB default) geometry for ground truth
    rig.data.pose_position = 'REST'; bpy.context.view_layer.update()
    n = len(ob.data.vertices)
    arr = np.empty(n * 3, np.float32); ob.data.vertices.foreach_get('co', arr)
    V = arr.reshape(n, 3).astype(np.float64)
    armnames = [b.name for b in rig.data.bones if b.name.startswith(('upperarm', 'lowerarm', 'wrist', 'finger', 'metacarpal', 'shoulder01'))]
    armidx = [ob.vertex_groups[nm].index for nm in armnames if nm in ob.vertex_groups]
    armw = np.zeros(n)
    for v in ob.data.vertices:
        armw[v.index] = sum(g.weight for g in v.groups if g.group in armidx)
    eyeset = set(v.index for v in ob.data.vertices if any(g.group in eye_groups for g in v.groups))
    F = [list(pl.vertices) for pl in ob.data.polygons]
    skin_v = np.array([i not in eyeset for i in range(n)])
    H = V[skin_v, 2].max() - V[skin_v, 2].min()
    joints = {b.name: np.array(rig.matrix_world @ b.head_local) for b in rig.data.bones}
    M = Mesh(V, F, armw)
    gt, lm = measure_gt(M, H, joints)
    # mass from skin-only closed-ish surface
    vol = 0.0
    for f in F:
        if any(i in eyeset for i in f): continue
        a = V[f[0]]
        for k in range(1, len(f) - 1): vol += np.dot(a, np.cross(V[f[k]], V[f[k + 1]])) / 6.0
    mass = abs(vol) * DENSITY
    np.savez_compressed(os.path.join(d, 'rest_mesh.npz'), V=V.astype(np.float32), armw=armw.astype(np.float16),
                        F=np.array([f for f in F if len(f) == 4] or [[0, 0, 0, 0]], np.int32))

    # --- materials
    skin_t = (p['asian'] * 0.0 + rng.uniform(0.0, 1.0)) * (0.6 if p['asian'] > 0.5 else 1.0)
    skin = [SKIN_LIGHT[i] * (1 - skin_t) + SKIN_DARK[i] * skin_t for i in range(3)]
    ob.data.materials.clear()
    mskin = mat('skin', srgb2lin(skin), 0.55, 0.05); ob.data.materials.append(mskin)
    short_c = rng.choice([(0.08, 0.08, 0.1), (0.15, 0.2, 0.35), (0.3, 0.3, 0.32), (0.5, 0.1, 0.12)])
    top_c = rng.choice([(0.9, 0.9, 0.92), (0.08, 0.08, 0.1), (0.2, 0.4, 0.55), (0.55, 0.55, 0.5)])
    ob.data.materials.append(mat('shorts', srgb2lin(short_c), 0.8))
    ob.data.materials.append(mat('top', srgb2lin(top_c), 0.8))
    ob.data.materials.append(mat('eye', (0.02, 0.015, 0.012), 0.2))
    zlo, zhi = V[skin_v, 2].min(), V[skin_v, 2].max()
    sh_x = abs(joints['upperarm01.L'][0]) + 0.02
    male = p['sex'] == 'male'
    for pl, f in zip(ob.data.polygons, F):
        c = V[f].mean(axis=0); zf = (c[2] - zlo) / H
        mi = 0
        if any(i in eyeset for i in f): mi = 3
        elif 0.36 <= zf <= (0.56 if p['variant'] == 'skin' else 0.545) and armw[f].mean() < 0.5: mi = 1
        elif p['variant'] == 'tight' and 0.56 <= zf <= 0.82 and abs(c[0]) < sh_x and armw[f].mean() < 0.5: mi = 2
        elif p['variant'] == 'skin' and (not male) and 0.69 <= zf <= 0.76 and armw[f].mean() < 0.5: mi = 2
        pl.material_index = mi
    bpy.ops.object.shade_smooth()

    # --- environment + camera
    scene = bpy.context.scene; setup_render(scene)
    env = build_environment(rng, scene)
    camd = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', camd); scene.collection.objects.link(cam)
    scene.camera = cam
    fov = rng.uniform(58, 68); camd.sensor_fit = 'VERTICAL'; camd.angle = math.radians(fov)
    camd.clip_start = 0.1; camd.clip_end = 50
    cam_h = rng.uniform(1.0, 1.3)
    fill_t = {'front': rng.uniform(0.65, 0.85), 'side': rng.uniform(0.65, 0.85)}  # crown->sole fraction of frame height
    abd = rng.uniform(20, 30); abd_side = rng.uniform(5, 12); heel_gap = rng.uniform(0.10, 0.20)
    if os.environ.get('FRONT_ABD'):  # e.g. "40,50": override FRONT abduction only, separate RNG so every other draw is unchanged
        lo_, hi_ = map(float, os.environ['FRONT_ABD'].split(',')); abd = random.Random(SEED * 7919 + idx).uniform(lo_, hi_)
    yaw_f = rng.gauss(0, 3.0); yaw_s = (rng.choice([-1, 1]) * 90) + rng.gauss(0, 4.0)

    def place(pitch_deg, distance):
        cam.location = (0, -distance, cam_h); cam.rotation_euler = (math.radians(90 + pitch_deg), 0, 0)
        bpy.context.view_layer.update()

    def fit(target_fill):
        """Pick distance + pitch so crown->sole fills target_fill of frame height, vertically centred."""
        D, pitch = 1.8, 0.0
        for _ in range(12):
            place(pitch, D); x0, x1, y0, y1 = mesh_bbox_px(ob, cam)
            fill = y1 - y0; cy = (y0 + y1) / 2
            D *= fill / target_fill
            pitch -= (cy - 0.5) * fov
            if abs(fill - target_fill) < 0.008 and abs(cy - 0.5) < 0.01: break
        place(pitch, D); return D, pitch, mesh_bbox_px(ob, cam)

    results = {}
    for view, abd_t, yaw in (('front', abd, yaw_f), ('side', abd_side, yaw_s)):
        rig.data.pose_position = 'POSE'
        set_arms(rig, abd_t, forward_deg=(8 if view == 'side' else 0)); set_legs(rig, heel_gap)
        rig.rotation_euler = (0, 0, math.radians(yaw)); bpy.context.view_layer.update()
        dist, pit, bb = fit(fill_t[view])
        base_loc = rig.location.copy(); base_cam = cam.location.copy(); base_rot = cam.rotation_euler.copy()
        for fi in range(3):
            if fi:  # multi-frame buffer jitter: camera +-1 cm, +-0.5 deg, subject sway +-0.5 cm
                cam.location = base_cam + Vector([rng.uniform(-.01, .01) for _ in range(3)])
                cam.rotation_euler = (base_rot[0] + math.radians(rng.uniform(-.5, .5)), 0, math.radians(rng.uniform(-.5, .5)))
                rig.location = base_loc + Vector((rng.uniform(-.005, .005), rng.uniform(-.005, .005), 0))
                bpy.context.view_layer.update()
            scene.render.filepath = os.path.join(d, f'{view}_{fi}.jpg'); bpy.ops.render.render(write_still=True)
        cam.location = base_cam; cam.rotation_euler = base_rot; rig.location = base_loc; bpy.context.view_layer.update()
        kp = {k: project(cam, joint_world(rig, b)) for k, b in JOINTS.items()}
        kp['leftAnkle'] = project(cam, joint_world(rig, 'lowerleg02.L', True)); kp['rightAnkle'] = project(cam, joint_world(rig, 'lowerleg02.R', True))
        results[view] = dict(yaw_deg=yaw, abduction_deg_requested=abd_t, abduction_deg_measured=arm_abduction(rig),
                             camera_distance_m=dist, camera_height_m=cam_h, fill_target=fill_t[view], fill_actual=bb[3] - bb[2], heel_gap_m=heel_gap, camera_pitch_up_deg=pit,
                             capturePitchRad=math.pi / 2 + math.radians(pit), vfov_deg=fov,
                             bbox_norm=dict(x0=bb[0], x1=bb[1], y0=bb[2], y1=bb[3]), joints_norm_xy=kp)
    meta = dict(id=f'body_{idx:04d}', index=idx, seed=SEED, params=p, solved_sliders=dict(height=hs, weight=ws, fat=fat),
                actual=dict(stature_cm=round(H * 100, 2), mass_kg=round(mass, 2), bmi=round(mass / H ** 2, 2),
                            solver_stature_cm=stat_cm, solver_mass_kg=mass_kg),
                render=dict(width=RW, height=RH, engine=scene.render.engine), environment=env,
                skin_rgb=skin, views=results, landmarks=lm, density_kg_m3=DENSITY,
                gen_seconds=round(time.time() - t0, 1))
    json.dump(meta, open(os.path.join(d, 'meta_full.json'), 'w'), indent=1, default=float)
    json.dump(dict(heightCm=meta['actual']['stature_cm'], weightKg=meta['actual']['mass_kg'], sex=p['sex'],
                   ageYears=round(p['age_years']), asianWeight=3 if p['asian'] >= 0.6 else 1,
                   pitchRad=results['front']['capturePitchRad'], pitchRadSide=results['side']['capturePitchRad'],
                   asianSlider=round(p['asian'], 3)), open(os.path.join(d, 'meta.json'), 'w'), indent=1)
    json.dump(gt, open(os.path.join(d, 'gt.json'), 'w'), indent=1)
    print('BODY_DONE', idx, gt, meta['actual'], meta['gen_seconds'])


for i in range(START, START + COUNT):
    try:
        make_body(i)
    except Exception:
        import traceback; traceback.print_exc(); print('BODY_FAIL', i)
