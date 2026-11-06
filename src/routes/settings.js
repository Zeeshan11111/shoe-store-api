const express = require('express')
const prisma = require('../lib/prisma.js')
const { serialize, toRow } = require('../lib/storeSettings.js')

const router = express.Router()

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
