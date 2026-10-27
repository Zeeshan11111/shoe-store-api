const express = require('express')
const prisma = require('../lib/prisma.js')

const router = express.Router()

function serialize(b) {
  return {
    eyebrow: b.eyebrow,
    heading: [b.headingLine1, b.headingLine2],
    description: b.description,
    colorway: { sole: b.sole, upper: b.upper, accent: b.accent },
  }
}

// GET /api/banners — storefront hero slides
router.get('/', async (req, res) => {
  const rows = await prisma.banner.findMany({ orderBy: { sortOrder: 'asc' } })
  res.json({ data: rows.map(serialize), error: null })
})

// PUT /api/banners — replace the whole ordered list (admin editor saves all at once)
router.put('/', async (req, res) => {
  const banners = req.body

  await prisma.$transaction([
    prisma.banner.deleteMany(),
    prisma.banner.createMany({
      data: banners.map((b, i) => ({
        eyebrow: b.eyebrow,
        headingLine1: b.heading[0],
        headingLine2: b.heading[1],
        description: b.description,
        sole: b.colorway.sole,
        upper: b.colorway.upper,
        accent: b.colorway.accent,
        sortOrder: i,
      })),
    }),
  ])

  res.json({ data: banners, error: null })
})

module.exports = { router }
