const app = require('./app')
const env = require('./config/env')
const logger = require('./lib/logger')

app.listen(env.port, () => {
  logger.info(`MatuPay API listening on :${env.port}`, {
    appId: env.paymentAppId,
    gateway: env.paymentGateway,
    wompiEnv: env.wompiEnv
  })
})
