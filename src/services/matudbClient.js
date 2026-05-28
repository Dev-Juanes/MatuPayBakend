const { createClient } = require('@devjuanes/matuclient')
const env = require('../config/env')
const logger = require('../lib/logger')

let client = null

function isMatuDbConfigured() {
  return Boolean(env.matudbUrl && env.matudbProjectId && env.matudbApiKey)
}

function getMatuDb() {
  if (!isMatuDbConfigured()) {
    throw new Error('MatuDB no configurado (MATUDB_URL, MATUDB_PROJECT_ID, MATUDB_API_KEY)')
  }
  if (!client) {
    client = createClient({
      url: env.matudbUrl,
      projectId: env.matudbProjectId,
      apiKey: env.matudbApiKey,
      useSupabase: env.matudbUseSupabase
    })
    logger.info('Cliente MatuDB inicializado para MatuPay')
  }
  return client
}

module.exports = {
  isMatuDbConfigured,
  getMatuDb
}
