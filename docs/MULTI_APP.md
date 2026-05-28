# MatuPay multi-app (un servidor, muchas aplicaciones)

## Idea

- **Un solo despliegue** de MatuPay en tu VPS (un subdominio, un proceso PM2).
- **MatuDB** guarda apps, planes, suscripciones y pagos (`database/matudb_schema.sql`).
- Cada frontend (Winquina, MatuCash, etc.) solo configura variables en su `.env` y envía el identificador de app en cada request.

No hace falta una instancia ni un subdominio por aplicación.

## Tablas MatuDB

| Tabla | Uso |
|-------|-----|
| `payment_apps` | slug, CORS, URL de retorno, llaves Wompi, token opcional por app |
| `payment_plans` | precios por `app_slug` + `plan_id` |
| `payment_subscriptions` | estado PRO por usuario y app |
| `payment_records` | historial de cada pago aprobado |

## Registrar una app nueva

1. Ejecutar el SQL en el proyecto MatuDB central de pagos.
2. Insertar fila en `payment_apps` (slug único, ej. `matucash`).
3. Insertar planes en `payment_plans`.
4. Poner llaves Wompi en columnas `wompi_*` de esa fila (o compartir comercio si aplica).
5. En el frontend:

```env
VITE_BILLING_API_URL=https://pay.tudominio.com
VITE_PAYMENT_APP_ID=matucash
VITE_BILLING_API_TOKEN=token_global_o_por_app
VITE_BILLING_PLAN_ID=premium_monthly
```

6. Wompi: **una URL de webhook** para todo el servidor:

`https://pay.tudominio.com/api/billing/webhook/wompi`

El backend deduce la app desde la referencia (`winquina~plan~uid~timestamp`).

## API — header obligatorio (salvo webhook)

```
X-Payment-App: winquina
Authorization: Bearer <API_TOKEN>
```

También acepta `body.appId` en POST.

## Servidor (.env)

```env
MATUDB_URL=...
MATUDB_PROJECT_ID=...
MATUDB_API_KEY=...   # service role del proyecto central de pagos
API_TOKEN=...        # token global para todos los frontends
PORT=4100
```

Sin MatuDB configurado, el modo legacy sigue usando solo `PAYMENT_APP_ID` + variables Wompi del `.env` (útil en local).

## MatuCash vs MatuPay

- **MatuCash backend** (ya en producción): puede seguir igual mientras migras.
- **MatuPay backend** (este repo): versión 3 multi-tenant; súbelo **una vez** y conecta Winquina y el resto desde MatuDB.

## Seguridad

- No expongas `wompi_private_key` ni `wompi_integrity_secret` en el frontend.
- Opcional: `payment_apps.api_token` distinto por app; si está vacío, basta el `API_TOKEN` global.
