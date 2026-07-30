param(
  [string]$OutputDirectory = ""
)

$ErrorActionPreference = "Stop"
$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$PackageName = "serviciotecnico-agent-windows-x64"
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  $OutputDirectory = Join-Path $RepositoryRoot "release"
} elseif (-not [System.IO.Path]::IsPathRooted($OutputDirectory)) {
  $OutputDirectory = Join-Path $RepositoryRoot $OutputDirectory
}
$OutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
$PackageRoot = Join-Path $OutputDirectory $PackageName
$ArchivePath = Join-Path $OutputDirectory "$PackageName.zip"

$RequiredPaths = @(
  (Join-Path $RepositoryRoot "dist"),
  (Join-Path $RepositoryRoot "node_modules"),
  (Join-Path $RepositoryRoot ".env.example"),
  (Join-Path $RepositoryRoot "INSTALL.md")
)

foreach ($RequiredPath in $RequiredPaths) {
  if (-not (Test-Path $RequiredPath)) {
    throw "Falta $RequiredPath. Ejecuta npm ci, npm run build y npm prune --omit=dev."
  }
}

$NodeExecutable = (Get-Command node.exe -ErrorAction Stop).Source

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
if (Test-Path $PackageRoot) {
  Remove-Item $PackageRoot -Recurse -Force
}
if (Test-Path $ArchivePath) {
  Remove-Item $ArchivePath -Force
}

New-Item -ItemType Directory -Path $PackageRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PackageRoot "runtime") -Force |
  Out-Null

Copy-Item (Join-Path $RepositoryRoot "dist") $PackageRoot -Recurse
Copy-Item (Join-Path $RepositoryRoot "node_modules") $PackageRoot -Recurse
Copy-Item $NodeExecutable (Join-Path $PackageRoot "runtime\node.exe")
Copy-Item (Join-Path $RepositoryRoot ".env.example") $PackageRoot
Copy-Item (Join-Path $RepositoryRoot "INSTALL.md") $PackageRoot
Copy-Item (Join-Path $RepositoryRoot "README.md") $PackageRoot
Copy-Item (Join-Path $RepositoryRoot "package.json") $PackageRoot
Copy-Item (Join-Path $RepositoryRoot "package-lock.json") $PackageRoot
Copy-Item (Join-Path $PSScriptRoot "CONFIGURAR-AGENT.cmd") $PackageRoot
Copy-Item (Join-Path $PSScriptRoot "INICIAR-AGENT.cmd") $PackageRoot

$Package = Get-Content (Join-Path $RepositoryRoot "package.json") -Raw |
  ConvertFrom-Json
Set-Content -Path (Join-Path $PackageRoot "VERSION.txt") -Value $Package.version

$PackagedPaths = @(
  (Join-Path $PackageRoot "runtime\node.exe"),
  (Join-Path $PackageRoot "dist\agent.js"),
  (Join-Path $PackageRoot "node_modules"),
  (Join-Path $PackageRoot ".env.example"),
  (Join-Path $PackageRoot "CONFIGURAR-AGENT.cmd"),
  (Join-Path $PackageRoot "INICIAR-AGENT.cmd"),
  (Join-Path $PackageRoot "INSTALL.md")
)

foreach ($PackagedPath in $PackagedPaths) {
  if (-not (Test-Path $PackagedPath)) {
    throw "El paquete quedo incompleto: falta $PackagedPath."
  }
}

Compress-Archive -Path (Join-Path $PackageRoot "*") `
  -DestinationPath $ArchivePath `
  -CompressionLevel Optimal

Write-Output $ArchivePath
