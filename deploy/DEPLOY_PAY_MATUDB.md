# Deploy MatuPay en pay.matudb.com

Un solo proceso PM2 (`matupay-api`) en el puerto **4102** (4100 suele estar ocupado por MatuCash).

## 1. DNS

| Tipo | Host | Valor |
|------|------|--------|
| A | `pay` | IP pública del VPS |

## 2. Subir código

```bash
cd ~/apps
git clone https://github.com/Dev-Juanes/MatuPayBakend.git
cd MatuPayBakend
npm ci
cp .env.example .env
nano .env
```

### `.env` mínimo producción

```env
PORT=4102
NODE_ENV=production
TRUST_PROXY=true
API_TOKEN=<token-largo-aleatorio>

MATUDB_URL=https://db.matudb.com
MATUDB_PROJECT_ID=<uuid-proyecto-pagos>
MATUDB_API_KEY=<service-key>

CORS_ORIGIN=https://matudb.com,https://www.matudb.com,https://winquina.com,https://www.winquina.com

INVOICE_MAILER_ENABLED=false
```

Ejecuta `database/matudb_schema.sql` en MatuDB y completa `payment_apps` / `payment_plans` con llaves Wompi.

## 3. PM2

```bash
npm run pm2:start
pm2 list
pm2 logs matupay-api --lines 50
pm2 save
```

## 4. Nginx

```bash
sudo cp deploy/nginx/pay-matudb.conf /etc/nginx/sites-available/pay-matudb.conf
sudo ln -sf /etc/nginx/sites-available/pay-matudb.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 5. SSL

```bash
sudo certbot --nginx -d pay.matudb.com
```

## 6. Verificar

```bash
curl https://pay.matudb.com/api/health
curl -H "Authorization: Bearer $API_TOKEN" -H "X-Payment-App: winquina" \
  https://pay.matudb.com/api/billing/plans
```

## 7. Wompi

Webhook (una URL para todas las apps):

`https://pay.matudb.com/api/billing/webhook/wompi`

## 8. Frontends (Winquina, etc.)

```env
VITE_BILLING_API_URL=https://pay.matudb.com
VITE_PAYMENT_APP_ID=winquina
VITE_BILLING_API_TOKEN=<mismo API_TOKEN>
VITE_BILLING_PLAN_ID=winquina_pro_monthly
```

Cliente npm: `@devjuanes/matupay` → clase `MatuPayBilling`.

## 9. Publicar npm

```bash
# Backend
cd MatuPayBakend && npm version patch && npm publish

# Cliente frontend
cd matu-db-api/packages/matupay && npm run build && npm version minor && npm publish
```
