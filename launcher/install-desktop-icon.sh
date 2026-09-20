#!/usr/bin/env bash
# Puts a double-clickable "Fly Trader" icon on your Desktop.
#   macOS : builds Fly Trader.app
#   Linux : builds a .desktop entry (Desktop + application menu)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$HERE")"
DESKTOP="${HOME}/Desktop"
[ -d "$DESKTOP" ] || DESKTOP="$HOME"

case "$(uname -s)" in
  Darwin)
    APP="${DESKTOP}/Fly Trader.app"
    rm -rf "$APP"
    mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

    cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Fly Trader</string>
  <key>CFBundleDisplayName</key><string>Fly Trader</string>
  <key>CFBundleIdentifier</key><string>app.flytrader.launcher</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>fly-trader</string>
  <key>CFBundleIconFile</key><string>fly-trader</string>
  <key>LSMinimumSystemVersion</key><string>10.13</string>
</dict>
</plist>
PLIST

    cp "$HERE/fly-trader.icns" "$APP/Contents/Resources/fly-trader.icns"

    cat > "$APP/Contents/MacOS/fly-trader" <<LAUNCH
#!/bin/bash
# Open a Terminal window so you can see the log and stop the bot with Ctrl+C.
open -a Terminal "${HERE}/fly-trader.command"
LAUNCH
    chmod +x "$APP/Contents/MacOS/fly-trader"

    # nudge Finder into picking the icon up straight away
    touch "$APP"
    echo "Installed: $APP"
    echo "Double-click it to start the app."
    ;;

  Linux)
    ENTRY_DIR="${HOME}/.local/share/applications"
    mkdir -p "$ENTRY_DIR"
    ENTRY="${ENTRY_DIR}/fly-trader.desktop"

    cat > "$ENTRY" <<DESK
[Desktop Entry]
Type=Application
Version=1.0
Name=Fly Trader
Comment=Start the MEMECOIN SNIPER local app
Exec=${HERE}/fly-trader.command
Path=${ROOT}
Icon=${HERE}/fly-trader.png
Terminal=true
Categories=Finance;Network;
DESK
    chmod +x "$ENTRY"
    cp "$ENTRY" "${DESKTOP}/fly-trader.desktop"
    chmod +x "${DESKTOP}/fly-trader.desktop"

    # GNOME wants desktop files explicitly marked as trusted
    if command -v gio >/dev/null 2>&1; then
      gio set "${DESKTOP}/fly-trader.desktop" metadata::trusted true 2>/dev/null || true
    fi
    if command -v update-desktop-database >/dev/null 2>&1; then
      update-desktop-database "$ENTRY_DIR" 2>/dev/null || true
    fi

    echo "Installed: ${DESKTOP}/fly-trader.desktop"
    echo "Double-click it to start the app (it also shows up in your app menu)."
    ;;

  *)
    echo "Unsupported platform: $(uname -s)."
    echo "On Windows run launcher\\install-desktop-icon.bat instead."
    exit 1
    ;;
esac
