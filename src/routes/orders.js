const express = require('express')
const prisma = require('../lib/prisma.js')
const { getUserFromRequest, requireUser } = require('../lib/session.js')
const { parseVariants, totalStock, findVariantIndex } = require('../lib/variants.js')
const { serialize: serializeSettings, deliveryFor } = require('../lib/storeSettings.js')
const { storefrontPrice } = require('./products.js')

// Sizes are stored as EU numbers; shoppers read them as "EU / UK".
function sizeLabel(eu) {
  return eu >= 35 ? `${eu} / ${eu - 34}` : `${eu}`
}

// Applies `sign * qty` for each order item to its colour + size stock
// (sign -1 when an order is placed, +1 when it's cancelled) and keeps the
// flat `stock` column in step. Returns an error message instead of writing
// anything if any item would go below zero.
async function adjustStock(tx, items, sign) {
  const ids = [...new Set(items.map((i) => i.productId ?? i.id))]
  const rows = await tx.product.findMany({ where: { id: { in: ids } } })
  const byId = Object.fromEntries(rows.map((r) => [r.id, { row: r, variants: parseVariants(r) }]))

  for (const item of items) {
    const entry = byId[item.productId ?? item.id]
    if (!entry) continue
    const v = entry.variants[findVariantIndex(entry.variants, item.colorName)]
    const key = String(item.size)
    const next = (v.stock[key] ?? 0) + sign * item.qty
    if (next < 0) {
      const left = v.stock[key] ?? 0
      const size = sizeLabel(item.size)
      return left === 0
        ? `${item.name} in ${v.color}, size ${size} just sold out. Remove it to continue.`
        : `Only ${left} left of ${item.name} in ${v.color}, size ${size}. Lower the quantity to continue.`
    }
    v.stock[key] = next
  }

  for (const { row, variants } of Object.values(byId)) {
    await tx.product.update({
      where: { id: row.id },
      data: { variants: JSON.stringify(variants), stock: totalStock(variants) },
    })
  }
  return null
}

const router = express.Router()

function serialize(order) {
  return {
    orderId: order.orderId,
    total: order.total,
    deliveryFee: order.deliveryFee ?? 0,
    estimatedDelivery: order.estimatedDelivery,
    status: order.status,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    shippingAddress: order.shippingAddress ? JSON.parse(order.shippingAddress) : null,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt,
    items: order.items.map((i) => ({
      key: i.id,
      id: i.productId,
      name: i.name,
      brand: i.brand,
      price: i.price,
      size: i.size,
      qty: i.qty,
      colorway: JSON.parse(i.colorway),
      colorName: i.colorName,
      imageUrl: i.imageUrl || null,
    })),
  }
}

// POST /api/orders — place an order
router.post('/', async (req, res) => {
  const { items, customer, shippingAddress, paymentMethod } = req.body

  if (!items || items.length === 0) {
    return res.json({ data: null, error: 'Your bag is empty.' })
  }

  const settings = serializeSettings(await prisma.settings.findUnique({ where: { id: 1 } }))
  const enabledMethods = Object.entries(settings.paymentMethods)
    .filter(([, m]) => m.enabled)
    .map(([key]) => key)
  const whatsappOnly = enabledMethods.length === 0 && settings.whatsapp.enabled && !!settings.whatsapp.number
  const methodAllowed = enabledMethods.includes(paymentMethod) || (paymentMethod === 'whatsapp' && whatsappOnly)
  if (!methodAllowed) {
    return res.json({ data: null, error: 'That payment method is not available right now. Please refresh and choose another.' })
  }

  // Prices, names and brands come from the database, never from the
  // browser — what the customer sees on the order is what they owe.
  const products = await prisma.product.findMany({
    where: { id: { in: [...new Set(items.map((i) => i.id))] } },
    include: { sale: true },
  })
  const byId = Object.fromEntries(products.map((p) => [p.id, p]))
  const missing = items.find((i) => !byId[i.id])
  if (missing) {
    return res.json({ data: null, error: `${missing.name || 'An item'} is no longer available. Remove it to continue.` })
  }
  const lines = items.map((item) => {
    const p = byId[item.id]
    return {
      ...item,
      name: p.name,
      brand: p.brand,
      price: storefrontPrice(p),
      size: Math.round(Number(item.size)),
      qty: Math.max(1, Math.floor(Number(item.qty) || 1)),
    }
  })

  const user = await getUserFromRequest(req)
  const orderId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`
  const subtotal = lines.reduce((sum, item) => sum + item.price * item.qty, 0)
  const delivery = deliveryFor(settings, shippingAddress?.city, subtotal)

  const result = await prisma.$transaction(async (tx) => {
    const stockError = await adjustStock(tx, lines, -1)
    if (stockError) return { error: stockError }
    const order = await tx.order.create({
      data: {
        orderId,
        total: subtotal + delivery.fee,
        deliveryFee: delivery.fee,
        estimatedDelivery: delivery.time,
        status: 'Pending',
        customerName: customer?.name || 'Guest',
        customerEmail: customer?.email || '',
        shippingAddress: shippingAddress ? JSON.stringify(shippingAddress) : null,
        paymentMethod,
        userId: user?.id,
        items: {
          create: lines.map((item) => ({
            productId: item.id,
            name: item.name,
            brand: item.brand,
            price: item.price,
            size: item.size,
            qty: item.qty,
            colorway: JSON.stringify(item.colorway),
            colorName: item.colorName,
            imageUrl: item.imageUrl || null,
          })),
        },
      },
      include: { items: true },
    })
    return { order }
  })

  if (result.error) return res.json({ data: null, error: result.error })
  res.json({ data: serialize(result.order), error: null })
})

// GET /api/orders/track?orderId=&email=
router.get('/track', async (req, res) => {
  const { orderId = '', email = '' } = req.query
  const order = await prisma.order.findFirst({
    where: {
      orderId: { equals: orderId.trim() },
      customerEmail: { equals: email.trim() },
    },
    include: { items: true },
  })
  if (!order) {
    return res.json({ data: null, error: "We couldn't find an order with that ID and email." })
  }
  res.json({ data: serialize(order), error: null })
})

// GET /api/orders/mine — logged-in customer's own order history
router.get('/mine', requireUser, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user.id },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ data: orders.map(serialize), error: null })
})

// GET /api/orders — admin list
router.get('/', async (req, res) => {
  const orders = await prisma.order.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' } })
  res.json({ data: orders.map(serialize), error: null })
})

// PATCH /api/orders/:orderId/status
router.patch('/:orderId/status', async (req, res) => {
  const { status } = req.body
  const existing = await prisma.order.findUnique({ where: { orderId: req.params.orderId }, include: { items: true } })
  if (!existing) return res.json({ data: null, error: 'Order not found.' })
  const order = await prisma.$transaction(async (tx) => {
    // Cancelling puts the pairs back on the shelf, for that colour and size.
    if (status === 'Cancelled' && existing.status !== 'Cancelled') {
      await adjustStock(tx, existing.items, +1)
    }
    return tx.order.update({
      where: { orderId: req.params.orderId },
      data: { status },
      include: { items: true },
    })
  })
  res.json({ data: serialize(order), error: null })
})

module.exports = { router }
