@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   Starting Tavern Nyah ^& Fifi...
echo   Serving at http://localhost:8000
echo.
echo   NOTE: If you have an old tab open,
echo   close it or press Ctrl+Shift+R to
echo   force a clean reload!
echo ========================================
echo.

start "" http://localhost:8000
python -m http.server 8000

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Server stopped or Python was not found in PATH.
    pause
)
