const express = require('express')
const logger = require('../lib/logger')
const { buildCheckoutUrl, getTransaction, PLAN_CODE, normalizePeriod, normalizePlanCode, SUPPORTED_PLAN_CODES } = require('../services/wompi')
const {
  markPendingPayment,
  activateSubscription,
  markPaymentIssue,
  getSubscriptionStatus
} = require('../services/subscriptions')

const router = express.Router()

function sanitizeUid(uid) {
  return String(uid || '').trim()
}

function referenceToUid(reference) {
  const raw = String(reference || '').trim()
  if (!raw.startsWith(`${PLAN_CODE}_`)) return ''
  const parts = raw.split('_')
  // Compatibilidad con referencias antiguas: cashpro_<uid>_<timestamp>
  if (parts.length === 3) return parts.slice(1, -1).join('_')
  if (parts.length < 5) return ''
  return parts.slice(3, -1).join('_')
}

function referenceToPeriod(reference) {
  const raw = String(reference || '').trim()
  if (!raw.startsWith(`${PLAN_CODE}_`)) return 'monthly'
  const parts = raw.split('_')
  if (parts.length < 5) return 'monthly'
  return normalizePeriod(parts[1])
}

router.post('/checkout-link', async (req, res) => {
  const uid = sanitizeUid(req.body?.uid)
  const email = String(req.body?.email || '').trim()
  const fullName = String(req.body?.fullName || '').trim()
  const phone = String(req.body?.phone || '').trim()
  const redirectUrl = String(req.body?.redirectUrl || '').trim()
  const planPeriod = normalizePeriod(req.body?.planPeriod)
  const planCode = String(req.body?.planCode || '').trim().toLowerCase()

  if (!uid || !email) {
    return res.status(400).json({ ok: false, error: 'uid y email son requeridos' })
  }
  if (planCode === 'enterprise_contact') {
    return res.status(422).json({
      ok: false,
      error: 'El plan enterprise se gestiona por contacto comercial.',
      data: { contactUrl: 'mailto:sales@matuai.com?subject=Plan%20Enterprise%20MatuAI' }
    })
  }
  const normalizedPlanCode = normalizePlanCode(planCode)
  if (!SUPPORTED_PLAN_CODES.includes(normalizedPlanCode)) {
    return res.status(400).json({ ok: false, error: 'Plan no soportado para checkout' })
  }

  try {
    const payload = buildCheckoutUrl({ uid, email, fullName, phone, redirectUrl, planPeriod, planCode: normalizedPlanCode })
    await markPendingPayment({ uid, email, fullName, reference: payload.reference })
    return res.json({ ok: true, data: payload })
  } catch (err) {
    logger.error('Error creando checkout Wompi', { message: err.message })
    return res.status(500).json({ ok: false, error: err.message || 'No se pudo crear el checkout' })
  }
})

router.post('/confirm-transaction', async (req, res) => {
  const uid = sanitizeUid(req.body?.uid)
  const transactionId = String(req.body?.transactionId || '').trim()
  const environment = String(req.body?.environment || '').trim().toLowerCase()
  if (!uid || !transactionId) {
    return res.status(400).json({ ok: false, error: 'uid y transactionId son requeridos' })
  }

  try {
    const tx = await getTransaction(transactionId, { environment })
    const reference = String(tx?.reference || '')
    const ownerUid = referenceToUid(reference)
    if (!ownerUid || ownerUid !== uid) {
      return res.status(403).json({ ok: false, error: 'Transacción inválida para este usuario' })
    }

    const status = String(tx?.status || '').toUpperCase()
    if (status === 'APPROVED') {
      const period = referenceToPeriod(reference)
      const subscription = await activateSubscription({ uid, transactionId, reference, planPeriod: period })
      return res.json({
        ok: true,
        data: {
          transactionStatus: status,
          subscription
        }
      })
    }

    await markPaymentIssue({ uid, reason: `Estado en Wompi: ${status || 'UNKNOWN'}` })
    return res.json({
      ok: true,
      data: {
        transactionStatus: status || 'UNKNOWN',
        subscription: { status: 'past_due' }
      }
    })
  } catch (err) {
    logger.error('Error confirmando pago Wompi', { message: err.message })
    return res.status(500).json({ ok: false, error: err.message || 'No se pudo confirmar la transacción' })
  }
})

router.get('/status/:uid', async (req, res) => {
  const uid = sanitizeUid(req.params.uid)
  if (!uid) return res.status(400).json({ ok: false, error: 'uid inválido' })

  try {
    const data = await getSubscriptionStatus(uid)
    return res.json({ ok: true, data })
  } catch (err) {
    logger.error('Error consultando estado de suscripción', { message: err.message })
    return res.status(500).json({ ok: false, error: err.message || 'No se pudo consultar la suscripción' })
  }
})

module.exports = router
