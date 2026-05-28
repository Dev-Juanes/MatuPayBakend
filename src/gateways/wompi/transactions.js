async function getTransaction({ transactionId, privateKey, baseUrl }) {
  if (!privateKey) throw new Error('Falta privateKey de Wompi')
  const id = String(transactionId || '').trim()
  if (!id) throw new Error('transactionId es requerido')

  const normalizedBase = String(baseUrl || '').trim().replace(/\/+$/, '')
  const res = await fetch(`${normalizedBase}/transactions/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${privateKey}`,
      'Content-Type': 'application/json'
    }
  })

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const reason = payload?.error?.reason || payload?.error?.type || `HTTP ${res.status}`
    throw new Error(`No se pudo consultar la transacción en Wompi: ${reason}`)
  }

  return payload?.data || null
}

module.exports = {
  getTransaction
}
