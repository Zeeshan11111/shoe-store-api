const express = require('express')
const prisma = require('../lib/prisma.js')
const { requireUser } = require('../lib/session.js')

const router = express.Router()

// GET /api/wishlist — current user's wishlisted product ids
router.get('/', requireUser, async (req, res) => {
  const items = await prisma.wishlistItem.findMany({ where: { userId: req.user.id } })
  res.json({ data: items.map((i) => i.productId), error: null })
})

// POST /api/wishlist — toggle one product, or bulk-merge with { ids: [...] } at login
router.post('/', requireUser, async (req, res) => {
  if (Array.isArray(req.body.ids)) {
    for (const productId of req.body.ids) {
      await prisma.wishlistItem
        .create({ data: { userId: req.user.id, productId } })
        .catch(() => {}) // already there — fine
    }
    const items = await prisma.wishlistItem.findMany({ where: { userId: req.user.id } })
    return res.json({ data: items.map((i) => i.productId), error: null })
  }

  const { productId } = req.body
  const existing = await prisma.wishlistItem.findUnique({
    where: { userId_productId: { userId: req.user.id, productId } },
  })
  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } })
  } else {
    await prisma.wishlistItem.create({ data: { userId: req.user.id, productId } })
  }
  const items = await prisma.wishlistItem.findMany({ where: { userId: req.user.id } })
  res.json({ data: items.map((i) => i.productId), error: null })
})

module.exports = { router }
