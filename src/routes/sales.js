const express = require('express')
const prisma = require('../lib/prisma.js')
const { requireAdmin } = require('../lib/session.js')
const { requirePermission } = require('../lib/permissions.js')

const router = express.Router()
const gate = [requireAdmin, requirePermission('sales')]

function serialize(s) {
  return {
    id: s.id,
    name: s.name,
    percentage: s.percentage,
    enabled: s.enabled,
    startDate: s.startDate ? s.startDate.toISOString() : null,
    endDate: s.endDate ? s.endDate.toISOString() : null,
  }
}

function toDate(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

// GET /api/sales?active=true
router.get('/', async (req, res) => {
  const where = req.query.active === 'true' ? { enabled: true } : {}
  const rows = await prisma.sale.findMany({ where, orderBy: { createdAt: 'asc' } })
  res.json({ data: rows.map(serialize), error: null })
})

// POST /api/sales — create a campaign
router.post('/', gate, async (req, res) => {
  const { name, percentage, enabled = true, startDate, endDate } = req.body
  const row = await prisma.sale.create({
    data: {
      name,
      percentage: Number(percentage) || 0,
      enabled: !!enabled,
      startDate: toDate(startDate) ?? null,
      endDate: toDate(endDate) ?? null,
    },
  })
  res.json({ data: serialize(row), error: null })
})

// PATCH /api/sales/:id — update name/percentage/enabled/dates
router.patch('/:id', gate, async (req, res) => {
  const { name, percentage, enabled, startDate, endDate } = req.body
  const data = {}
  if (name !== undefined) data.name = name
  if (percentage !== undefined) data.percentage = Number(percentage) || 0
  if (enabled !== undefined) data.enabled = !!enabled
  if (startDate !== undefined) data.startDate = toDate(startDate)
  if (endDate !== undefined) data.endDate = toDate(endDate)

  const row = await prisma.sale.update({ where: { id: req.params.id }, data }).catch(() => null)
  if (!row) return res.json({ data: null, error: 'Sale not found.' })
  res.json({ data: serialize(row), error: null })
})

// DELETE /api/sales/:id
router.delete('/:id', gate, async (req, res) => {
  await prisma.sale.delete({ where: { id: req.params.id } }).catch(() => {})
  res.json({ data: true, error: null })
})

module.exports = { router }
