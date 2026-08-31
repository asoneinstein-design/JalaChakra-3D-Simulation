#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
node "$ROOT/tests/smoke.mjs"
for f in "$ROOT/src/main.js" "$ROOT/src/core/config.js" "$ROOT/src/core/physics.js" "$ROOT/src/core/simulation.js" "$ROOT/src/scene/components.js" "$ROOT/src/scene/particles.js" "$ROOT/src/scene/camera.js" "$ROOT/src/ui/dashboard.js"; do node --check "$f"; done
TMP_PORT=8002
python3 -m http.server "$TMP_PORT" --directory "$ROOT" >/tmp/jalachakra-verify-http.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
sleep 1
curl -fsSI "http://127.0.0.1:$TMP_PORT/" >/dev/null
curl -fsSI "http://127.0.0.1:$TMP_PORT/src/main.js" >/dev/null
echo 'JalaChakra verification passed: physics, JS syntax, and local HTTP serving.'
