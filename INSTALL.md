# Instalación del agent portable en Windows

Este paquete ya incluye Node.js, las dependencias y el código compilado. En el
PC que imprimirá no necesitas instalar Node, npm, Git, la API ni el frontend.

## Requisitos

- Windows de 64 bits.
- Acceso por red a la API de Servicio Técnico.
- El `PRINT_TOKEN` configurado en la API.
- Una impresora instalada:
  - Para el resumen normal, debe ser la impresora predeterminada de Windows.
  - Para el ticket térmico, debe ser USB y compatible con ESC/POS.

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
```

5. Guarda y cierra el Bloc de notas.
6. Ejecuta `INICIAR-AGENT.cmd`.

La instalación funciona cuando la ventana muestra un mensaje similar a:

```text
Connected to API. ... agentId=recepcion-pc-01 printerId=default-printer
```

Mantén esa ventana abierta para recibir trabajos de impresión.

## Significado de la configuración

- `SERVER_URL`: dirección accesible de la API, sin rutas adicionales.
- `PRINT_TOKEN`: debe coincidir exactamente con el valor de la API.
- `AGENT_ID`: nombre único para identificar este PC.
- `PRINTER_ID`: debe coincidir con `DEFAULT_PRINTER_ID` de la API.
- `LOG_LEVEL`: normalmente debe permanecer en `info`.

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

Conecta la impresora USB, instala sus controladores si Windows los solicita y
confirma que sea compatible con ESC/POS.

## Problemas básicos

### El agent no se conecta

Revisa `SERVER_URL`, `PRINT_TOKEN`, la conexión a internet y que la API esté
activa.

### La API indica que no hay impresora disponible

Comprueba que `INICIAR-AGENT.cmd` siga ejecutándose y que `PRINTER_ID` coincida
con `DEFAULT_PRINTER_ID`.

### El resumen normal no se imprime

Confirma que Windows tenga una impresora predeterminada y que puedas imprimir
una página de prueba desde el sistema.

### Otro PC provoca la desconexión

Dos agents no pueden usar simultáneamente el mismo `PRINTER_ID`. Detén el agent
anterior o asigna otro identificador.
