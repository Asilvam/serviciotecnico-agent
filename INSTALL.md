# Instalación del agent portable en Windows

Este paquete ya incluye Node.js, las dependencias y el código compilado. En el
PC que imprimirá no necesitas instalar Node, npm, Git, la API ni el frontend.

## Requisitos

- Windows de 64 bits.
- Acceso por red a la API de Servicio Técnico.
- El `PRINT_TOKEN` configurado en la API.
- Una impresora instalada y configurada como predeterminada:
  - Para el resumen normal, debe ser la impresora predeterminada de Windows.
  - Para el ticket térmico, debe tener su controlador y papel de 80 mm
    configurados en Windows.

## Obtener el agente desde GitHub Actions

El repositorio incluye el workflow **Build Windows portable agent**, que crea
un paquete para Windows con Node.js, las dependencias y el agent compilado. El
PC de destino no necesita tener Node.js, npm ni Git instalados.

### Generar el paquete manualmente

1. Sube el repositorio a GitHub asegurándote de incluir el archivo:

```text
.github/workflows/build-windows-portable.yml
```

2. En GitHub, abre el repositorio y entra en la pestaña **Actions**.
3. Si GitHub solicita habilitar los workflows, selecciona **I understand my
   workflows, go ahead and enable them**.
4. En la lista de workflows, selecciona **Build Windows portable agent**.
5. Pulsa **Run workflow**, elige la rama que contiene los cambios y vuelve a
   pulsar **Run workflow** para confirmar.
6. Espera a que la ejecución termine con estado correcto. El workflow instala
   las dependencias, compila el agent, crea el paquete portable y comprueba que
   su runtime pueda cargar las dependencias necesarias.
7. Abre la ejecución terminada y, al final de la página, busca la sección
   **Artifacts**.
8. Descarga el artefacto **serviciotecnico-agent-windows-x64**.
9. Copia el archivo descargado al PC Windows donde se conectará la impresora y
   continúa con la sección **Instalación**.

Los artefactos de Actions requieren iniciar sesión en GitHub y se conservan
durante el periodo configurado por GitHub para el repositorio.

### Publicar una versión descargable en Releases

Para conservar y distribuir una versión identificada, crea un tag con el
prefijo `agent-v` y súbelo a GitHub:

```bash
git tag agent-v1.0.0
git push origin agent-v1.0.0
```

El workflow se ejecutará automáticamente y creará una GitHub Release con el
archivo `serviciotecnico-agent-windows-x64.zip`. Para descargarlo:

1. Abre la página principal del repositorio en GitHub.
2. Entra en **Releases**.
3. Selecciona la versión correspondiente, por ejemplo `agent-v1.0.0`.
4. Descarga `serviciotecnico-agent-windows-x64.zip` desde **Assets**.

## Instalación

1. Descomprime `serviciotecnico-agent-windows-x64.zip`.
2. Mueve la carpeta a una ubicación permanente, por ejemplo:

```text
C:\ServicioTecnicoAgent
```

3. Ejecuta `CONFIGURAR-AGENT.cmd`.
4. En el archivo que abrirá el Bloc de notas, configura:

```env
SERVER_URL=https://direccion-de-la-api
PRINT_TOKEN=el-mismo-secreto-de-la-api
AGENT_ID=recepcion-pc-01
PRINTER_ID=default-printer
LOG_LEVEL=info
# THERMAL_PAPER_SIZE=80mm
```

5. Guarda y cierra el Bloc de notas.
6. Ejecuta `INICIAR-AGENT.cmd`.

La instalación funciona cuando la ventana muestra un mensaje similar a:

```text
Connected to API. ... agentId=recepcion-pc-01 printerId=default-printer
```

Mantén esa ventana abierta para recibir trabajos de impresión.

## Inicio automático con Windows

Después de comprobar que el agent se conecta correctamente, ejecuta una sola
vez `INSTALAR-INICIO-AUTOMATICO.cmd`. El script crea un acceso directo en la
carpeta de Inicio del usuario actual y no requiere permisos de administrador.

A partir del próximo inicio de sesión en Windows, `INICIAR-AGENT.cmd` se abrirá
automáticamente. Mantén su ventana abierta para que el PC continúe recibiendo
trabajos de impresión.

No muevas ni cambies el nombre de la carpeta `C:\ServicioTecnicoAgent` después
de configurar el inicio automático. Si necesitas moverla, ejecuta nuevamente
`INSTALAR-INICIO-AUTOMATICO.cmd` desde la nueva ubicación.

Para desactivar el inicio automático:

1. Presiona `Win + R`.
2. Escribe `shell:startup` y presiona Enter.
3. Elimina el acceso directo `Servicio Tecnico Print Agent`.

`CONFIGURAR-AGENT.cmd` solo debe ejecutarse al instalar el agent o al cambiar
su configuración. No es necesario ejecutarlo después de cada reinicio.

## Significado de la configuración

- `SERVER_URL`: dirección accesible de la API, sin rutas adicionales.
- `PRINT_TOKEN`: debe coincidir exactamente con el valor de la API.
- `AGENT_ID`: nombre único para identificar este PC.
- `PRINTER_ID`: debe coincidir con `DEFAULT_PRINTER_ID` de la API.
- `LOG_LEVEL`: normalmente debe permanecer en `info`.
- `THERMAL_PAPER_SIZE`: normalmente se omite. Úsalo solo si el controlador
  exige el nombre exacto de un formulario térmico registrado en Windows.

El tipo de impresión no se configura aquí. El frontend indica en cada trabajo
si debe imprimir el ticket térmico o el resumen normal Letter.

El archivo `.env` contiene un secreto. No lo compartas ni lo subas a Git.

## Preparar la impresora

### Impresora normal

Selecciona la impresora en:

```text
Configuración > Bluetooth y dispositivos > Impresoras y escáneres
```

Déjala configurada como impresora predeterminada de Windows.

### Impresora térmica

1. Conecta la impresora e instala el controlador del fabricante.
2. Imprime una página de prueba desde Windows.
3. Configura un papel de 80 mm en las preferencias del controlador.
4. Déjala como impresora predeterminada antes de enviar el ticket.

El agent imprime mediante la cola de Windows. No usa acceso USB directo ni
requiere controladores WinUSB/libusb.

## Problemas básicos

### El agent no se conecta

Revisa `SERVER_URL`, `PRINT_TOKEN`, la conexión a internet y que la API esté
activa.

### El agent no se inicia con Windows

Presiona `Win + R`, ejecuta `shell:startup` y confirma que exista el acceso
directo `Servicio Tecnico Print Agent`. Si no existe o la carpeta del agent fue
movida, ejecuta nuevamente `INSTALAR-INICIO-AUTOMATICO.cmd`.

### La API indica que no hay impresora disponible

Comprueba que `INICIAR-AGENT.cmd` siga ejecutándose y que `PRINTER_ID` coincida
con `DEFAULT_PRINTER_ID`.

### El resumen normal no se imprime

Confirma que Windows tenga una impresora predeterminada y que puedas imprimir
una página de prueba desde el sistema.

### El ticket térmico sale cortado o con tamaño incorrecto

Confirma que el controlador tenga seleccionado el papel de 80 mm. Si el formato
tiene un nombre propio, copia ese nombre en `THERMAL_PAPER_SIZE`, reinicia el
agent y vuelve a probar.

### Otro PC provoca la desconexión

Dos agents no pueden usar simultáneamente el mismo `PRINTER_ID`. Detén el agent
anterior o asigna otro identificador.
