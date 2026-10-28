const express = require('express')
const prisma = require('../lib/prisma.js')

const router = express.Router()

// GET /api/dashboard — admin stat cards + sales chart data
router.get('/', async (req, res) => {
  const orders = await prisma.order.findMany()

  const totalOrders = orders.length
  const pending = orders.filter((o) => o.status === 'Pending').length
  const confirmed = orders.filter((o) => o.status === 'Confirmed').length
  const delivered = orders.filter((o) => o.status === 'Delivered').length
  const cancelled = orders.filter((o) => o.status === 'Cancelled').length
  const totalRevenue = orders.filter((o) => o.status !== 'Cancelled').reduce((sum, o) => sum + o.total, 0)
  const totalUsers = await prisma.user.count()

  const days = []
  for (let i = 13; i >= 0; i--) {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - i)
    days.push(date)
  }
  const salesByDay = days.map((date) => {
    const dayTotal = orders
      .filter((o) => {
        if (o.status === 'Cancelled') return false
        const created = new Date(o.createdAt)
        return (
          created.getFullYear() === date.getFullYear() &&
          created.getMonth() === date.getMonth() &&
          created.getDate() === date.getDate()
        )
      })
      .reduce((sum, o) => sum + o.total, 0)
    return { label: date.toLocaleDateString(undefined, { weekday: 'short' }), total: dayTotal }
  })

  res.json({
    data: { totalOrders, pending, confirmed, delivered, cancelled, totalRevenue, totalUsers, salesByDay },
    error: null,
  })
})

module.exports = { router }
