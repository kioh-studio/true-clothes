#!/usr/bin/env bash
# Interactive EAS submit driver via FIFO + winpty.
# Apple credentials come from env (EXPO_APPLE_ID / EXPO_APPLE_PASSWORD) — never written here.
set -u

FIFO=/tmp/eas_in
LOG=/tmp/eas-submit.log
PIDFILE=/tmp/eas_submit.pid
HOLDFILE=/tmp/eas_hold.pid

rm -f "$FIFO" "$LOG"
mkfifo "$FIFO"

# Hold the write end open so the reader never gets EOF (no hang, no premature close).
sleep 100000 > "$FIFO" &
echo $! > "$HOLDFILE"

cd /c/projects/true-clothes

winpty -Xallow-non-tty bash -lc 'cd /c/projects/true-clothes && npx eas-cli submit -p ios --id 4edb1321-5822-4dc2-b58d-66d0b342e537' \
  < "$FIFO" > "$LOG" 2>&1 &
echo $! > "$PIDFILE"

wait "$(cat "$PIDFILE")"
EXIT=$?
# Clean up the holder once submit exits.
kill "$(cat "$HOLDFILE")" 2>/dev/null
echo "=== EAS SUBMIT EXIT CODE: $EXIT ===" >> "$LOG"
