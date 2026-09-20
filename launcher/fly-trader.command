#!/usr/bin/env bash
# Double-clickable launcher for macOS and Linux.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$HERE")"

PY=""
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1; then
    if "$candidate" -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' >/dev/null 2>&1; then
      PY="$candidate"
      break
    fi
  fi
done

if [ -z "$PY" ]; then
  echo "Python 3 was not found, so the local server can't start."
  echo "Opening the app straight from disk instead — some APIs may be blocked by the browser."
  if command -v open >/dev/null 2>&1; then open "$ROOT/Index.html"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$ROOT/Index.html"
  fi
  echo "Install Python 3 from https://python.org and run this again for the full setup."
  read -r -p "Press Enter to close..." _
  exit 1
fi

exec "$PY" "$HERE/fly_trader.py" "$@"
