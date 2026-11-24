@echo off
cd /d "%~dp0"
node scripts\start-aeris.mjs
if errorlevel 1 pause
