const { buildCheckoutUrl, buildReference, parseReference } = require('./checkout')
const { getTransaction } = require('./transactions')
const { verifyEventChecksum, extractTransactionFromEvent } = require('./webhooks')
const { buildPlanIndex, normalizePeriod } = require('../../config/plans')

const DEFAULT_CHECKOUT_URL = 'https://checkout.wompi.co/p/'

function resolveBaseUrl(environment, config) {
  const mode = String(environment || config.environment || 'prod').trim().toLowerCase()
  if (mode === 'test' || mode === 'sandbox') return config.testBaseUrl
  return config.prodBaseUrl
}

function createWompiGateway(config = {}) {
  const {
    environment = 'prod',
    publicKey,
    privateKey,
    integritySecret,
    webhookSecret,
    prodBaseUrl = 'https://production.wompi.co/v1',
    testBaseUrl = 'https://sandbox.wompi.co/v1',
    checkoutBaseUrl = DEFAULT_CHECKOUT_URL,
    appId = 'app',
    plans = [],
    defaultRedirectUrl = ''
  } = config

  const planIndex = buildPlanIndex(plans)

  function getPlan(planId) {
    const id = String(planId || '').trim().toLowerCase()
    return planIndex.get(id) || null
  }

  function listPlans() {
    return [...planIndex.values()]
  }

  function createCheckout({
    customerId,
    planId,
    redirectUrl,
    email,
    fullName,
    phone
  }) {
    const plan = getPlan(planId)
    if (!plan) throw new Error(`Plan no soportado: ${planId}`)

    const reference = buildReference({
      appId,
      planId: plan.id,
      customerId
    })

    const payload = buildCheckoutUrl({
      publicKey,
      integritySecret,
      currency: plan.currency || 'COP',
      amountInCents: plan.amountCop * 100,
      reference,
      redirectUrl: redirectUrl || defaultRedirectUrl,
      checkoutBaseUrl
    })

    void email
    void fullName
    void phone

    return {
      ...payload,
      planId: plan.id,
      period: normalizePeriod(plan.period),
      amountCop: plan.amountCop
    }
  }

  async function fetchTransaction(transactionId, options = {}) {
    const baseUrl = resolveBaseUrl(options.environment || environment, {
      environment,
      prodBaseUrl,
      testBaseUrl
    })
    return getTransaction({
      transactionId,
      privateKey,
      baseUrl
    })
  }

  function verifyWebhook(payload) {
    return verifyEventChecksum({ payload, webhookSecret })
  }

  function parseWebhookEvent(payload) {
    return extractTransactionFromEvent(payload)
  }

  function parsePaymentReference(reference) {
    return parseReference(reference, appId)
  }

  return {
    name: 'wompi',
    environment,
    appId,
    listPlans,
    getPlan,
    createCheckout,
    fetchTransaction,
    verifyWebhook,
    parseWebhookEvent,
    parsePaymentReference
  }
}

module.exports = {
  createWompiGateway,
  DEFAULT_CHECKOUT_URL
}
