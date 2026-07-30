@echo off
setlocal
cd /d "%~dp0"

if not exist ".env" (
  echo ERROR: Primero ejecuta CONFIGURAR-AGENT.cmd.
  pause
  exit /b 1
)

if not exist "runtime\node.exe" (
  echo ERROR: El paquete esta incompleto. No se encontro runtime\node.exe.
  pause
  exit /b 1
)

if not exist "dist\agent.js" (
  echo ERROR: El paquete esta incompleto. No se encontro dist\agent.js.
  pause
  exit /b 1
)

"%~dp0runtime\node.exe" "%~dp0dist\agent.js"

echo.
echo El agent se detuvo con codigo %ERRORLEVEL%.
pause
