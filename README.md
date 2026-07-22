# 🖨️ Servicio Técnico – Print Agent

Agente Node.js que escucha eventos de una API via **Socket.IO** e imprime tickets de órdenes de servicio técnico en impresoras térmicas USB (ESC/POS).

---

## ¿Qué hace?

- Se conecta a la API mediante WebSocket (Socket.IO).
- Escucha el evento `print_ticket` con los datos de la orden.
- Imprime el ticket en una impresora térmica USB.
- Si el payload incluye una URL de seguimiento, imprime un **QR centrado** con el estado actual.
- Emite `print_success` al servidor al finalizar.
- Registra toda la actividad en logs rotativos diarios.

### Flujo oficial de disparo

- La API emite `print_ticket` cuando recibe una solicitud manual a `POST /service-orders/:id/print-80mm`.
- El alta de una orden (`POST /service-orders`) no debe disparar impresión automática.

---

## Requisitos

- Node.js >= 18
- Impresora térmica USB compatible con ESC/POS
- macOS / Linux (en Windows el soporte USB puede variar)

---

## Instalación

```bash
npm install
```

---

## Configuración

1. Copia `.env.example` a `.env`.
2. Ajusta los valores según tu entorno.

```bash
cp .env.example .env
```

Variables disponibles:

| Variable       | Por defecto              | Descripción                        |
|----------------|--------------------------|------------------------------------|
| `SERVER_URL`   | `http://localhost:3500`  | URL de la API con Socket.IO        |
| `PRINT_TOKEN`  | `tu_token_seguro`        | Token de autenticación del agente  |
| `LOG_LEVEL`    | `info`                   | Nivel de logs (`error`,`warn`,`info`,`debug`) |

Ejemplo de `.env`:

```env
SERVER_URL=https://tu-api.herokuapp.com
PRINT_TOKEN=mi_token_super_secreto
LOG_LEVEL=info
```

### Logs recomendados

- En produccion: `LOG_LEVEL=info` para ver conexion, inicio de impresion, resultados y errores.
- En diagnostico: `LOG_LEVEL=debug` para incluir eventos detallados (QR opcional, payload invalido, etc.).

---

## Scripts

```bash
# Desarrollo (ts-node, sin compilar)
npm run dev

# Compilar TypeScript → dist/
npm run build

# Producción (requiere build previo)
npm run start
```

---

## Payload esperado (`print_ticket`)

```json
{
  "orderId": "abc123",
  "orderNumber": "OT-0042",
  "mimeType": "text/plain",
  "content": "Texto del ticket...",
  "width": 40,
  "paperWidthMm": 80,
  "generatedAt": "2026-04-10T12:00:00.000Z",
  "tracking": {
    "url": "https://tu-dominio.com/tracking/abc123",
    "status": "in_progress",
    "statusLabelEs": "EN PROCESO"
  }
}
```

> El campo `tracking` es opcional. Si no viene, imprime solo el texto del ticket.

---

## Evento emitido tras imprimir (`print_success`)

```json
{
  "orderId": "abc123",
  "printedAt": "2026-04-10T12:00:05.000Z"
}
```

---

## Logs

Los logs se guardan en `logs/combined-YYYY-MM-DD.log` con rotación de 14 días.

```
2026-04-10T12:00:00.000Z [INFO]: Connected to API. socketId=abc123
2026-04-10T12:00:05.000Z [INFO]: Printing order OT-0042 (abc123)
2026-04-10T12:00:06.000Z [INFO]: QR printed.
2026-04-10T12:00:06.000Z [INFO]: Print success.
```

---

## Notas técnicas

- Se aplica un **shim de compatibilidad** para `usb v2` ya que `escpos-usb` espera la API legacy (`usb.on`, `usb.findByIds`, `usb.getDeviceList`).
- El QR se imprime **centrado** con tamaño reducido (`mode: normal, size: 4`). Ajusta `size: 3` si lo quieres más pequeño.

---

## Estructura del proyecto

```
serviciotecnico-agent/
├── agent.ts          # Código fuente principal
├── dist/             # Build compilado (generado, no en git)
├── logs/             # Logs rotativos (generado, no en git)
├── package.json
├── tsconfig.json
└── .gitignore
```

---

## Licencia

ISC
