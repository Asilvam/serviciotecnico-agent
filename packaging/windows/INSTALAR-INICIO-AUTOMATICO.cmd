@echo off
setlocal
cd /d "%~dp0"

if not exist ".env" (
  echo ERROR: Primero ejecuta CONFIGURAR-AGENT.cmd.
  pause
  exit /b 1
)

if not exist "INICIAR-AGENT.cmd" (
  echo ERROR: El paquete esta incompleto. No se encontro INICIAR-AGENT.cmd.
  pause
  exit /b 1
)

if not exist "INSTALAR-INICIO-AUTOMATICO.ps1" (
  echo ERROR: El paquete esta incompleto. No se encontro INSTALAR-INICIO-AUTOMATICO.ps1.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0INSTALAR-INICIO-AUTOMATICO.ps1"

if errorlevel 1 (
  echo.
  echo ERROR: No fue posible configurar el inicio automatico.
  pause
  exit /b 1
)

echo.
echo El agent se iniciara automaticamente la proxima vez que inicies sesion en Windows.
echo Puedes seguir usando INICIAR-AGENT.cmd para iniciarlo ahora.
pause
