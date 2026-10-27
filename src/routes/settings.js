const express = require('express')
const prisma = require('../lib/prisma.js')

const router = express.Router()

function serialize(s) {
  return {
    paymentMethods: {
      jazzcash: { enabled: s.jazzcashEnabled, label: s.jazzcashLabel },
      easypaisa: { enabled: s.easypaisaEnabled, label: s.easypaisaLabel },
      card: { enabled: s.cardEnabled, label: s.cardLabel },
    },
    whatsapp: { enabled: s.whatsappEnabled, number: s.whatsappNumber },
  }
}

function toRow(settings) {
  return {
    jazzcashEnabled: !!settings.paymentMethods.jazzcash.enabled,
    jazzcashLabel: settings.paymentMethods.jazzcash.label,
    easypaisaEnabled: !!settings.paymentMethods.easypaisa.enabled,
    easypaisaLabel: settings.paymentMethods.easypaisa.label,
    cardEnabled: !!settings.paymentMethods.card.enabled,
    cardLabel: settings.paymentMethods.card.label,
    whatsappEnabled: !!settings.whatsapp.enabled,
    whatsappNumber: settings.whatsapp.number,
  }
}

// GET /api/settings
router.get('/', async (req, res) => {
  const row = await prisma.settings.findUnique({ where: { id: 1 } })
  res.json({ data: serialize(row), error: null })
})

// PUT /api/settings
router.put('/', async (req, res) => {
  const row = await prisma.settings.update({ where: { id: 1 }, data: toRow(req.body) })
  res.json({ data: serialize(row), error: null })
})

module.exports = { router }
