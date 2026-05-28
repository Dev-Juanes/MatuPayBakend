# @devjuanes/matupay-backend

[![npm version](https://img.shields.io/npm/v/@devjuanes/matupay-backend.svg)](https://www.npmjs.com/package/@devjuanes/matupay-backend)
[![license: ISC](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)
[![node](https://img.shields.io/node/v/@devjuanes/matupay-backend)](https://nodejs.org)

Backend modular de **pasarelas de pago** para múltiples aplicaciones. Hoy incluye integración completa con **Wompi** (Colombia): checkout firmado, confirmación de transacciones, webhooks, suscripciones en Firestore y envío opcional de comprobantes por correo.

Funciona de **tres formas**:

1. **Librería npm** — integra pagos en tu backend existente
2. **Servidor standalone** — levanta la API con un comando
3. **Middleware Express** — monta las rutas en tu app

---

## Tabla de contenidos

- [Instalación](#instalación)
- [Inicio rápido](#inicio-rápido)
- [Configuración](#configuración)
- [Uso como librería](#uso-como-librería)
- [Servidor HTTP](#servidor-http)
- [API REST](#api-rest)
- [Webhooks Wompi](#webhooks-wompi)
- [Firebase y suscripciones](#firebase-y-suscripciones)
- [Correo de facturación](#correo-de-facturación)
- [Múltiples aplicaciones](#múltiples-aplicaciones)
- [Documentación extendida](#documentación-extendida)
- [Licencia](#licencia)

---

## Instalación

```bash
npm install @devjuanes/matupay-backend
```

Para desarrollo local del repositorio:

```bash
git clone https://github.com/Dev-Juanes/MatuPayBakend.git
cd MatuPayBakend
npm install
cp .env.example .env
```

---

## Inicio rápido

### 1. Configura variables de entorno

```env
PAYMENT_APP_ID=mi-app
WOMPI_ENV=test
WOMPI_TEST_PUBLIC_KEY=pub_test_...
WOMPI_TEST_PRIVATE_KEY=prv_test_...
WOMPI_TEST_INTEGRITY_SECRET=test_integrity_...
WOMPI_TEST_WEBHOOK_SECRET=test_events_...
FRONTEND_APP_URL=http://localhost:5173

PAYMENT_PLANS_JSON=[{"id":"basic","amountCop":9900,"period":"monthly","periodMonths":1,"currency":"COP"}]
```

### 2. Genera un checkout (librería)

```js
const { createWompiGateway } = require('@devjuanes/matupay-backend')

const gateway = createWompiGateway({
  environment: 'test',
  appId: 'mi-app',
  publicKey: process.env.WOMPI_TEST_PUBLIC_KEY,
  privateKey: process.env.WOMPI_TEST_PRIVATE_KEY,
  integritySecret: process.env.WOMPI_TEST_INTEGRITY_SECRET,
  webhookSecret: process.env.WOMPI_TEST_WEBHOOK_SECRET,
  plans: [
    { id: 'basic', amountCop: 9900, period: 'monthly', periodMonths: 1, currency: 'COP' }
  ],
  defaultRedirectUrl: 'http://localhost:5173/billing/return'
})

const checkout = gateway.createCheckout({
  customerId: 'user_123',
  planId: 'basic'
})

console.log(checkout.checkoutUrl)
// → https://checkout.wompi.co/p/?public-key=...
```

### 3. O levanta el servidor HTTP

```bash
# Con npx (sin clonar el repo)
npx matupay-server

# O desde el repo clonado
npm run dev
```

---

## Configuración

| Variable | Descripción |
|---|---|
| `PAYMENT_APP_ID` | Identificador de tu app (prefijo en referencias de pago) |
| `PAYMENT_GATEWAY` | Pasarela activa (`wompi`) |
| `PAYMENT_PLANS_JSON` | Planes y precios en JSON |
| `WOMPI_ENV` | `test` (sandbox) o `prod` |
| `WOMPI_*_PUBLIC_KEY` | Llave pública Wompi |
| `WOMPI_*_PRIVATE_KEY` | Llave privada Wompi |
| `WOMPI_*_INTEGRITY_SECRET` | Secreto para firmar checkout |
| `WOMPI_*_WEBHOOK_SECRET` | Secreto para validar webhooks |
| `FRONTEND_APP_URL` | URL de retorno tras el pago |
| `FIREBASE_*` | Credenciales para persistir suscripciones |
| `INVOICE_MAILER_*` | SMTP opcional para comprobantes |

Referencia completa: [docs/ENV.md](docs/ENV.md)

### Ejemplo de planes

```json
[
  {
    "id": "pro_monthly",
    "amountCop": 15000,
    "period": "monthly",
    "periodMonths": 1,
    "currency": "COP"
  },
  {
    "id": "pro_annual",
    "amountCop": 144000,
    "period": "annual",
    "periodMonths": 12,
    "currency": "COP"
  }
]
```

Si no defines `PAYMENT_PLANS_JSON`, se usan `CASHPRO_MONTHLY_COP` y `CASHPRO_ANNUAL_COP` como fallback.

---

## Uso como librería

### Crear gateway desde código

```js
const { createWompiGateway } = require('@devjuanes/matupay-backend')

const gateway = createWompiGateway({ /* config */ })
```

### Crear gateway desde variables de entorno

```js
require('dotenv').config()
const { createGatewayFromEnv } = require('@devjuanes/matupay-backend')

const gateway = createGatewayFromEnv()
const checkout = gateway.createCheckout({ customerId: 'u1', planId: 'basic' })
```

### Consultar transacción

```js
const tx = await gateway.fetchTransaction('12345-67890')
if (tx.status === 'APPROVED') {
  // activar acceso premium
}
```

### Validar webhook manualmente

```js
const isValid = gateway.verifyWebhook(req.body)
if (!isValid) return res.status(401).end()

const event = gateway.parseWebhookEvent(req.body)
// event.transactionId, event.reference, event.status, ...
```

Referencia completa: [docs/LIBRARY.md](docs/LIBRARY.md)

---

## Servidor HTTP

### Standalone

```bash
npx matupay-server
# o
npm start
```

### Montar en Express existente

```js
const express = require('express')
const { createApp } = require('@devjuanes/matupay-backend')

const app = express()
app.use('/payments', createApp()) // rutas en /payments/api/billing/...
app.listen(3000)
```

### Autenticación

Define `API_TOKEN` en el entorno. Todas las rutas `/api/*` (excepto webhooks) requieren:

```http
Authorization: Bearer tu_token
```

---

## API REST

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/health` | Estado del servicio |
| `GET` | `/api/billing/plans` | Planes configurados |
| `POST` | `/api/billing/checkout-link` | Generar link de pago |
| `POST` | `/api/billing/confirm-transaction` | Confirmar pago (polling) |
| `POST` | `/api/billing/webhook/wompi` | Webhook de Wompi |
| `GET` | `/api/billing/status/:uid` | Estado de suscripción |

### Crear checkout

```bash
curl -X POST http://localhost:4100/api/billing/checkout-link \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{
    "uid": "user_123",
    "email": "cliente@ejemplo.com",
    "planId": "pro_monthly"
  }'
```

Referencia completa con ejemplos de respuesta: [docs/API.md](docs/API.md)

---

## Webhooks Wompi

1. En el [dashboard de Wompi](https://comercios.wompi.co), configura la URL de eventos:

   ```
   https://tu-dominio.com/api/billing/webhook/wompi
   ```

2. Usa el secreto de eventos en tu `.env`:

   ```env
   WOMPI_PROD_WEBHOOK_SECRET=prod_events_...
   ```

3. El servidor valida el checksum, activa la suscripción en Firestore y envía comprobante si el correo está habilitado.

> En producción, confía en el webhook como fuente principal. `confirm-transaction` sirve como respaldo desde el frontend.

---

## Firebase y suscripciones

Configura Firebase Admin para persistir el estado:

```env
FIREBASE_PROJECT_ID=mi-proyecto
FIREBASE_SERVICE_ACCOUNT_FILE=./firebase-admin.json
```

Estructura en Firestore:

```
users/{uid}
  └── subscription: { status, planId, periodEndMs, ... }
  └── subscription_payments/{transactionId}: { amountCop, paidAtMs, ... }
```

---

## Correo de facturación

Activa el envío automático de comprobante tras un pago aprobado:

```env
INVOICE_MAILER_ENABLED=true
INVOICE_MAILER_HOST=smtp.gmail.com
INVOICE_MAILER_PORT=465
INVOICE_MAILER_SECURE=true
INVOICE_MAILER_USER=tu-correo@gmail.com
INVOICE_MAILER_PASS=contraseña-de-aplicacion
INVOICE_MAILER_FROM="Mi App <tu-correo@gmail.com>"
INVOICE_BRAND_NAME=Mi App
```

También puedes llamarlo manualmente:

```js
const { sendPaymentInvoice } = require('@devjuanes/matupay-backend')

await sendPaymentInvoice({
  to: 'cliente@ejemplo.com',
  customerName: 'Juan',
  planId: 'pro_monthly',
  amountCop: 15000,
  transactionId: 'txn_123',
  reference: 'mi-app_pro_monthly_user_123_...'
})
```

---

## Múltiples aplicaciones (v3)

**Un solo despliegue** y registro de cada app en MatuDB (`payment_apps`, `payment_plans`, …). Los frontends envían `X-Payment-App` (ej. `winquina`).

Ver **[docs/MULTI_APP.md](./docs/MULTI_APP.md)**.

Referencias: `appId~planId~customerId~timestamp`

---

## Documentación extendida

| Documento | Contenido |
|---|---|
| [docs/ENV.md](docs/ENV.md) | Todas las variables de entorno |
| [docs/API.md](docs/API.md) | Referencia HTTP con ejemplos |
| [docs/LIBRARY.md](docs/LIBRARY.md) | API de la librería |

---

## Producción

```bash
npm run pm2:start
npm run pm2:logs
```

Requiere PM2 instalado globalmente. Ver `ecosystem.config.cjs` en el repositorio.

---

## Licencia

[ISC](LICENSE) — Dev Juanes
