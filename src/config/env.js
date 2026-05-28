const dotenv = require('dotenv')
const { loadPlansFromEnv } = require('./plans')

dotenv.config()

function toBool(value, fallback = false) {
  if (value == null) return fallback
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())
}

function toInt(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function splitCsv(value) {
  const normalizeOrigin = (origin) => String(origin || '').trim().replace(/\/+$/, '')
  return String(value || '')
    .split(',')
    .map((x) => normalizeOrigin(x))
    .filter(Boolean)
}

const corsOrigins = splitCsv(
  process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000'
)

const wompiEnv = String(process.env.WOMPI_ENV || (process.env.NODE_ENV === 'production' ? 'prod' : 'test'))
  .trim()
  .toLowerCase() === 'prod'
  ? 'prod'
  : 'test'

const wompiProdPublicKey = String(process.env.WOMPI_PROD_PUBLIC_KEY || process.env.WOMPI_PUBLIC_KEY || '').trim()
const wompiProdPrivateKey = String(process.env.WOMPI_PROD_PRIVATE_KEY || process.env.WOMPI_PRIVATE_KEY || '').trim()
const wompiProdIntegritySecret = String(process.env.WOMPI_PROD_INTEGRITY_SECRET || process.env.WOMPI_INTEGRITY_SECRET || '').trim()
const wompiProdWebhookSecret = String(process.env.WOMPI_PROD_WEBHOOK_SECRET || process.env.WOMPI_WEBHOOK_SECRET || '').trim()
const wompiTestPublicKey = String(process.env.WOMPI_TEST_PUBLIC_KEY || '').trim()
const wompiTestPrivateKey = String(process.env.WOMPI_TEST_PRIVATE_KEY || '').trim()
const wompiTestIntegritySecret = String(process.env.WOMPI_TEST_INTEGRITY_SECRET || '').trim()
const wompiTestWebhookSecret = String(process.env.WOMPI_TEST_WEBHOOK_SECRET || '').trim()

const cashProMonthlyCop = toInt(process.env.CASHPRO_MONTHLY_COP, 15000)
const cashProSemesterCop = toInt(process.env.CASHPRO_SEMESTER_COP, 81000)
const cashProAnnualCop = toInt(process.env.CASHPRO_ANNUAL_COP, 144000)

const paymentPlans = loadPlansFromEnv({
  paymentPlansJson: process.env.PAYMENT_PLANS_JSON,
  cashProMonthlyCop,
  cashProAnnualCop
})

const env = {
  port: toInt(process.env.PORT, 4100),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: corsOrigins.length ? corsOrigins : ['http://localhost:5173'],
  apiToken: process.env.API_TOKEN || '',
  trustProxy: toBool(process.env.TRUST_PROXY, true),

  paymentAppId: String(process.env.PAYMENT_APP_ID || process.env.APP_ID || 'matupay').trim(),
  paymentGateway: String(process.env.PAYMENT_GATEWAY || 'wompi').trim().toLowerCase(),
  paymentPlansJson: process.env.PAYMENT_PLANS_JSON || '',
  paymentPlans,
  cashProMonthlyCop,
  cashProSemesterCop,
  cashProAnnualCop,

  frontendAppUrl: String(process.env.FRONTEND_APP_URL || 'http://localhost:5173').trim().replace(/\/+$/, ''),

  matudbUrl: String(process.env.MATUDB_URL || '').trim().replace(/\/+$/, ''),
  matudbProjectId: String(process.env.MATUDB_PROJECT_ID || '').trim(),
  matudbApiKey: String(process.env.MATUDB_API_KEY || '').trim(),
  matudbUseSupabase: toBool(process.env.MATUDB_USE_SUPABASE, false),

  wompiEnv,
  wompiPublicKey: wompiEnv === 'test' ? wompiTestPublicKey : wompiProdPublicKey,
  wompiPrivateKey: wompiEnv === 'test' ? wompiTestPrivateKey : wompiProdPrivateKey,
  wompiIntegritySecret: wompiEnv === 'test' ? wompiTestIntegritySecret : wompiProdIntegritySecret,
  wompiWebhookSecret: wompiEnv === 'test' ? wompiTestWebhookSecret : wompiProdWebhookSecret,
  wompiBaseUrl: String(process.env.WOMPI_BASE_URL || 'https://production.wompi.co/v1').trim().replace(/\/+$/, ''),
  wompiTestBaseUrl: String(process.env.WOMPI_TEST_BASE_URL || 'https://sandbox.wompi.co/v1').trim().replace(/\/+$/, ''),

  invoiceMailerEnabled: toBool(process.env.INVOICE_MAILER_ENABLED, false),
  invoiceMailerHost: String(process.env.INVOICE_MAILER_HOST || 'smtp.gmail.com').trim(),
  invoiceMailerPort: toInt(process.env.INVOICE_MAILER_PORT, 465),
  invoiceMailerSecure: toBool(process.env.INVOICE_MAILER_SECURE, true),
  invoiceMailerUser: String(process.env.INVOICE_MAILER_USER || '').trim(),
  invoiceMailerPass: String(process.env.INVOICE_MAILER_PASS || '').trim(),
  invoiceMailerFrom: String(process.env.INVOICE_MAILER_FROM || process.env.INVOICE_MAILER_USER || '').trim(),
  invoiceBrandName: String(process.env.INVOICE_BRAND_NAME || 'MatuPay').trim()
}

function buildGatewayConfigFromEnv(source = env) {
  return {
    environment: source.wompiEnv,
    publicKey: source.wompiPublicKey,
    privateKey: source.wompiPrivateKey,
    integritySecret: source.wompiIntegritySecret,
    webhookSecret: source.wompiWebhookSecret,
    prodBaseUrl: source.wompiBaseUrl,
    testBaseUrl: source.wompiTestBaseUrl,
    appId: source.paymentAppId,
    plans: source.paymentPlans,
    defaultRedirectUrl: `${source.frontendAppUrl}/billing/return`
  }
}

module.exports = {
  ...env,
  buildGatewayConfigFromEnv
}
