@echo off
cd /d "%~dp0"
echo Starting NeoonLeadGen ICP Studio...
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Node.js is not installed. Please install Node.js v18+ from https://nodejs.org/
  pause
  exit /b 1
)
node server.js --open
pause
