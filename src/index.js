const env = require('./config/env')
const { createGateway, createWompiGateway } = require('./gateways')
const { loadPlansFromEnv, buildPlanIndex, normalizePeriod } = require('./config/plans')
const { buildCheckoutUrl, buildReference, parseReference, buildIntegritySignature } = require('./gateways/wompi/checkout')
const { getTransaction } = require('./gateways/wompi/transactions')
const { verifyEventChecksum, extractTransactionFromEvent } = require('./gateways/wompi/webhooks')
const { sendPaymentInvoice, isInvoiceMailerConfigured } = require('./invoicing/mailer')
const createApp = require('./app')

function createGatewayFromEnv(source = env) {
  return createGateway(source.paymentGateway, source.buildGatewayConfigFromEnv())
}

function loadEnvConfig() {
  return {
    ...env,
    gatewayConfig: env.buildGatewayConfigFromEnv()
  }
}

module.exports = {
  createGateway,
  createWompiGateway,
  createGatewayFromEnv,
  loadEnvConfig,
  loadPlansFromEnv,
  buildPlanIndex,
  normalizePeriod,
  buildCheckoutUrl,
  buildReference,
  parseReference,
  buildIntegritySignature,
  getTransaction,
  verifyEventChecksum,
  extractTransactionFromEvent,
  sendPaymentInvoice,
  isInvoiceMailerConfigured,
  createApp
}
