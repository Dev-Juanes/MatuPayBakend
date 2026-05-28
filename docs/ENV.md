# Variables de entorno

Copia `.env.example` a `.env` y completa los valores.

## Servidor

| Variable | Default | Descripción |
|---|---|---|
| `PORT` | `4100` | Puerto HTTP |
| `NODE_ENV` | `development` | Entorno Node |
| `CORS_ORIGIN` | `http://localhost:5173,...` | Orígenes permitidos (CSV) |
| `API_TOKEN` | _(vacío)_ | Bearer token para `/api/*` |
| `TRUST_PROXY` | `true` | Trust proxy (Nginx/PM2) |

## App / pasarela

| Variable | Default | Descripción |
|---|---|---|
| `PAYMENT_APP_ID` | `matupay` | ID de la app (prefijo en referencias) |
| `PAYMENT_GATEWAY` | `wompi` | Pasarela activa |
| `FRONTEND_APP_URL` | `http://localhost:5173` | URL base del frontend |
| `PAYMENT_PLANS_JSON` | _(vacío)_ | Planes en JSON (ver abajo) |

### Planes por JSON

```env
PAYMENT_PLANS_JSON=[{"id":"pro_monthly","amountCop":15000,"period":"monthly","periodMonths":1,"currency":"COP"},{"id":"pro_annual","amountCop":144000,"period":"annual","periodMonths":12,"currency":"COP"}]
```

### Fallback sin JSON

| Variable | Default |
|---|---|
| `CASHPRO_MONTHLY_COP` | `15000` |
| `CASHPRO_ANNUAL_COP` | `144000` |

Genera planes `pro_monthly_usd_20` y `pro_annual_usd_200`.

## Wompi

| Variable | Descripción |
|---|---|
| `WOMPI_ENV` | `test` o `prod` |
| `WOMPI_PROD_PUBLIC_KEY` | Llave pública producción |
| `WOMPI_PROD_PRIVATE_KEY` | Llave privada producción |
| `WOMPI_PROD_INTEGRITY_SECRET` | Secreto integridad producción |
| `WOMPI_PROD_WEBHOOK_SECRET` | Secreto webhook producción |
| `WOMPI_TEST_PUBLIC_KEY` | Llave pública sandbox |
| `WOMPI_TEST_PRIVATE_KEY` | Llave privada sandbox |
| `WOMPI_TEST_INTEGRITY_SECRET` | Secreto integridad sandbox |
| `WOMPI_TEST_WEBHOOK_SECRET` | Secreto webhook sandbox |
| `WOMPI_BASE_URL` | API prod (default oficial) |
| `WOMPI_TEST_BASE_URL` | API sandbox (default oficial) |

Aliases soportados: `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, etc. (mapean a prod).

## Firebase (suscripciones)

| Variable | Descripción |
|---|---|
| `FIREBASE_PROJECT_ID` | ID del proyecto |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON inline del service account |
| `FIREBASE_SERVICE_ACCOUNT_FILE` | Ruta al archivo JSON |

Firestore paths:

- `users/{uid}.subscription`
- `users/{uid}/subscription_payments/{transactionId}`

## Correo de facturación (opcional)

| Variable | Default | Descripción |
|---|---|---|
| `INVOICE_MAILER_ENABLED` | `false` | Activar envío de comprobantes |
| `INVOICE_MAILER_HOST` | `smtp.gmail.com` | Host SMTP |
| `INVOICE_MAILER_PORT` | `465` | Puerto SMTP |
| `INVOICE_MAILER_SECURE` | `true` | TLS/SSL |
| `INVOICE_MAILER_USER` | — | Usuario SMTP |
| `INVOICE_MAILER_PASS` | — | Contraseña SMTP |
| `INVOICE_MAILER_FROM` | — | Remitente |
| `INVOICE_BRAND_NAME` | `MatuPay` | Nombre en el asunto del correo |

## Múltiples aplicaciones

Despliega **una instancia por app** con su propio `.env`:

```env
# Instancia MatuAI
PAYMENT_APP_ID=matuai
WOMPI_ENV=prod
PAYMENT_PLANS_JSON=[{"id":"pro","amountCop":20000,...}]

# Instancia MatuCash (otro servidor/puerto)
PAYMENT_APP_ID=matucash
WOMPI_ENV=prod
PAYMENT_PLANS_JSON=[{"id":"premium","amountCop":15000,...}]
```

Cada instancia puede usar credenciales Wompi distintas y planes distintos.
