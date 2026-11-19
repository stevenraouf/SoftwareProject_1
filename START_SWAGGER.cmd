@echo off
setlocal
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 22 and reopen this launcher.
  pause
  exit /b 1
)
node.exe "%~dp0backend\scripts\start-local.mjs"
if errorlevel 1 (
  echo.
  echo Swagger could not start. Read the error above.
  pause
  exit /b 1
)
