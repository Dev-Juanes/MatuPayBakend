const env = require('../config/env')
const { getPaymentApp, buildGatewayForApp } = require('../services/paymentApps')

function readAppId(req) {
  return String(
    req.headers['x-payment-app'] ||
      req.body?.appId ||
      req.body?.appSlug ||
      req.query?.appId ||
      ''
  )
    .trim()
    .toLowerCase()
}

async function resolvePaymentApp(req, res, next) {
  if (req.method === 'OPTIONS') return next()

  const appId = readAppId(req) || env.paymentAppId
  if (!appId) {
    return res.status(400).json({
      ok: false,
      error: 'appId requerido (header X-Payment-App, body.appId o PAYMENT_APP_ID en servidor)'
    })
  }

  try {
    const app = await getPaymentApp(appId)
    if (!app) {
      return res.status(404).json({ ok: false, error: `Aplicación no registrada: ${appId}` })
    }
    if (!app.active) {
      return res.status(403).json({ ok: false, error: `Aplicación desactivada: ${appId}` })
    }

    if (app.apiToken) {
      const bearer = req.headers.authorization || ''
      const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : ''
      if (token !== app.apiToken) {
        return res.status(401).json({ ok: false, error: 'Token inválido para esta aplicación' })
      }
    }

    req.paymentApp = app
    req.paymentGateway = buildGatewayForApp(app)
    return next()
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'No se pudo resolver la aplicación' })
  }
}

module.exports = { resolvePaymentApp, readAppId }
