#!/usr/bin/env bash
# Scan-replay runbook as a script. Usage:
#   scripts/scan-replay/push-pull.sh push <local-body-set-dir>   # copy bodies into the app's documentDirectory
#   scripts/scan-replay/push-pull.sh open                        # deep-link to the replay screen (then tap RUN)
#   scripts/scan-replay/push-pull.sh wait <n-bodies>             # poll out/_log.txt until n lines
#   scripts/scan-replay/push-pull.sh pull [local-out-dir]        # default: ./scan-replay-out
#   scripts/scan-replay/push-pull.sh eval [local-out-dir]        # deno harness, weighted + --fuse
# Needs a DEBUGGABLE build (run-as). documentDirectory on Android = /data/data/<pkg>/files/.
set -euo pipefail
export MSYS_NO_PATHCONV=1   # Git Bash: stop it rewriting /data/... arguments
PKG=tech.kioh.mien
BASE=files/scan-replay      # relative to the app's data dir (= documentDirectory/scan-replay)
TMP=/data/local/tmp/scan-replay-in
OUT=${2:-./scan-replay-out}

case "${1:-}" in
  push)
    SRC=${2:?local body-set dir (one sub-folder per body)}
    adb shell "rm -rf $TMP"
    adb push "$SRC" "$TMP"
    adb shell "chmod -R a+rX $TMP"
    adb shell "run-as $PKG sh -c 'mkdir -p $BASE && rm -rf $BASE/in && cp -r $TMP $BASE/in && rm -rf $BASE/out && ls $BASE/in | wc -l'"
    adb shell "rm -rf $TMP"
    ;;
  open)
    adb shell am start -a android.intent.action.VIEW -d mien://dev-scan-replay $PKG
    echo "Tap RUN on the screen (or: adb shell input tap <x> <y>)."
    ;;
  wait)
    N=${2:?number of bodies}
    while true; do
      DONE=$(adb exec-out run-as $PKG sh -c "cat $BASE/out/_log.txt 2>/dev/null | wc -l" | tr -d '\r ')
      echo "$DONE / $N bodies done"
      [ "${DONE:-0}" -ge "$N" ] && break
      sleep 10
    done
    ;;
  pull)
    rm -rf "$OUT"; mkdir -p "$OUT"
    # tar is in toybox on API 24+; fall back to per-file cat if it is missing.
    if adb exec-out run-as $PKG tar -C $BASE/out -cf - . > "$OUT/_out.tar" 2>/dev/null && [ -s "$OUT/_out.tar" ]; then
      tar --force-local -xf "$OUT/_out.tar" -C "$OUT" && rm "$OUT/_out.tar"
    else
      rm -f "$OUT/_out.tar"
      for f in $(adb exec-out run-as $PKG ls $BASE/out | tr -d '\r'); do
        adb exec-out run-as $PKG cat "$BASE/out/$f" > "$OUT/$f"
      done
    fi
    ls "$OUT" | wc -l
    ;;
  eval)
    # _log.txt is ignored by the loader (not .json).
    deno run --allow-read --sloppy-imports scripts/measure-eval/run.ts --dir "$OUT" --fuse ${3:-}
    ;;
  *) sed -n 2,9p "$0"; exit 1 ;;
esac
