const { normalizePeriod } = require('../config/plans')
const { isMatuDbConfigured, getMatuDb } = require('./matudbClient')
const logger = require('../lib/logger')

function addMonthsMs(fromMs, months) {
  const d = new Date(fromMs)
  d.setMonth(d.getMonth() + Math.max(1, Number(months) || 1))
  return d.getTime()
}

function resolvePlanFromReference(reference, gateway) {
  const parsed = gateway.parsePaymentReference(reference)
  if (!parsed) return null
  const plan = gateway.getPlan(parsed.planId)
  if (!plan) return null
  return { ...plan, customerId: parsed.customerId, appId: parsed.appId }
}

async function upsertSubscription(row) {
  const db = getMatuDb()
  const { data: existing, error: readErr } = await db
    .from('payment_subscriptions')
    .select('customer_uid')
    .eq('app_slug', row.app_slug)
    .eq('customer_uid', row.customer_uid)
    .maybeSingle()

  if (readErr) throw new Error(readErr.message || 'No se pudo leer suscripción')

  if (existing) {
    const { error } = await db
      .from('payment_subscriptions')
      .eq('app_slug', row.app_slug)
      .eq('customer_uid', row.customer_uid)
      .update(row)
    if (error) throw new Error(error.message || 'No se pudo actualizar suscripción')
    return
  }

  const { error } = await db.from('payment_subscriptions').insert(row)
  if (error) throw new Error(error.message || 'No se pudo crear suscripción')
}

async function insertPaymentRecord(row) {
  const db = getMatuDb()
  const { error } = await db.from('payment_records').insert(row)
  if (error) throw new Error(error.message || 'No se pudo registrar el pago')
}

async function markPendingPayment({ appSlug, uid, email, fullName, reference, gateway }) {
  if (!isMatuDbConfigured()) {
    logger.warn('MatuDB no configurado: markPendingPayment omitido')
    return
  }
  const now = Date.now()
  const plan = resolvePlanFromReference(reference, gateway)
  const period = normalizePeriod(plan?.period || 'monthly')

  await upsertSubscription({
    app_slug: appSlug,
    customer_uid: uid,
    plan_id: plan?.id || '',
    billing_period: period,
    status: 'pending_payment',
    current_amount_cop: plan?.amountCop || 0,
    last_reference: reference,
    customer_email: String(email || '').trim(),
    customer_name: String(fullName || '').trim(),
    updated_at_ms: now
  })
}

async function activateSubscription({
  appSlug,
  uid,
  transactionId,
  reference,
  planPeriod,
  amountCop,
  gateway
}) {
  if (!isMatuDbConfigured()) {
    throw new Error('MatuDB requerido para activar suscripciones')
  }

  const db = getMatuDb()
  const now = Date.now()
  const plan = resolvePlanFromReference(reference, gateway)
  const period = normalizePeriod(planPeriod || plan?.period || 'monthly')
  const months = plan?.periodMonths || (period === 'annual' ? 12 : 1)

  const { data: existing } = await db
    .from('payment_subscriptions')
    .select('period_end_ms')
    .eq('app_slug', appSlug)
    .eq('customer_uid', uid)
    .maybeSingle()

  const previousEnd = Number(existing?.period_end_ms || 0)
  const periodStart = previousEnd > now ? previousEnd : now
  const periodEnd = addMonthsMs(periodStart, months)
  const paidAmount = Number(amountCop || plan?.amountCop || 0)

  await upsertSubscription({
    app_slug: appSlug,
    customer_uid: uid,
    plan_id: plan?.id || '',
    billing_period: period,
    status: 'active',
    current_amount_cop: paidAmount,
    period_start_ms: periodStart,
    period_end_ms: periodEnd,
    last_reference: reference,
    last_transaction_id: String(transactionId || ''),
    updated_at_ms: now
  })

  await insertPaymentRecord({
    app_slug: appSlug,
    customer_uid: uid,
    transaction_id: String(transactionId || ''),
    reference: String(reference || ''),
    plan_id: plan?.id || '',
    billing_period: period,
    amount_cop: paidAmount,
    status: 'approved',
    wompi_status: 'APPROVED',
    paid_at_ms: now
  })

  return {
    status: 'active',
    periodEndMs: periodEnd,
    planId: plan?.id || '',
    amountCop: paidAmount
  }
}

async function markPaymentIssue({ appSlug, uid, reason }) {
  if (!isMatuDbConfigured()) return
  const now = Date.now()
  await upsertSubscription({
    app_slug: appSlug,
    customer_uid: uid,
    status: 'past_due',
    last_error: String(reason || '').slice(0, 180),
    updated_at_ms: now
  })
}

async function getSubscriptionStatus(appSlug, uid) {
  if (!isMatuDbConfigured()) {
    return {
      appId: appSlug,
      planId: '',
      billingPeriod: 'monthly',
      status: 'inactive',
      periodEndMs: 0,
      currentAmountCop: 0,
      recentPayments: [],
      isActive: false
    }
  }

  const db = getMatuDb()
  const { data: sub, error: subErr } = await db
    .from('payment_subscriptions')
    .select('*')
    .eq('app_slug', appSlug)
    .eq('customer_uid', uid)
    .maybeSingle()

  if (subErr) throw new Error(subErr.message || 'Error leyendo suscripción')

  const subscription = sub || {}
  const status = String(subscription.status || 'inactive')
  const planId = String(subscription.plan_id || '')
  const billingPeriod = normalizePeriod(subscription.billing_period || 'monthly')
  const periodEndMs = Number(subscription.period_end_ms || 0)
  const isActive = status === 'active' && periodEndMs > Date.now()

  const { data: payments, error: payErr } = await db
    .from('payment_records')
    .select('id, transaction_id, billing_period, amount_cop, paid_at_ms, status')
    .eq('app_slug', appSlug)
    .eq('customer_uid', uid)
    .order('paid_at_ms', { ascending: false })
    .limit(20)

  if (payErr) logger.warn('Error leyendo payment_records', { message: payErr.message })

  const recentPayments = (payments || []).map((d) => ({
    id: String(d.id || ''),
    transactionId: String(d.transaction_id || ''),
    billingPeriod: normalizePeriod(d.billing_period || 'monthly'),
    amountCop: Number(d.amount_cop || 0),
    paidAtMs: Number(d.paid_at_ms || 0)
  }))

  return {
    appId: appSlug,
    planId,
    billingPeriod,
    status: isActive ? 'active' : status,
    periodEndMs,
    currentAmountCop: Number(subscription.current_amount_cop || 0),
    recentPayments,
    isActive
  }
}

module.exports = {
  markPendingPayment,
  activateSubscription,
  markPaymentIssue,
  getSubscriptionStatus
}
