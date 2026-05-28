# Deploy MatuPay en pay.matudb.com

Un solo proceso PM2 (`matupay-api`) en el puerto **4102** (4100 suele estar ocupado por MatuCash).

## 1. DNS (obligatorio antes de Certbot)

En el panel donde gestionas **matudb.com** (Cloudflare, Namecheap, etc.):

| Tipo | Nombre / Host | Valor | TTL |
|------|----------------|-------|-----|
| **A** | `pay` | IP pública del VPS (la misma que `matudb.com`) | 300 o Auto |

Comprueba propagación (desde tu PC o el servidor):

```bash
dig +short pay.matudb.com A
# debe devolver la IP del VPS, no vacío
```

Si ves `NXDOMAIN` o sin respuesta, **no ejecutes certbot todavía**.

> En Cloudflare: registro **DNS only** (nube gris) la primera vez suele ir mejor para Let's Encrypt.

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

Tras `git pull`, reinicia **con el ecosystem** (no solo el nombre):

```bash
cd ~/apps/MatuPayBakend
git pull origin main
npm run pm2:restart
# equivalente:
# pm2 restart ecosystem.config.cjs --env production
pm2 save
```

> `pm2 restart matupay-api --env production` **no aplica** `env_production` sin el archivo ecosystem.

## 4. Nginx (conflicto con `*.matudb.com`)

En el VPS, **matudb-api** suele usar `server_name *.matudb.com` → puerto **3004**.
Si `pay.matudb.com` no tiene su propio bloque **443**, HTTPS cae en MatuDB y verás CORS con `apikey`, no `x-payment-app`.

```bash
# 1) MatuPay responde en local
curl -s http://127.0.0.1:4102/api/health
# → {"ok":true,"service":"matupay-api",...}

sudo cp deploy/nginx/pay-matudb.conf /etc/nginx/sites-available/pay-matudb.conf
sudo ln -sf /etc/nginx/sites-available/pay-matudb.conf /etc/nginx/sites-enabled/pay-matudb.conf
sudo nginx -t
sudo systemctl reload nginx
```

Si no existen certificados SSL para pay:

```bash
sudo certbot --nginx -d pay.matudb.com
```

Comprueba que **HTTPS** ya es MatuPay:

```bash
curl -s https://pay.matudb.com/api/health
curl -s -X OPTIONS https://pay.matudb.com/api/billing/plans \
  -H "Origin: https://winquina.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,x-payment-app" \
  -D - -o /dev/null | grep -i access-control-allow-headers
```

Debe incluir `x-payment-app`, no solo `apikey`.

## 5. Probar **sin SSL** (mientras propagas DNS)

```bash
# API directa (PM2)
curl -s http://127.0.0.1:4102/api/health

# Nginx HTTP (puerto 80)
curl -s -H "Host: pay.matudb.com" http://127.0.0.1/api/health
```

Si el primero responde `{"ok":true,...}` pero el segundo no, revisa nginx. Si ambos OK, MatuPay está bien; solo falta DNS/SSL.

## 6. SSL (solo cuando `dig pay.matudb.com` devuelve tu IP)

```bash
sudo certbot --nginx -d pay.matudb.com
```

## 7. Verificar HTTPS

```bash
curl -s https://pay.matudb.com/api/health
curl -s -H "Authorization: Bearer $API_TOKEN" -H "X-Payment-App: winquina" \
  https://pay.matudb.com/api/billing/plans
```

### Errores frecuentes

| Síntoma | Causa | Qué hacer |
|---------|--------|-----------|
| Certbot `NXDOMAIN` | No existe registro A `pay` | Crear DNS y esperar 5–30 min |
| `SSL: no alternative certificate subject name` | HTTPS sin certificado para `pay` | No uses `https://` hasta certbot OK; prueba `http://127.0.0.1:4102` |
| PM2 `Environment [production] is not defined` | Falta `env_production` en ecosystem | `git pull` y `pm2 restart matupay-api --env production` |

## 8. Wompi

Webhook (una URL para todas las apps):

`https://pay.matudb.com/api/billing/webhook/wompi`

## 9. Frontends (Winquina, etc.)

```env
VITE_BILLING_API_URL=https://pay.matudb.com
VITE_PAYMENT_APP_ID=winquina
VITE_BILLING_API_TOKEN=<mismo API_TOKEN>
VITE_BILLING_PLAN_ID=winquina_pro_monthly
```

Cliente npm: `@devjuanes/matupay` → clase `MatuPayBilling`.

## 10. Publicar npm

```bash
# Backend
cd MatuPayBakend && npm version patch && npm publish

# Cliente frontend
cd matu-db-api/packages/matupay && npm run build && npm version minor && npm publish
```
