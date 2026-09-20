#!/usr/bin/env bash
# Double-click this in Finder to put the Fly Trader icon on your Desktop.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$HERE/install-desktop-icon.sh"
echo
read -r -p "Done. Press Enter to close this window..." _ || true
