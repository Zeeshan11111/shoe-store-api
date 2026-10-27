const express = require('express')
const prisma = require('../lib/prisma.js')

const router = express.Router()

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

  const rows = await prisma.product.findMany({ where, orderBy })
  res.json({ data: rows.map(serialize), error: null })
})

// GET /api/products/all — unfiltered, for the admin list
router.get('/all', async (req, res) => {
  const rows = await prisma.product.findMany({ orderBy: { createdAt: 'asc' } })
  res.json({ data: rows.map(serialize), error: null })
})

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  const row = await prisma.product.findUnique({ where: { id: req.params.id } })
  if (!row) return res.json({ data: null, error: 'Product not found.' })
  res.json({ data: serialize(row), error: null })
})

// POST /api/products — create or update (upsert by id)
router.post('/', async (req, res) => {
  const product = req.body
  const row = await prisma.product.upsert({
    where: { id: product.id },
    create: toRow(product),
    update: toRow(product),
  })
  res.json({ data: serialize(row), error: null })
})

// DELETE /api/products/:id
router.delete('/:id', async (req, res) => {
  await prisma.product.delete({ where: { id: req.params.id } }).catch(() => {})
  res.json({ data: true, error: null })
})

module.exports = { router, serializeProduct: serialize }
