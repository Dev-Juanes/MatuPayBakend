const crypto = require('crypto')
const env = require('../config/env')

const PLAN_CODE = 'matuai_pro'
const PLAN_CURRENCY = 'COP'
const PERIOD_MONTHS = {
  monthly: 1,
  annual: 12
}
const SUPPORTED_PLAN_CODES = ['pro_monthly_usd_20', 'pro_annual_usd_200']

function normalizePeriod(input) {
  const period = String(input || '').trim().toLowerCase()
  if (period === 'annual') return 'annual'
  return 'monthly'
}

function normalizePlanCode(input) {
  const code = String(input || '').trim().toLowerCase()
  if (code === 'pro_annual_usd_200') return 'pro_annual_usd_200'
  return 'pro_monthly_usd_20'
}

function periodFromPlanCode(planCode) {
  return normalizePlanCode(planCode) === 'pro_annual_usd_200' ? 'annual' : 'monthly'
}

function amountForPeriod(period) {
  if (period === 'annual') return env.cashProAnnualCop
  return env.cashProMonthlyCop
}

function buildReference(uid, period, planCode) {
  return `${PLAN_CODE}_${period}_${normalizePlanCode(planCode)}_${uid}_${Date.now()}`
}

function resolveWompiBaseUrl(environment) {
  const mode = String(environment || '').trim().toLowerCase()
  if (mode === 'test') return env.wompiTestBaseUrl
  if (mode === 'prod' || mode === 'production') return env.wompiBaseUrl
  return env.wompiEnv === 'test' ? env.wompiTestBaseUrl : env.wompiBaseUrl
}

function buildCheckoutUrl({ uid, email, fullName, phone, redirectUrl, planPeriod, planCode }) {
  if (!env.wompiPublicKey) throw new Error('Falta WOMPI_PUBLIC_KEY')
  if (!env.wompiIntegritySecret) throw new Error('Falta WOMPI_INTEGRITY_SECRET')

  const normalizedPlanCode = normalizePlanCode(planCode)
  const period = normalizePeriod(planPeriod || periodFromPlanCode(normalizedPlanCode))
  const reference = buildReference(uid, period, normalizedPlanCode)
  const amountInCents = amountForPeriod(period) * 100
  const signature = crypto
    .createHash('sha256')
    .update(`${reference}${amountInCents}${PLAN_CURRENCY}${env.wompiIntegritySecret}`)
    .digest('hex')

  const params = new URLSearchParams({
    'public-key': env.wompiPublicKey,
    currency: PLAN_CURRENCY,
    'amount-in-cents': String(amountInCents),
    reference,
    'signature:integrity': signature,
    'redirect-url': redirectUrl || `${env.frontendAppUrl}/billing/return`
  })

  // customer-data:* es opcional. Lo omitimos para evitar que librerías de terceros
  // intenten sanitizar query params con PII y rompan el parsing del checkout.
  void email
  void fullName
  void phone

  return {
    reference,
    planCode: normalizedPlanCode,
    period,
    amountInCents,
    currency: PLAN_CURRENCY,
    checkoutUrl: `https://checkout.wompi.co/p/?${params.toString()}`
  }
}

async function getTransaction(transactionId, options = {}) {
  if (!env.wompiPrivateKey) throw new Error('Falta WOMPI_PRIVATE_KEY')
  const id = String(transactionId || '').trim()
  if (!id) throw new Error('transactionId es requerido')
  const baseUrl = resolveWompiBaseUrl(options.environment)
  const res = await fetch(`${baseUrl}/transactions/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${env.wompiPrivateKey}`,
      'Content-Type': 'application/json'
    }
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const reason = payload?.error?.reason || payload?.error?.type || `HTTP ${res.status}`
    throw new Error(`No se pudo consultar la transacción en Wompi: ${reason}`)
  }
  return payload?.data || null
}

module.exports = {
  PLAN_CODE,
  PLAN_CURRENCY,
  PERIOD_MONTHS,
  SUPPORTED_PLAN_CODES,
  normalizePeriod,
  normalizePlanCode,
  periodFromPlanCode,
  amountForPeriod,
  buildCheckoutUrl,
  getTransaction
}
