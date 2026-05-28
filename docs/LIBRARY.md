# Referencia de la librería

Instalación:

```bash
npm install @devjuanes/matupay-backend
```

## Exportaciones principales

```js
const {
  createWompiGateway,
  createGateway,
  createGatewayFromEnv,
  loadEnvConfig,
  loadPlansFromEnv,
  createApp,
  sendPaymentInvoice
} = require('@devjuanes/matupay-backend')
```

---

## createWompiGateway(config)

Crea una instancia de pasarela Wompi.

### Config

| Campo | Tipo | Default | Descripción |
|---|---|---|---|
| `environment` | `'test' \| 'prod'` | `'prod'` | Entorno activo |
| `appId` | string | `'app'` | Prefijo de referencias de pago |
| `publicKey` | string | — | Llave pública Wompi |
| `privateKey` | string | — | Llave privada Wompi |
| `integritySecret` | string | — | Secreto de integridad (checkout) |
| `webhookSecret` | string | — | Secreto de eventos (webhook) |
| `prodBaseUrl` | string | `https://production.wompi.co/v1` | API producción |
| `testBaseUrl` | string | `https://sandbox.wompi.co/v1` | API sandbox |
| `defaultRedirectUrl` | string | `''` | URL de retorno por defecto |
| `plans` | Plan[] | `[]` | Planes disponibles |

### Plan

```ts
{
  id: string           // identificador único, ej: "pro_monthly"
  amountCop: number    // monto en pesos colombianos
  period: 'monthly' | 'annual'
  periodMonths: number // 1 o 12
  currency: string     // default "COP"
}
```

### Métodos del gateway

#### `listPlans()`

Retorna array de planes configurados.

#### `getPlan(planId)`

Retorna un plan o `null`.

#### `createCheckout({ customerId, planId, redirectUrl?, email?, fullName?, phone? })`

Genera referencia, firma de integridad y URL de checkout.

```js
const checkout = gateway.createCheckout({
  customerId: 'user_123',
  planId: 'pro_monthly',
  redirectUrl: 'https://mi-app.com/billing/return'
})

// checkout.checkoutUrl → abrir en el navegador
// checkout.reference   → guardar para validar el pago
```

#### `fetchTransaction(transactionId, { environment? })`

Consulta una transacción en la API de Wompi.

```js
const tx = await gateway.fetchTransaction('12345-67890')
console.log(tx.status) // APPROVED, DECLINED, etc.
```

#### `verifyWebhook(payload)`

Valida el checksum del evento Wompi. Retorna `boolean`.

#### `parseWebhookEvent(payload)`

Extrae datos normalizados del evento:

```js
{
  event: string
  transactionId: string
  reference: string
  status: string
  amountInCents: number
  currency: string
  customerEmail: string
}
```

#### `parsePaymentReference(reference)`

Parsea una referencia generada por este gateway:

```js
{
  appId: string
  planId: string
  customerId: string
  timestamp: number
}
```

Formato de referencia: `{appId}_{planId}_{customerId}_{timestamp}`

---

## createGatewayFromEnv()

Crea el gateway leyendo variables de entorno (requiere `.env` o vars del sistema).

```js
require('dotenv').config()
const { createGatewayFromEnv } = require('@devjuanes/matupay-backend')

const gateway = createGatewayFromEnv()
```

---

## loadPlansFromEnv(envLike)

Parsea planes desde `PAYMENT_PLANS_JSON` o fallback `CASHPRO_*`.

```js
const plans = loadPlansFromEnv({
  paymentPlansJson: process.env.PAYMENT_PLANS_JSON,
  cashProMonthlyCop: 15000,
  cashProAnnualCop: 144000
})
```

---

## createApp()

Retorna la app Express configurada (sin `listen`). Útil para montar en tu propio servidor:

```js
const express = require('express')
const { createApp } = require('@devjuanes/matupay-backend')

const root = express()
root.use('/payments', createApp())
root.listen(3000)
```

---

## sendPaymentInvoice(options)

Envía comprobante por correo (requiere `INVOICE_MAILER_*` en env).

```js
await sendPaymentInvoice({
  to: 'cliente@ejemplo.com',
  customerName: 'Juan Pérez',
  planId: 'pro_monthly',
  amountCop: 15000,
  transactionId: 'txn_123',
  reference: 'matuai_pro_monthly_user_123_...',
  paidAtMs: Date.now()
})
```

---

## Funciones de bajo nivel (Wompi)

Para integraciones custom sin el wrapper completo:

```js
const {
  buildCheckoutUrl,
  buildReference,
  parseReference,
  buildIntegritySignature,
  getTransaction,
  verifyEventChecksum,
  extractTransactionFromEvent
} = require('@devjuanes/matupay-backend')
```
