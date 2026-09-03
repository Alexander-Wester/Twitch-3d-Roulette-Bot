@echo off
setlocal
cd /d "%~dp0"

title Rhino's Roulette Bot - Portable Builder

echo ============================================================
echo   RHINO'S ROULETTE BOT - WINDOWS PORTABLE BUILD
echo ============================================================
echo.
echo This builds the folder/EXE you can send to another streamer.
echo The FIRST build needs an internet connection to download
echo Electron and the build dependencies.
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js was not found.
    echo.
    echo Install Node.js 22 or newer, then run this file again.
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo Node version:
node -v
echo.

echo [1/3] Installing/updating build dependencies...
call npm install
if errorlevel 1 (
    echo.
    echo ERROR: npm install failed.
    echo Check the internet connection and try again.
    echo.
    pause
    exit /b 1
)

echo.
echo [2/3] Building Windows x64 portable application...
call npm run package:win
if errorlevel 1 (
    echo.
    echo ERROR: The Electron portable build failed.
    echo.
    pause
    exit /b 1
)

set "APPDIR=dist\Rhinos Roulette Bot-win32-x64"
set "ZIPFILE=dist\Rhinos-Roulette-Bot-v1.5.0-win64.zip"

if not exist "%APPDIR%\Rhinos Roulette Bot.exe" (
    echo.
    echo ERROR: Build finished but the expected EXE was not found:
    echo %APPDIR%\Rhinos Roulette Bot.exe
    echo.
    pause
    exit /b 1
)

echo.
echo [3/3] Creating sendable ZIP...
if exist "%ZIPFILE%" del /f /q "%ZIPFILE%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "Compress-Archive -Path '%APPDIR%\*' -DestinationPath '%ZIPFILE%' -Force"

if errorlevel 1 (
    echo.
    echo ERROR: The app built successfully, but ZIP creation failed.
    echo You can still send the entire folder:
    echo %APPDIR%
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   BUILD COMPLETE
echo ============================================================
echo.
echo Send your streamer friend this file:
echo.
echo   %ZIPFILE%
echo.
echo They only need to:
echo   1. Extract the ZIP
echo   2. Run "Rhinos Roulette Bot.exe"
echo   3. Connect Broadcaster + Bot Twitch accounts
echo   4. Add http://localhost:3000/overlay to OBS
echo.
echo Node.js is NOT required on their computer.
echo Their Twitch logins, settings, custom messages, logs and
echo roulette.db are stored separately in Windows AppData.
echo Replacing this program folder later will not wipe them.
echo.
start "" explorer.exe "dist"
pause
