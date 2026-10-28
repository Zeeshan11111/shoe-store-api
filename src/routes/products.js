const express = require('express')
const prisma = require('../lib/prisma.js')

const router = express.Router()

// A sale campaign only actually discounts the product while it's enabled
// and (if dated) inside its start/end window — same rule the storefront
// ticker uses to decide "live" vs "coming soon" vs "ended".
function isSaleActive(sale) {
  if (!sale || !sale.enabled) return false
  const now = new Date()
  if (sale.startDate && sale.startDate > now) return false
  if (sale.endDate && sale.endDate < now) return false
  return true
}

// Raw serializer — `price`/`originalPrice` exactly as stored. Used for the
// admin list and the upsert response, so editing a product and saving it
// back never accidentally persists an already-discounted price as the new
// base price.
function serialize(p) {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    gender: p.gender,
    price: p.price,
    originalPrice: p.originalPrice,
    rating: p.rating,
    reviews: p.reviews,
    isNew: p.isNew,
    stock: p.stock,
    description: p.description,
    colorway: { sole: p.colorwaySole, upper: p.colorwayUpper, accent: p.colorwayAccent },
    colors: JSON.parse(p.colors),
    sizes: JSON.parse(p.sizes),
    sale: p.sale
      ? {
          id: p.sale.id,
          name: p.sale.name,
          percentage: p.sale.percentage,
          enabled: p.sale.enabled,
          startDate: p.sale.startDate ? p.sale.startDate.toISOString() : null,
          endDate: p.sale.endDate ? p.sale.endDate.toISOString() : null,
        }
      : null,
  }
}

// Storefront serializer — what customers actually see/pay. `p.price` stays
// the admin-set base price in the database; when an active campaign is
// attached, the real price is computed here instead of the admin having to
// hand-type a separate sale price, and the discount disappears automatically
// the moment the campaign is disabled or its date window ends.
function serializeForStorefront(p) {
  const base = serialize(p)
  if (!isSaleActive(p.sale)) return base
  return {
    ...base,
    price: Math.round(p.price * (1 - p.sale.percentage / 100) * 100) / 100,
    originalPrice: p.price,
  }
}

function toRow(product) {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    gender: product.gender,
    price: Number(product.price) || 0,
    originalPrice: product.originalPrice ? Number(product.originalPrice) : null,
    rating: Number(product.rating) || 0,
    reviews: Number(product.reviews) || 0,
    isNew: !!product.isNew,
    stock: Number(product.stock) || 0,
    description: product.description || '',
    colorwaySole: product.colorway.sole,
    colorwayUpper: product.colorway.upper,
    colorwayAccent: product.colorway.accent,
    colors: JSON.stringify(product.colors),
    sizes: JSON.stringify(product.sizes),
    saleId: product.saleId || null,
  }
}

// GET /api/products?category=&gender=&search=&sort=
router.get('/', async (req, res) => {
  const { category = 'All', gender = 'All', search = '', sort = 'featured' } = req.query

  const where = {}
  if (category && category !== 'All') where.category = category
  if (gender && gender !== 'All') where.gender = gender
  if (search && search.trim()) {
    where.OR = [
      { name: { contains: search.trim() } },
      { brand: { contains: search.trim() } },
    ]
  }

  let orderBy
  switch (sort) {
    case 'price-asc':
      orderBy = { price: 'asc' }
      break
    case 'price-desc':
      orderBy = { price: 'desc' }
      break
    case 'rating':
      orderBy = { rating: 'desc' }
      break
    case 'newest':
      orderBy = { isNew: 'desc' }
      break
    default:
      orderBy = { createdAt: 'asc' }
  }

  const rows = await prisma.product.findMany({ where, orderBy, include: { sale: true } })
  res.json({ data: rows.map(serializeForStorefront), error: null })
})

// GET /api/products/all — unfiltered, for the admin list
router.get('/all', async (req, res) => {
  const rows = await prisma.product.findMany({ orderBy: { createdAt: 'asc' }, include: { sale: true } })
  res.json({ data: rows.map(serialize), error: null })
})

// GET /api/products/brands — distinct brand names currently stocked, for the storefront brand strip
router.get('/brands', async (req, res) => {
  const rows = await prisma.product.findMany({
    where: { stock: { gt: 0 } },
    select: { brand: true },
    distinct: ['brand'],
    orderBy: { brand: 'asc' },
  })
  res.json({ data: rows.map((r) => r.brand), error: null })
})

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  const row = await prisma.product.findUnique({ where: { id: req.params.id }, include: { sale: true } })
  if (!row) return res.json({ data: null, error: 'Product not found.' })
  res.json({ data: serializeForStorefront(row), error: null })
})

// POST /api/products — create or update (upsert by id)
router.post('/', async (req, res) => {
  const product = req.body
  const row = await prisma.product.upsert({
    where: { id: product.id },
    create: toRow(product),
    update: toRow(product),
    include: { sale: true },
  })
  res.json({ data: serialize(row), error: null })
})

// DELETE /api/products/:id
router.delete('/:id', async (req, res) => {
  await prisma.product.delete({ where: { id: req.params.id } }).catch(() => {})
  res.json({ data: true, error: null })
})

module.exports = { router, serializeProduct: serialize }
