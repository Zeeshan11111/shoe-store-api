const express = require('express')
const prisma = require('../lib/prisma.js')
const { requireUser } = require('../lib/session.js')

const router = express.Router()

function serialize(item) {
  return {
    key: item.key,
    id: item.productId,
    name: item.name,
    brand: item.brand,
    price: item.price,
    size: item.size,
    qty: item.qty,
    colorway: JSON.parse(item.colorway),
    colorName: item.colorName,
  }
}

// GET /api/cart — current user's cart
router.get('/', requireUser, async (req, res) => {
  const items = await prisma.cartItem.findMany({ where: { userId: req.user.id } })
  res.json({ data: items.map(serialize), error: null })
})

// POST /api/cart — add/update an item, or bulk-replace with { items: [...] } for login sync
router.post('/', requireUser, async (req, res) => {
  if (Array.isArray(req.body.items)) {
    // One-time merge push from a guest's local cart at login time.
    for (const item of req.body.items) {
      await prisma.cartItem.upsert({
        where: { userId_key: { userId: req.user.id, key: item.key } },
        create: { userId: req.user.id, key: item.key, productId: item.id, name: item.name, brand: item.brand, price: item.price, size: item.size, qty: item.qty, colorway: JSON.stringify(item.colorway), colorName: item.colorName },
        update: { qty: { increment: item.qty } },
      })
    }
    const items = await prisma.cartItem.findMany({ where: { userId: req.user.id } })
    return res.json({ data: items.map(serialize), error: null })
  }

  const item = req.body
  const existing = await prisma.cartItem.findUnique({
    where: { userId_key: { userId: req.user.id, key: item.key } },
  })
  const saved = existing
    ? await prisma.cartItem.update({ where: { id: existing.id }, data: { qty: item.qty } })
    : await prisma.cartItem.create({
        data: {
          userId: req.user.id,
          key: item.key,
          productId: item.id,
          name: item.name,
          brand: item.brand,
          price: item.price,
          size: item.size,
          qty: item.qty,
          colorway: JSON.stringify(item.colorway),
          colorName: item.colorName,
        },
      })
  res.json({ data: serialize(saved), error: null })
})

// DELETE /api/cart/:key
router.delete('/:key', requireUser, async (req, res) => {
  await prisma.cartItem.deleteMany({ where: { userId: req.user.id, key: req.params.key } })
  res.json({ data: true, error: null })
})

// DELETE /api/cart — clear (after checkout)
router.delete('/', requireUser, async (req, res) => {
  await prisma.cartItem.deleteMany({ where: { userId: req.user.id } })
  res.json({ data: true, error: null })
})

module.exports = { router }
