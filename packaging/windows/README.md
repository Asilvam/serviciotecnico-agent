# Generar el paquete portable de Windows

## Desde GitHub Actions

1. Abre **Actions** en el repositorio.
2. Selecciona **Build Windows portable agent**.
3. Ejecuta **Run workflow**.
4. Descarga el artefacto `serviciotecnico-agent-windows-x64`.

Para publicar el ZIP en una release, crea y sube un tag con el formato:

```bash
git tag agent-v1.0.0
git push origin agent-v1.0.0
```

El workflow creará la release y adjuntará el ZIP.

## Desde un PC Windows

En PowerShell, dentro del repositorio:

```powershell
npm ci
npm run build
npm prune --omit=dev
powershell -ExecutionPolicy Bypass -File packaging/windows/package-portable.ps1
```

El resultado quedará en:

```text
release\serviciotecnico-agent-windows-x64.zip
```

`npm prune --omit=dev` elimina las dependencias de desarrollo locales. Ejecuta
`npm ci` nuevamente antes de continuar desarrollando.
