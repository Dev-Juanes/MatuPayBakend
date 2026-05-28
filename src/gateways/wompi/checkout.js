const crypto = require('crypto')

function buildIntegritySignature({ reference, amountInCents, currency, integritySecret }) {
  return crypto
    .createHash('sha256')
    .update(`${reference}${amountInCents}${currency}${integritySecret}`)
    .digest('hex')
}

/** Separador v2: soporta planId con guiones bajos (ej. winquina_pro_monthly) */
const REF_SEP = '~'

function buildReference({ appId, planId, customerId, timestamp = Date.now() }) {
  return [appId, planId, customerId, String(timestamp)].join(REF_SEP)
}

function buildCheckoutUrl({
  publicKey,
  integritySecret,
  currency = 'COP',
  amountInCents,
  reference,
  redirectUrl,
  checkoutBaseUrl = 'https://checkout.wompi.co/p/'
}) {
  if (!publicKey) throw new Error('Falta publicKey de Wompi')
  if (!integritySecret) throw new Error('Falta integritySecret de Wompi')
  if (!reference) throw new Error('reference es requerido')
  if (!Number.isFinite(amountInCents) || amountInCents <= 0) {
    throw new Error('amountInCents debe ser un entero positivo')
  }

  const signature = buildIntegritySignature({
    reference,
    amountInCents,
    currency,
    integritySecret
  })

  const params = new URLSearchParams({
    'public-key': publicKey,
    currency,
    'amount-in-cents': String(amountInCents),
    reference,
    'signature:integrity': signature,
    'redirect-url': redirectUrl
  })

  const base = String(checkoutBaseUrl || 'https://checkout.wompi.co/p/').trim()
  const normalizedBase = base.endsWith('/') ? base : `${base}/`

  return {
    reference,
    amountInCents,
    currency,
    checkoutUrl: `${normalizedBase}?${params.toString()}`
  }
}

function parseReference(reference, appId) {
  const raw = String(reference || '').trim()
  const expectedApp = String(appId || '').trim()

  if (raw.includes(REF_SEP)) {
    const parts = raw.split(REF_SEP)
    if (parts.length < 4) return null
    const parsedAppId = parts[0]
    if (expectedApp && parsedAppId !== expectedApp) return null
    const timestamp = Number(parts[parts.length - 1])
    const customerId = parts.slice(2, -1).join(REF_SEP)
    return {
      appId: parsedAppId,
      planId: parts[1],
      customerId,
      timestamp: Number.isFinite(timestamp) ? timestamp : 0
    }
  }

  const prefix = `${expectedApp}_`
  if (!expectedApp || !raw.startsWith(prefix)) return null

  const parts = raw.split('_')
  if (parts.length < 4) return null

  const timestamp = Number(parts[parts.length - 1])
  const customerId = parts.slice(2, -1).join('_')
  const planId = parts[1]

  return {
    appId: parts[0],
    planId,
    customerId,
    timestamp: Number.isFinite(timestamp) ? timestamp : 0
  }
}

module.exports = {
  REF_SEP,
  buildIntegritySignature,
  buildReference,
  buildCheckoutUrl,
  parseReference
}
