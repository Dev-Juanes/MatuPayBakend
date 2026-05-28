const { createWompiGateway } = require('./wompi')

function createGateway(name, config) {
  const gatewayName = String(name || '').trim().toLowerCase()
  if (gatewayName === 'wompi') return createWompiGateway(config)
  throw new Error(`Pasarela no soportada: ${name}`)
}

module.exports = {
  createGateway,
  createWompiGateway
}
