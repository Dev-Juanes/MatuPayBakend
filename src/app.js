const express = require('express')
const cors = require('cors')
const env = require('./config/env')
const logger = require('./lib/logger')
const { applyCorsHeaders } = require('./lib/corsHeaders')
const { authMiddleware } = require('./middleware/auth')
const billingRoutes = require('./routes/billing')
const { isMatuDbConfigured } = require('./services/matudbClient')
const { isOriginAllowed, startCorsRefresh } = require('./services/corsRegistry')

const app = express()

if (env.trustProxy) {
  app.set('trust proxy', 1)
}

if (isMatuDbConfigured()) {
  startCorsRefresh()
}

/** Preflight — respuesta 204 antes de auth / billing */
app.use((req, res, next) => {
  if (req.method !== 'OPTIONS' || !req.path.startsWith('/api')) return next()

  const origin = req.headers.origin
  if (origin && !isOriginAllowed(origin)) {
    return res.status(403).json({ ok: false, error: `CORS bloqueado para origin: ${origin}` })
  }

  applyCorsHeaders(res, origin)
  return res.status(204).end()
})

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true)
      if (isOriginAllowed(origin)) return callback(null, true)
      logger.warn('CORS origin no listado', { origin })
      return callback(null, false)
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Payment-App', 'x-payment-app'],
    credentials: false,
    maxAge: 86400
  })
)
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'matupay-api',
    multiTenant: isMatuDbConfigured(),
    legacyAppId: env.paymentAppId,
    env: env.nodeEnv,
    timestamp: Date.now(),
    uptimeSec: Math.round(process.uptime()),
    matudbConfigured: isMatuDbConfigured(),
    invoiceMailerEnabled: env.invoiceMailerEnabled
  })
})

app.use('/api', authMiddleware)
app.use('/api/billing', billingRoutes)

app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', { message: err.message, stack: err.stack })
  res.status(500).json({ ok: false, error: 'Internal server error' })
})

module.exports = app
