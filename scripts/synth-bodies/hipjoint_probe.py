"""blender -b --factory-startup --python hipjoint_probe.py -- SET_DIR N SEED : writes SET_DIR/body_NNNN/hip_joint.json (rest-pose hip-joint/trochanter-ish heights)"""
import sys, os, json
a = sys.argv[sys.argv.index('--') + 1:]
SET, N, SEED = a[0], int(a[1]), a[2]
sys.argv = sys.argv[:sys.argv.index('--') + 1] + [SET, '0', '0', SEED]   # gen_bodies main loop runs 0 bodies
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gen_bodies.py')).read())
for i in range(N):
    d = os.path.join(SET, f'body_{i:04d}'); m = json.load(open(d + '/meta_full.json'))
    clear_scene()
    s = m['solved_sliders']; ob = build_human(m['params'], s['height'], s['weight'], s['fat'])
    rig = HumanService.add_builtin_rig(ob, "default"); rig.data.pose_position = 'REST'; bpy.context.view_layer.update()
    b = rig.data.bones
    json.dump({'hip_joint_z_m': float(rig.matrix_world @ b['upperleg01.L'].head_local)[2] if False else float((rig.matrix_world @ b['upperleg01.L'].head_local)[2]),
               'hip_joint_x_m': float((rig.matrix_world @ b['upperleg01.L'].head_local)[0]), 'pelvis_z_m': float((rig.matrix_world @ b['pelvis.L'].head_local)[2])},
              open(d + '/hip_joint.json', 'w'))
    print('HJ', i)
