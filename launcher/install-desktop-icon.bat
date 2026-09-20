@echo off
REM Puts a double-clickable "Fly Trader" shortcut on your Desktop.
setlocal
set "HERE=%~dp0"
set "ROOT=%HERE%.."

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$desktop = $ws.SpecialFolders('Desktop');" ^
  "$lnk = $ws.CreateShortcut((Join-Path $desktop 'Fly Trader.lnk'));" ^
  "$lnk.TargetPath = '%HERE%fly-trader.bat';" ^
  "$lnk.WorkingDirectory = (Resolve-Path '%ROOT%').Path;" ^
  "$lnk.IconLocation = '%HERE%fly-trader.ico';" ^
  "$lnk.Description = 'Start the MEMECOIN SNIPER local app';" ^
  "$lnk.Save();" ^
  "Write-Host ('Installed: ' + (Join-Path $desktop 'Fly Trader.lnk'))"

echo Double-click the Desktop icon to start the app.
pause
endlocal
