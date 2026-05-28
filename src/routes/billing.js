const express = require('express')
const logger = require('../lib/logger')
const { REF_SEP } = require('../gateways/wompi/checkout')
const { sendPaymentInvoice } = require('../invoicing/mailer')
const { resolvePaymentApp } = require('../middleware/resolvePaymentApp')
const { getPaymentApp, buildGatewayForApp } = require('../services/paymentApps')
const {
  markPendingPayment,
  activateSubscription,
  markPaymentIssue,
  getSubscriptionStatus
} = require('../services/subscriptions')

const router = express.Router()

router.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next()
  if (req.path === '/webhook/wompi') return next()
  return resolvePaymentApp(req, res, next)
})

function sanitizeUid(uid) {
  return String(uid || '').trim()
}

function appSlug(req) {
  return req.paymentApp.slug
}

function parseAppIdFromReference(reference) {
  const raw = String(reference || '').trim()
  if (!raw) return ''
  if (raw.includes(REF_SEP)) return raw.split(REF_SEP)[0]
  return raw.split('_')[0] || ''
}

async function handleApprovedPayment({ req, uid, transactionId, reference, email, fullName }) {
  const gateway = req.paymentGateway
  const parsed = gateway.parsePaymentReference(reference)
  const plan = parsed ? gateway.getPlan(parsed.planId) : null
  const app = req.paymentApp

  const subscription = await activateSubscription({
    appSlug: app.slug,
    uid,
    transactionId,
    reference,
    planPeriod: plan?.period,
    amountCop: plan?.amountCop,
    gateway
  })

  try {
    await sendPaymentInvoice({
      to: email,
      customerName: fullName,
      planId: subscription.planId,
      amountCop: subscription.amountCop,
      transactionId,
      reference,
      paidAtMs: Date.now(),
      brandName: app.invoiceBrandName
    })
  } catch (err) {
    logger.warn('No se pudo enviar comprobante por correo', { message: err.message, uid })
  }

  return subscription
}

router.get('/plans', (req, res) => {
  const gateway = req.paymentGateway
  return res.json({
    ok: true,
    data: {
      appId: appSlug(req),
      gateway: gateway.name,
      environment: gateway.environment,
      plans: gateway.listPlans()
    }
  })
})

router.post('/checkout-link', async (req, res) => {
  const uid = sanitizeUid(req.body?.uid)
  const email = String(req.body?.email || '').trim()
  const fullName = String(req.body?.fullName || '').trim()
  const phone = String(req.body?.phone || '').trim()
  const redirectUrl = String(req.body?.redirectUrl || '').trim()
  const planId = String(req.body?.planId || req.body?.planCode || '').trim().toLowerCase()

  if (!uid || !email) {
    return res.status(400).json({ ok: false, error: 'uid y email son requeridos' })
  }
  if (!planId) {
    return res.status(400).json({ ok: false, error: 'planId es requerido' })
  }

  try {
    const gateway = req.paymentGateway
    const app = req.paymentApp
    const payload = gateway.createCheckout({
      customerId: uid,
      planId,
      redirectUrl: redirectUrl || `${app.frontendUrl}/billing/return`,
      email,
      fullName,
      phone
    })

    await markPendingPayment({
      appSlug: app.slug,
      uid,
      email,
      fullName,
      reference: payload.reference,
      gateway
    })
    return res.json({ ok: true, data: payload })
  } catch (err) {
    logger.error('Error creando checkout', { message: err.message, appId: appSlug(req) })
    return res.status(500).json({ ok: false, error: err.message || 'No se pudo crear el checkout' })
  }
})

router.post('/confirm-transaction', async (req, res) => {
  const uid = sanitizeUid(req.body?.uid)
  const transactionId = String(req.body?.transactionId || '').trim()
  const email = String(req.body?.email || '').trim()
  const fullName = String(req.body?.fullName || '').trim()
  const environment = String(req.body?.environment || '').trim().toLowerCase()

  if (!uid || !transactionId) {
    return res.status(400).json({ ok: false, error: 'uid y transactionId son requeridos' })
  }

  try {
    const gateway = req.paymentGateway
    const tx = await gateway.fetchTransaction(transactionId, { environment })
    const reference = String(tx?.reference || '')
    const parsed = gateway.parsePaymentReference(reference)

    if (!parsed || parsed.customerId !== uid) {
      return res.status(403).json({ ok: false, error: 'Transacción inválida para este usuario' })
    }

    const status = String(tx?.status || '').toUpperCase()
    if (status === 'APPROVED') {
      const subscription = await handleApprovedPayment({
        req,
        uid,
        transactionId,
        reference,
        email,
        fullName
      })
      return res.json({
        ok: true,
        data: {
          transactionStatus: status,
          subscription
        }
      })
    }

    await markPaymentIssue({ appSlug: appSlug(req), uid, reason: `Estado en pasarela: ${status || 'UNKNOWN'}` })
    return res.json({
      ok: true,
      data: {
        transactionStatus: status || 'UNKNOWN',
        subscription: { status: 'past_due' }
      }
    })
  } catch (err) {
    logger.error('Error confirmando pago', { message: err.message, appId: appSlug(req) })
    return res.status(500).json({ ok: false, error: err.message || 'No se pudo confirmar la transacción' })
  }
})

router.post('/webhook/wompi', async (req, res) => {
  try {
    const payload = req.body || {}
    const event = require('../gateways/wompi/webhooks').extractTransactionFromEvent(payload)
    const reference = String(event?.reference || '')
    const appId = parseAppIdFromReference(reference)

    if (!appId) {
      return res.status(400).json({ ok: false, error: 'Referencia sin appId' })
    }

    const app = await getPaymentApp(appId)
    if (!app) {
      return res.status(404).json({ ok: false, error: `App no registrada: ${appId}` })
    }

    const gateway = buildGatewayForApp(app)
    req.paymentApp = app
    req.paymentGateway = gateway

    if (!gateway.verifyWebhook(payload)) {
      return res.status(401).json({ ok: false, error: 'Webhook inválido' })
    }

    if (!event?.transactionId || !event.reference) {
      return res.status(400).json({ ok: false, error: 'Evento incompleto' })
    }

    const parsed = gateway.parsePaymentReference(event.reference)
    if (!parsed?.customerId) {
      return res.status(400).json({ ok: false, error: 'Referencia no reconocida' })
    }

    if (event.status === 'APPROVED') {
      await handleApprovedPayment({
        req,
        uid: parsed.customerId,
        transactionId: event.transactionId,
        reference: event.reference,
        email: event.customerEmail
      })
    } else {
      await markPaymentIssue({
        appSlug: app.slug,
        uid: parsed.customerId,
        reason: `Estado webhook: ${event.status || 'UNKNOWN'}`
      })
    }

    return res.json({ ok: true })
  } catch (err) {
    logger.error('Error procesando webhook Wompi', { message: err.message })
    return res.status(500).json({ ok: false, error: 'No se pudo procesar webhook' })
  }
})

router.get('/status/:uid', async (req, res) => {
  const uid = sanitizeUid(req.params.uid)
  if (!uid) return res.status(400).json({ ok: false, error: 'uid inválido' })

  try {
    const data = await getSubscriptionStatus(appSlug(req), uid)
    return res.json({ ok: true, data })
  } catch (err) {
    logger.error('Error consultando estado de suscripción', { message: err.message })
    return res.status(500).json({ ok: false, error: err.message || 'No se pudo consultar la suscripción' })
  }
})

module.exports = router
