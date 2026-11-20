@echo off
setlocal
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install the Node.js version in .nvmrc and reopen this launcher.
  pause
  exit /b 1
)
node.exe "%~dp0backend\scripts\start-local.mjs" --stripe
if errorlevel 1 (
  echo.
  echo The Stripe test listener could not start. Read the error above.
  pause
  exit /b 1
)
