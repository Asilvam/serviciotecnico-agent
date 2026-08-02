$ErrorActionPreference = "Stop"
$InstallRoot = $PSScriptRoot
$LauncherPath = Join-Path $InstallRoot "INICIAR-AGENT.cmd"
$EnvironmentPath = Join-Path $InstallRoot ".env"

if (-not (Test-Path $EnvironmentPath)) {
  throw "Primero ejecuta CONFIGURAR-AGENT.cmd."
}

if (-not (Test-Path $LauncherPath)) {
  throw "El paquete esta incompleto. No se encontro INICIAR-AGENT.cmd."
}

$StartupDirectory = [Environment]::GetFolderPath("Startup")
$ShortcutPath = Join-Path $StartupDirectory "Servicio Tecnico Print Agent.lnk"
$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $LauncherPath
$Shortcut.WorkingDirectory = $InstallRoot
$Shortcut.Description = "Servicio Tecnico Print Agent"
$Shortcut.Save()

Write-Host "Inicio automatico configurado: $ShortcutPath"
