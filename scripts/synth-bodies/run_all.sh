#!/bin/bash
# usage: run_all.sh OUT_DIR [SEED]   (phase 1 = 20 bodies, then continue to 300)
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
D=$(dirname "$0")
"$B" -b --factory-startup --python "$D/gen_bodies.py" -- "$1" 0 20 ${2:-1} > "$1/log_phase1.txt" 2>&1
echo PHASE1_DONE > "$1/PHASE1_DONE"
for s in 20 80 140 200 260; do
"$B" -b --factory-startup --python "$D/gen_bodies.py" -- "$1" $s 60 ${2:-1} > "$1/log_$s.txt" 2>&1
done
echo ALL_DONE > "$1/ALL_DONE"
