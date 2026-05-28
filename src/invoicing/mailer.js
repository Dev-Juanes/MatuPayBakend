const nodemailer = require('nodemailer')
const env = require('../config/env')
const logger = require('../lib/logger')

let transporter = null

function isInvoiceMailerConfigured() {
  return Boolean(
    env.invoiceMailerEnabled &&
    env.invoiceMailerHost &&
    env.invoiceMailerUser &&
    env.invoiceMailerPass &&
    env.invoiceMailerFrom
  )
}

function getTransporter() {
  if (!isInvoiceMailerConfigured()) {
    throw new Error('Correo de facturación no configurado')
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.invoiceMailerHost,
      port: env.invoiceMailerPort,
      secure: env.invoiceMailerSecure,
      auth: {
        user: env.invoiceMailerUser,
        pass: env.invoiceMailerPass
      }
    })
  }
  return transporter
}

function formatCop(amountCop) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(Number(amountCop || 0))
}

function buildInvoiceHtml({ customerName, planId, amountCop, transactionId, reference, paidAt, brandName }) {
  const brand = brandName || env.invoiceBrandName
  const paidLabel = paidAt ? new Date(paidAt).toLocaleString('es-CO') : new Date().toLocaleString('es-CO')

  return `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
      <h2>${brand} — Comprobante de pago</h2>
      <p>Hola ${customerName || 'cliente'},</p>
      <p>Tu pago fue procesado correctamente.</p>
      <ul>
        <li><strong>Plan:</strong> ${planId}</li>
        <li><strong>Monto:</strong> ${formatCop(amountCop)}</li>
        <li><strong>Transacción:</strong> ${transactionId}</li>
        <li><strong>Referencia:</strong> ${reference}</li>
        <li><strong>Fecha:</strong> ${paidLabel}</li>
      </ul>
      <p>Gracias por tu compra.</p>
    </div>
  `.trim()
}

async function sendPaymentInvoice({
  to,
  customerName,
  planId,
  amountCop,
  transactionId,
  reference,
  paidAtMs,
  brandName
}) {
  if (!isInvoiceMailerConfigured()) {
    logger.warn('Correo de facturación omitido: INVOICE_MAILER_ENABLED=false o faltan credenciales')
    return { sent: false, reason: 'mailer_not_configured' }
  }

  const recipient = String(to || '').trim()
  if (!recipient) throw new Error('Email del destinatario es requerido')

  const brand = brandName || env.invoiceBrandName
  const html = buildInvoiceHtml({
    customerName,
    planId,
    amountCop,
    transactionId,
    reference,
    paidAt: paidAtMs,
    brandName: brand
  })

  const info = await getTransporter().sendMail({
    from: env.invoiceMailerFrom,
    to: recipient,
    subject: `${brand} — Comprobante de pago`,
    html
  })

  return { sent: true, messageId: info.messageId }
}

module.exports = {
  isInvoiceMailerConfigured,
  sendPaymentInvoice
}
