const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
const ALLOWED_HEADERS = 'Content-Type, Authorization, Accept, X-Payment-App, x-payment-app'
const MAX_AGE = '86400'

function applyCorsHeaders(res, origin) {
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS)
  res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS)
  res.setHeader('Access-Control-Max-Age', MAX_AGE)
}

module.exports = { applyCorsHeaders }
