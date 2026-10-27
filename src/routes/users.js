const express = require('express')
const prisma = require('../lib/prisma.js')

const router = express.Router()

// GET /api/users — admin view of registered customers
router.get('/', async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } })
  const data = await Promise.all(
    users.map(async (u) => {
      const orderCount = await prisma.order.count({ where: { customerEmail: u.email } })
      return { name: u.name, email: u.email, phone: u.phone || '', orderCount }
    })
  )
  res.json({ data, error: null })
})

module.exports = { router }
