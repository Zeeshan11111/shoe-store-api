const express = require('express')
const prisma = require('../lib/prisma.js')
const { getUserFromRequest } = require('../lib/session.js')

const router = express.Router()

function serialize(order) {
  return {
    orderId: order.orderId,
    total: order.total,
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
    })),
  }
}

// POST /api/orders — place an order
router.post('/', async (req, res) => {
  const { items, customer, shippingAddress, paymentMethod } = req.body

  if (!items || items.length === 0) {
    return res.json({ data: null, error: 'Your bag is empty.' })
  }

  const ids = items.map((i) => i.id)
  const products = await prisma.product.findMany({ where: { id: { in: ids } } })
  const outOfStockItem = items.find((item) => {
    const product = products.find((p) => p.id === item.id)
    return product && product.stock === 0
  })
  if (outOfStockItem) {
    return res.json({ data: null, error: `${outOfStockItem.name} just sold out. Remove it to continue.` })
  }

  // ~8% simulated decline, mirroring the original mock behavior until a
  // real payment gateway (JazzCash/EasyPaisa/card) is wired in.
  if (Math.random() < 0.08) {
    return res.json({ data: null, error: 'Payment could not be processed. Please try again.' })
  }

  const user = await getUserFromRequest(req)
  const orderId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0)

  const order = await prisma.order.create({
    data: {
      orderId,
      total,
      estimatedDelivery: '3–5 business days',
      status: 'Pending',
      customerName: customer?.name || 'Guest',
      customerEmail: customer?.email || '',
      shippingAddress: shippingAddress ? JSON.stringify(shippingAddress) : null,
      paymentMethod,
      userId: user?.id,
      items: {
        create: items.map((item) => ({
          productId: item.id,
          name: item.name,
          brand: item.brand,
          price: item.price,
          size: item.size,
          qty: item.qty,
          colorway: JSON.stringify(item.colorway),
          colorName: item.colorName,
        })),
      },
    },
    include: { items: true },
  })

  res.json({ data: serialize(order), error: null })
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

// GET /api/orders — admin list
router.get('/', async (req, res) => {
  const orders = await prisma.order.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' } })
  res.json({ data: orders.map(serialize), error: null })
})

// PATCH /api/orders/:orderId/status
router.patch('/:orderId/status', async (req, res) => {
  const { status } = req.body
  const existing = await prisma.order.findUnique({ where: { orderId: req.params.orderId } })
  if (!existing) return res.json({ data: null, error: 'Order not found.' })
  const order = await prisma.order.update({
    where: { orderId: req.params.orderId },
    data: { status },
    include: { items: true },
  })
  res.json({ data: serialize(order), error: null })
})

module.exports = { router }
