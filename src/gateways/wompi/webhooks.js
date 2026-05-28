const crypto = require('crypto')

function verifyEventChecksum({ payload, webhookSecret }) {
  const secret = String(webhookSecret || '').trim()
  if (!secret) return false

  const signature = payload?.signature
  const properties = Array.isArray(signature?.properties) ? signature.properties : []
  const checksum = String(signature?.checksum || '').trim()
  if (!properties.length || !checksum) return false

  const values = properties.map((key) => {
    const parts = String(key).split('.')
    let current = payload
    for (const part of parts) {
      current = current?.[part]
    }
    return current == null ? '' : String(current)
  })

  const chain = values.join('') + secret
  const expected = crypto.createHash('sha256').update(chain).digest('hex').toUpperCase()
  return expected === checksum.toUpperCase()
}

function extractTransactionFromEvent(payload) {
  const event = String(payload?.event || '').trim()
  const transaction = payload?.data?.transaction || payload?.data || null
  if (!transaction) return null

  return {
    event,
    transactionId: String(transaction.id || ''),
    reference: String(transaction.reference || ''),
    status: String(transaction.status || '').toUpperCase(),
    amountInCents: Number(transaction.amount_in_cents || transaction.amountInCents || 0),
    currency: String(transaction.currency || 'COP').toUpperCase(),
    customerEmail: String(transaction.customer_email || transaction.customerEmail || '')
  }
}

module.exports = {
  verifyEventChecksum,
  extractTransactionFromEvent
}
