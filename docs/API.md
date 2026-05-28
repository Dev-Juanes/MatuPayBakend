# Referencia HTTP API

Base URL por defecto: `http://localhost:4100`

Todas las rutas bajo `/api` (excepto webhooks) aceptan autenticación opcional:

```http
Authorization: Bearer <API_TOKEN>
```

Si `API_TOKEN` no está definido en el servidor, las rutas quedan abiertas.

---

## GET /api/health

Estado del servicio.

**Respuesta 200**

```json
{
  "ok": true,
  "service": "matupay-api",
  "appId": "matuai",
  "gateway": "wompi",
  "wompiEnv": "test",
  "env": "development",
  "timestamp": 1716844800000,
  "uptimeSec": 42,
  "corsOrigins": ["http://localhost:5173"],
  "invoiceMailerEnabled": false
}
```

---

## GET /api/billing/plans

Lista los planes configurados para la app activa.

**Respuesta 200**

```json
{
  "ok": true,
  "data": {
    "appId": "matuai",
    "gateway": "wompi",
    "environment": "test",
    "plans": [
      {
        "id": "pro_monthly",
        "amountCop": 15000,
        "period": "monthly",
        "periodMonths": 1,
        "currency": "COP"
      }
    ]
  }
}
```

---

## POST /api/billing/checkout-link

Genera un enlace de checkout Wompi firmado.

**Body**

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `uid` | string | sí | ID del usuario/cliente |
| `email` | string | sí | Email del pagador |
| `planId` | string | sí | ID del plan (también acepta `planCode`) |
| `fullName` | string | no | Nombre del pagador |
| `phone` | string | no | Teléfono |
| `redirectUrl` | string | no | URL de retorno tras el pago |

**Ejemplo**

```json
{
  "uid": "user_abc123",
  "email": "cliente@ejemplo.com",
  "planId": "pro_monthly",
  "fullName": "Juan Pérez",
  "redirectUrl": "https://mi-app.com/billing/return"
}
```

**Respuesta 200**

```json
{
  "ok": true,
  "data": {
    "reference": "matuai_pro_monthly_user_abc123_1716844800123",
    "planId": "pro_monthly",
    "period": "monthly",
    "amountInCents": 1500000,
    "amountCop": 15000,
    "currency": "COP",
    "checkoutUrl": "https://checkout.wompi.co/p/?public-key=..."
  }
}
```

**Errores comunes**

| Código | Motivo |
|---|---|
| 400 | Faltan `uid`, `email` o `planId` |
| 500 | Credenciales Wompi incompletas o plan inválido |

---

## POST /api/billing/confirm-transaction

Consulta el estado de una transacción en Wompi y activa la suscripción si fue aprobada.

> Recomendado como respaldo. En producción usa el webhook.

**Body**

| Campo | Tipo | Requerido |
|---|---|---|
| `uid` | string | sí |
| `transactionId` | string | sí |
| `email` | string | no (para comprobante) |
| `fullName` | string | no |
| `environment` | string | no (`test` / `prod`) |

**Respuesta 200 (aprobada)**

```json
{
  "ok": true,
  "data": {
    "transactionStatus": "APPROVED",
    "subscription": {
      "status": "active",
      "periodEndMs": 1719523200000,
      "planId": "pro_monthly",
      "amountCop": 15000
    }
  }
}
```

---

## POST /api/billing/webhook/wompi

Recibe eventos de Wompi. **No requiere** `Authorization`.

Configura en el dashboard de Wompi:

```
https://tu-dominio.com/api/billing/webhook/wompi
```

El servidor valida el checksum con `WOMPI_*_WEBHOOK_SECRET`.

**Respuesta 200**

```json
{ "ok": true }
```

**Errores**

| Código | Motivo |
|---|---|
| 401 | Firma/checksum inválido |
| 400 | Evento incompleto o referencia desconocida |

---

## GET /api/billing/status/:uid

Consulta el estado de suscripción de un usuario en Firestore.

**Respuesta 200**

```json
{
  "ok": true,
  "data": {
    "appId": "matuai",
    "planId": "pro_monthly",
    "billingPeriod": "monthly",
    "status": "active",
    "periodEndMs": 1719523200000,
    "currentAmountCop": 15000,
    "isActive": true,
    "recentPayments": [
      {
        "id": "txn_123",
        "transactionId": "txn_123",
        "billingPeriod": "monthly",
        "amountCop": 15000,
        "paidAtMs": 1716844800000
      }
    ]
  }
}
```
