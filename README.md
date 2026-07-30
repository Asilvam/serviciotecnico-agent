# Servicio Técnico – Print Agent

Agente local Node.js que recibe trabajos por Socket.IO y los imprime de forma
serial. Soporta dos perfiles:

- `thermal_escpos`: ticket de 80 mm en una impresora térmica USB ESC/POS.
- `system_pdf`: resumen A4 o Carta en la impresora predeterminada del sistema.

El resumen PDF contiene orden, estado, cliente, técnico, equipo, falla,
diagnóstico, trabajo realizado, repuestos, costos, fechas y el mismo QR de
seguimiento utilizado por el ticket térmico.

## Flujo

1. La API recibe `POST /service-orders/:id/print`.
2. Comprueba que el agent registrado para `DEFAULT_PRINTER_ID` esté conectado.
3. El agent acepta el trabajo, lo agrega a su cola local y procesa solo uno a la
   vez.
4. Según `printerProfile`, imprime por USB ESC/POS o genera un PDF temporal y lo
   entrega a la cola predeterminada del sistema operativo.
5. Emite `print_sent` cuando el dispositivo o la cola del sistema acepta los
   datos. Este estado no confirma la salida física del papel.

`POST /service-orders/:id/print-80mm` se mantiene como alias compatible y fuerza
el perfil térmico. El endpoint general recibe el perfil elegido para cada
trabajo; `PRINT_PROFILE` en la API solo se usa cuando la solicitud lo omite.

## Requisitos

- Node.js >= 18.
- Una API accesible y el mismo `PRINT_TOKEN` seguro en ambos procesos.
- Perfil térmico: impresora USB compatible con ESC/POS.
- Perfil PDF en macOS/Linux: una impresora predeterminada configurada y el
  comando `lp` disponible mediante CUPS.
- Perfil PDF en Windows: una impresora predeterminada configurada. El agent usa
  el spooler de Windows mediante `pdf-to-printer`; no necesita CUPS.

## Instalación y configuración

Para instalar en un PC Windows sin Node.js, descarga el paquete portable
`serviciotecnico-agent-windows-x64` desde Releases o desde el workflow
**Build Windows portable agent** y sigue [INSTALL.md](INSTALL.md).

Para desarrollar o ejecutar desde el código fuente:

```bash
npm install
cp .env.example .env
```

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `SERVER_URL` | `http://localhost:3500` | URL de la API con Socket.IO |
| `PRINT_TOKEN` | sin valor | Secreto largo compartido con la API |
| `AGENT_ID` | hostname | Identidad estable del agent |
| `PRINTER_ID` | `default-printer` | Identificador lógico; debe coincidir con `DEFAULT_PRINTER_ID` |
| `LOG_LEVEL` | `info` | `error`, `warn`, `info` o `debug` |

Ejemplo:

```env
SERVER_URL=http://localhost:3500
PRINT_TOKEN=un-secreto-largo-y-aleatorio
AGENT_ID=recepcion-01
PRINTER_ID=default-printer
LOG_LEVEL=info
```

Para dejar el resumen como fallback de clientes que no envían perfil, configura:

```env
DEFAULT_PRINTER_ID=default-printer
PRINT_PROFILE=system_pdf
SYSTEM_PAPER_SIZE=LETTER
```

`SYSTEM_PAPER_SIZE` acepta `A4` o `LETTER`. Para volver a la térmica usa
`PRINT_PROFILE=thermal_escpos`.

### Impresora predeterminada

- macOS: revisa la predeterminada con `lpstat -d`.
- Linux: revisa la predeterminada con `lpstat -d`; si no existe, configúrala en
  CUPS o en los ajustes de impresión del escritorio.
- Windows: define la impresora predeterminada en Configuración > Bluetooth y
  dispositivos > Impresoras y escáneres.

El perfil PDF no contiene un nombre fijo de impresora. Al omitirlo, cada equipo
usa su propia impresora predeterminada.

## Scripts

```bash
npm run dev
npm run build
npm run start
```

## Contrato de impresión

El evento `print_ticket` incluye correlación y perfil:

```json
{
  "type": "service_order_ticket",
  "jobId": "8f910a4d-...",
  "printerId": "default-printer",
  "printerProfile": "system_pdf",
  "paperSize": "A4",
  "orderId": "abc123",
  "orderNumber": "OT-0042",
  "content": "Texto compatible con la térmica...",
  "tracking": {
    "url": "https://tu-dominio.com/tracking/token-firmado",
    "status": "in_progress",
    "statusLabelEs": "EN PROCESO"
  },
  "summary": {
    "customerName": "Cliente",
    "deviceType": "Notebook",
    "deviceBrand": "Lenovo",
    "problemDescription": "No enciende",
    "diagnosis": "Fuente defectuosa",
    "laborCost": 20000,
    "partsCost": 15000,
    "totalCost": 35000,
    "items": []
  }
}
```

El agent rechaza payloads sin `jobId`, perfil, resumen, impresora lógica o URL
de seguimiento.

## Entrega, errores y seguridad

- La cola local evita accesos simultáneos al USB o al spooler.
- Los últimos 1000 `jobId` se recuerdan para ignorar duplicados durante la vida
  del proceso.
- En térmica, `print_sent` se emite tras `flush` y cierre USB.
- En PDF, `print_sent` se emite cuando `lp` o el spooler de Windows acepta el
  archivo.
- Un fallo genera `print_error` con `code`, `message` y `outcomeUncertain`.
- Los PDF se crean en una carpeta temporal única y se eliminan después de que el
  comando de impresión termina.
- Los logs rotan diariamente en `logs/` y se conservan 14 días.

## Estructura

```text
agent.ts                 conexión, validación y cola
printer-contract.ts      contrato compartido del payload
thermal-printer.ts       salida USB ESC/POS
system-pdf-printer.ts    PDF, QR y spooler del sistema
print-agent-error.ts     errores correlacionados
```

## Licencia

ISC
