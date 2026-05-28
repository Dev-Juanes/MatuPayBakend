const env = require('../config/env')
const { createGateway } = require('../gateways')

let cachedGateway = null

function getPaymentGateway() {
  if (cachedGateway) return cachedGateway
  cachedGateway = createGateway(env.paymentGateway, env.buildGatewayConfigFromEnv())
  return cachedGateway
}

function resetPaymentGateway() {
  cachedGateway = null
}

module.exports = {
  getPaymentGateway,
  resetPaymentGateway
}
