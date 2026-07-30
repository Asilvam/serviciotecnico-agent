@echo off
setlocal
cd /d "%~dp0"

if not exist ".env.example" (
  echo ERROR: No se encontro .env.example.
  pause
  exit /b 1
)

if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  echo Se creo el archivo .env.
)

start /wait notepad.exe ".env"

echo.
echo Configuracion guardada. Ahora ejecuta INICIAR-AGENT.cmd.
pause
