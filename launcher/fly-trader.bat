@echo off
setlocal
title MEMECOIN SNIPER
set "HERE=%~dp0"

where py >nul 2>&1 && (
  py -3 "%HERE%fly_trader.py" %*
  goto :done
)
where python >nul 2>&1 && (
  python "%HERE%fly_trader.py" %*
  goto :done
)

echo Python 3 was not found, so the local server can't start.
echo Opening the app straight from disk instead - some APIs may be blocked by the browser.
start "" "%HERE%..\Index.html"
echo Install Python 3 from https://python.org and run this again for the full setup.
pause

:done
endlocal
