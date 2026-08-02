# Generar el paquete portable de Windows

Esta carpeta contiene los scripts usados para construir la distribución del
print agent para Windows. Las instrucciones destinadas al usuario que instala
el agent están en [`INSTALL.md`](../../INSTALL.md).

## Contenido incluido en el paquete

El ZIP generado contiene Node.js, las dependencias de producción, el código
compilado y los siguientes asistentes:

- `CONFIGURAR-AGENT.cmd`: crea y abre el archivo `.env`.
- `INICIAR-AGENT.cmd`: inicia manualmente el print agent.
- `INSTALAR-INICIO-AUTOMATICO.cmd`: configura el inicio automático para el
  usuario actual.
- `INSTALAR-INICIO-AUTOMATICO.ps1`: crea el acceso directo utilizado por el
  asistente de inicio automático.
- `INSTALL.md`: explica la instalación, configuración, inicio automático y
  resolución de problemas.

Después de comprobar manualmente que el agent se conecta, el usuario puede
ejecutar una sola vez `INSTALAR-INICIO-AUTOMATICO.cmd`. Desde el próximo inicio
de sesión en Windows, el agent se abrirá automáticamente.

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
