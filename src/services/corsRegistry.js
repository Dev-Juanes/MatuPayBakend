const env = require('../config/env')
const { listPaymentApps } = require('./paymentApps')
const logger = require('../lib/logger')

const normalizeOrigin = (origin) => String(origin || '').trim().replace(/\/+$/, '')

const defaultOrigins = [
  'http://localhost:5173',
  'https://winquina.com',
  'https://www.winquina.com'
]

let allowedOrigins = new Set([
  ...defaultOrigins.map(normalizeOrigin),
  ...env.corsOrigins.map(normalizeOrigin)
])

async function refreshAllowedOrigins() {
  try {
    const apps = await listPaymentApps()
    for (const app of apps) {
      for (const origin of app.corsOrigins || []) {
        allowedOrigins.add(normalizeOrigin(origin))
      }
    }
  } catch (err) {
    logger.warn('No se pudieron refrescar orígenes CORS', { message: err.message })
  }
}

function isOriginAllowed(origin) {
  if (!origin) return true
  return allowedOrigins.has(normalizeOrigin(origin))
}

function startCorsRefresh(intervalMs = 60_000) {
  refreshAllowedOrigins()
  return setInterval(refreshAllowedOrigins, intervalMs)
}

module.exports = {
  refreshAllowedOrigins,
  isOriginAllowed,
  startCorsRefresh
}
