const env = require('../config/env')
const { loadPlansFromEnv } = require('../config/plans')
const { createGateway } = require('../gateways')
const { isMatuDbConfigured, getMatuDb } = require('./matudbClient')
const logger = require('../lib/logger')

const appCache = new Map()
const CACHE_MS = 60_000

function rowToApp(row) {
  const cors = Array.isArray(row.cors_origins)
    ? row.cors_origins
    : String(row.cors_origins || '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)

  return {
    slug: String(row.slug || '').trim().toLowerCase(),
    name: String(row.name || ''),
    active: row.active !== false,
    frontendUrl: String(row.frontend_url || env.frontendAppUrl).replace(/\/+$/, ''),
    corsOrigins: cors,
    apiToken: String(row.api_token || '').trim(),
    gateway: String(row.gateway || 'wompi').trim().toLowerCase(),
    wompiEnv: String(row.wompi_env || 'test').trim().toLowerCase() === 'prod' ? 'prod' : 'test',
    wompiPublicKey: String(row.wompi_public_key || '').trim(),
    wompiPrivateKey: String(row.wompi_private_key || '').trim(),
    wompiIntegritySecret: String(row.wompi_integrity_secret || '').trim(),
    wompiWebhookSecret: String(row.wompi_webhook_secret || '').trim(),
    invoiceBrandName: String(row.invoice_brand_name || row.name || 'MatuPay').trim(),
    plans: []
  }
}

function rowToPlan(row) {
  return {
    id: String(row.plan_id || '').trim().toLowerCase(),
    name: String(row.name || ''),
    description: row.description ? String(row.description) : null,
    amountCop: Number(row.amount_cop || 0),
    period: String(row.period || 'monthly'),
    periodMonths: Number(row.period_months || 1),
    currency: String(row.currency || 'COP').toUpperCase()
  }
}

function legacyAppFromEnv() {
  const slug = env.paymentAppId
  return {
    slug,
    name: slug,
    active: true,
    frontendUrl: env.frontendAppUrl,
    corsOrigins: env.corsOrigins,
    apiToken: '',
    gateway: env.paymentGateway,
    wompiEnv: env.wompiEnv,
    wompiPublicKey: env.wompiPublicKey,
    wompiPrivateKey: env.wompiPrivateKey,
    wompiIntegritySecret: env.wompiIntegritySecret,
    wompiWebhookSecret: env.wompiWebhookSecret,
    invoiceBrandName: env.invoiceBrandName,
    plans: env.paymentPlans,
    legacy: true
  }
}

async function fetchAppFromDb(slug) {
  const db = getMatuDb()
  const { data: appRow, error: appErr } = await db
    .from('payment_apps')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (appErr) throw new Error(appErr.message || 'Error leyendo payment_apps')
  if (!appRow) return null

  const app = rowToApp(appRow)

  const { data: planRows, error: planErr } = await db
    .from('payment_plans')
    .select('*')
    .eq('app_slug', slug)
    .eq('active', true)

  if (planErr) throw new Error(planErr.message || 'Error leyendo payment_plans')
  app.plans = (planRows || []).map(rowToPlan).filter((p) => p.id && p.amountCop > 0)
  return app
}

async function getPaymentApp(slug) {
  const id = String(slug || '').trim().toLowerCase()
  if (!id) return null

  const cached = appCache.get(id)
  if (cached && cached.expiresAt > Date.now()) return cached.app

  let app = null
  if (isMatuDbConfigured()) {
    app = await fetchAppFromDb(id)
  } else if (id === env.paymentAppId) {
    app = legacyAppFromEnv()
  }

  if (app) {
    appCache.set(id, { app, expiresAt: Date.now() + CACHE_MS })
  }
  return app
}

async function listPaymentApps() {
  if (!isMatuDbConfigured()) {
    return [legacyAppFromEnv()]
  }
  const db = getMatuDb()
  const { data, error } = await db.from('payment_apps').select('slug, cors_origins, active').eq('active', true)
  if (error) {
    logger.warn('No se pudo listar payment_apps', { message: error.message })
    return []
  }
  return (data || []).map(rowToApp)
}

function buildGatewayForApp(app) {
  const wompiEnv = app.wompiEnv || 'test'
  const prodBaseUrl = env.wompiBaseUrl
  const testBaseUrl = env.wompiTestBaseUrl

  return createGateway(app.gateway, {
    environment: wompiEnv,
    publicKey: app.wompiPublicKey,
    privateKey: app.wompiPrivateKey,
    integritySecret: app.wompiIntegritySecret,
    webhookSecret: app.wompiWebhookSecret,
    prodBaseUrl,
    testBaseUrl,
    appId: app.slug,
    plans: app.plans?.length ? app.plans : loadPlansFromEnv(env),
    defaultRedirectUrl: `${app.frontendUrl}/billing/return`
  })
}

function clearAppCache(slug) {
  if (slug) appCache.delete(String(slug).trim().toLowerCase())
  else appCache.clear()
}

module.exports = {
  getPaymentApp,
  listPaymentApps,
  buildGatewayForApp,
  clearAppCache,
  legacyAppFromEnv
}
