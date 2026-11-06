const express = require('express')
const prisma = require('../lib/prisma.js')
const { requireUser } = require('../lib/session.js')
const { parseVariants, sanitizeVariants, totalStock } = require('../lib/variants.js')

const router = express.Router()

// Real customer ratings override the admin-seeded rating/reviews count the
// moment at least one review exists — computed in bulk (one groupBy, not
// one query per product) so list endpoints stay cheap.
async function getReviewStats() {
  const stats = await prisma.review.groupBy({
    by: ['productId'],
    _avg: { rating: true },
    _count: { rating: true },
  })
  const map = {}
  for (const s of stats) {
    map[s.productId] = { rating: Math.round(s._avg.rating * 10) / 10, reviews: s._count.rating }
  }
  return map
}

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
function serialize(p, reviewStats = {}) {
  const real = reviewStats[p.id]
  const variants = parseVariants(p)
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    gender: p.gender,
    price: p.price,
    originalPrice: p.originalPrice,
    rating: real ? real.rating : p.rating,
    reviews: real ? real.reviews : p.reviews,
    isNew: p.isNew,
    stock: totalStock(variants),
    description: p.description,
    colorway: { sole: p.colorwaySole, upper: p.colorwayUpper, accent: p.colorwayAccent },
    colors: variants.map((v) => v.color),
    sizes: JSON.parse(p.sizes),
    images: variants.flatMap((v) => v.images),
    variants,
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
function salePrice(p) {
  return Math.round(p.price * (1 - p.sale.percentage / 100) * 100) / 100
}

// What a customer is charged right now for one pair — the same number the
// storefront shows. Needs the row loaded with `include: { sale: true }`.
function storefrontPrice(p) {
  return isSaleActive(p.sale) ? salePrice(p) : p.price
}

function serializeForStorefront(p, reviewStats = {}) {
  const base = serialize(p, reviewStats)
  if (!isSaleActive(p.sale)) return base
  return {
    ...base,
    price: salePrice(p),
    originalPrice: p.price,
  }
}

// Variants are the source of truth; the flat `colors`/`images`/`stock`
// columns are derived from them so list queries (e.g. "brands in stock")
// keep working without parsing JSON.
function toRow(product) {
  const sizes = (Array.isArray(product.sizes) ? product.sizes : []).map(Number).filter((n) => n > 0)
  let variants = sanitizeVariants(product.variants, sizes)
  if (!variants.length) {
    variants = parseVariants({
      variants: '[]',
      colors: JSON.stringify(product.colors || []),
      sizes: JSON.stringify(sizes),
      images: JSON.stringify(product.images || []),
      stock: Number(product.stock) || 0,
      colorwayUpper: product.colorway?.upper,
    })
  }
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
    stock: totalStock(variants),
    description: product.description || '',
    colorwaySole: product.colorway.sole,
    colorwayUpper: variants[0]?.hex || product.colorway.upper,
    colorwayAccent: product.colorway.accent,
    colors: JSON.stringify(variants.map((v) => v.color)),
    sizes: JSON.stringify(sizes),
    images: JSON.stringify(variants.flatMap((v) => v.images)),
    variants: JSON.stringify(variants),
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

  const [rows, reviewStats] = await Promise.all([
    prisma.product.findMany({ where, orderBy, include: { sale: true } }),
    getReviewStats(),
  ])
  res.json({ data: rows.map((p) => serializeForStorefront(p, reviewStats)), error: null })
})

// GET /api/products/all — unfiltered, for the admin list
router.get('/all', async (req, res) => {
  const [rows, reviewStats] = await Promise.all([
    prisma.product.findMany({ orderBy: { createdAt: 'asc' }, include: { sale: true } }),
    getReviewStats(),
  ])
  res.json({ data: rows.map((p) => serialize(p, reviewStats)), error: null })
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
  const reviewStats = await getReviewStats()
  res.json({ data: serializeForStorefront(row, reviewStats), error: null })
})

// Only lets someone rate a product once they've actually received an order
// containing it — a basic "verified purchase" gate, not open to anyone
// logged in.
async function hasDeliveredOrder(userId, productId) {
  const item = await prisma.orderItem.findFirst({
    where: { productId, order: { userId, status: 'Delivered' } },
  })
  return !!item
}

// POST /api/products/:id/review — submit or update your own rating (one per user per product)
router.post('/:id/review', requireUser, async (req, res) => {
  const ratingNum = Number(req.body.rating)
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.json({ data: null, error: 'Rating must be a whole number from 1 to 5.' })
  }
  const eligible = await hasDeliveredOrder(req.user.id, req.params.id)
  if (!eligible) {
    return res.json({ data: null, error: 'You can rate this product once your order for it has been delivered.' })
  }
  const comment = req.body.comment ? String(req.body.comment).slice(0, 1000) : null
  const review = await prisma.review.upsert({
    where: { userId_productId: { userId: req.user.id, productId: req.params.id } },
    create: { userId: req.user.id, productId: req.params.id, rating: ratingNum, comment },
    update: { rating: ratingNum, comment },
  })
  res.json({ data: { rating: review.rating, comment: review.comment }, error: null })
})

// GET /api/products/:id/review/mine — the logged-in user's own rating for this
// product (if any) plus whether they're even eligible to rate it yet.
router.get('/:id/review/mine', requireUser, async (req, res) => {
  const eligible = await hasDeliveredOrder(req.user.id, req.params.id)
  const review = await prisma.review.findUnique({
    where: { userId_productId: { userId: req.user.id, productId: req.params.id } },
  })
  res.json({
    data: { eligible, rating: review?.rating ?? null, comment: review?.comment ?? null },
    error: null,
  })
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

module.exports = { router, serializeProduct: serialize, storefrontPrice }
