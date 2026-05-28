function toInt(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizePeriod(input) {
  const period = String(input || '').trim().toLowerCase()
  if (period === 'annual' || period === 'yearly') return 'annual'
  return 'monthly'
}

const DEFAULT_PLANS = [
  { id: 'pro_monthly_usd_20', amountCop: 15000, period: 'monthly', periodMonths: 1, currency: 'COP' },
  { id: 'pro_annual_usd_200', amountCop: 144000, period: 'annual', periodMonths: 12, currency: 'COP' }
]

function parsePlansFromJson(raw) {
  const value = String(raw || '').trim()
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed) || !parsed.length) return null
    return parsed.map((plan) => ({
      id: String(plan.id || plan.code || '').trim().toLowerCase(),
      amountCop: toInt(plan.amountCop ?? plan.amount ?? plan.amountInCents / 100, 0),
      period: normalizePeriod(plan.period),
      periodMonths: toInt(plan.periodMonths, normalizePeriod(plan.period) === 'annual' ? 12 : 1),
      currency: String(plan.currency || 'COP').trim().toUpperCase()
    })).filter((plan) => plan.id && plan.amountCop > 0)
  } catch (_err) {
    return null
  }
}

function loadPlansFromEnv(env = {}) {
  const fromJson = parsePlansFromJson(env.paymentPlansJson)
  if (fromJson?.length) return fromJson

  const monthlyCop = toInt(env.cashProMonthlyCop, 15000)
  const annualCop = toInt(env.cashProAnnualCop, monthlyCop * 12)
  return [
    { id: 'pro_monthly_usd_20', amountCop: monthlyCop, period: 'monthly', periodMonths: 1, currency: 'COP' },
    { id: 'pro_annual_usd_200', amountCop: annualCop, period: 'annual', periodMonths: 12, currency: 'COP' }
  ]
}

function buildPlanIndex(plans) {
  const byId = new Map()
  for (const plan of plans) {
    byId.set(plan.id, plan)
  }
  return byId
}

module.exports = {
  DEFAULT_PLANS,
  normalizePeriod,
  loadPlansFromEnv,
  buildPlanIndex
}
