const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

// Mirrors shoe-store/src/data/products.js exactly (kept as a plain copy
// here rather than a cross-project import, since this backend is a fully
// separate Node project/module system).
const PRODUCTS = [
  { id: 'strd-001', name: 'Vector Runner', brand: 'STRYDE', category: 'Running', gender: 'Men', price: 129, originalPrice: null, rating: 4.6, reviews: 214, isNew: true, colorway: { sole: '#16171B', upper: '#F2B134', accent: '#5C6B4F' }, colors: ['Amber', 'Ink', 'Moss'], sizes: [7, 8, 9, 10, 11, 12], stock: 18, description: 'A lightweight daily trainer with a responsive foam midsole, built for long-mile comfort without weighing down your stride.' },
  { id: 'strd-002', name: 'Baseline High', brand: 'Cursor Athletics', category: 'Basketball', gender: 'Men', price: 159, originalPrice: 189, rating: 4.8, reviews: 342, isNew: false, colorway: { sole: '#16171B', upper: '#B5482E', accent: '#F0EEE8' }, colors: ['Rust', 'Ink'], sizes: [8, 9, 10, 11, 12, 13], stock: 9, description: 'High-top support built for the hardwood — a locked-in ankle collar and a grippy outsole pattern for hard cuts.' },
  { id: 'strd-003', name: 'Northfield Trail', brand: 'Northfield', category: 'Running', gender: 'Women', price: 145, originalPrice: null, rating: 4.4, reviews: 98, isNew: false, colorway: { sole: '#3E3A32', upper: '#7C8C6C', accent: '#F2B134' }, colors: ['Moss', 'Clay'], sizes: [7, 8, 9, 10, 11], stock: 24, description: 'An aggressive lugged outsole and a reinforced toe cap for uneven terrain and wet trail conditions.' },
  { id: 'strd-004', name: 'Volt Pulse', brand: 'Volt', category: 'Training', gender: 'Men', price: 119, originalPrice: null, rating: 4.5, reviews: 156, isNew: true, colorway: { sole: '#16171B', upper: '#5C6B4F', accent: '#F2B134' }, colors: ['Moss', 'Ink'], sizes: [6, 7, 8, 9, 10, 11], stock: 31, description: 'A flat, stable base for lifting days with a flexible forefoot for circuit work and short sprints.' },
  { id: 'strd-005', name: 'Haze Slip-On', brand: 'Haze', category: 'Lifestyle', gender: 'Women', price: 89, originalPrice: 109, rating: 4.2, reviews: 77, isNew: false, colorway: { sole: '#E4E1D8', upper: '#16171B', accent: '#B5482E' }, colors: ['Ink', 'Bone'], sizes: [6, 7, 8, 9, 10], stock: 12, description: "No laces, no fuss — a knit upper and a cushioned footbed for everyday wear from couch to corner store." },
  { id: 'strd-006', name: 'Vector Runner Low', brand: 'STRYDE', category: 'Running', gender: 'Women', price: 135, originalPrice: null, rating: 4.7, reviews: 189, isNew: false, colorway: { sole: '#16171B', upper: '#F0EEE8', accent: '#5C6B4F' }, colors: ['Bone', 'Moss'], sizes: [7, 8, 9, 10, 11, 12, 13], stock: 6, description: 'The Vector platform in a low-profile cut, tuned for tempo runs and race day.' },
  { id: 'strd-007', name: 'Baseline Mid', brand: 'Cursor Athletics', category: 'Basketball', gender: 'Child', price: 139, originalPrice: null, rating: 4.3, reviews: 121, isNew: false, colorway: { sole: '#16171B', upper: '#5C6B4F', accent: '#B5482E' }, colors: ['Moss', 'Rust'], sizes: [8, 9, 10, 11, 12], stock: 15, description: 'A mid-cut build that trades some ankle coverage for a lighter, faster feel on court.' },
  { id: 'strd-008', name: 'Groundwork Trainer', brand: 'Volt', category: 'Training', gender: 'Men', price: 109, originalPrice: 129, rating: 4.1, reviews: 64, isNew: false, colorway: { sole: '#3E3A32', upper: '#B5482E', accent: '#F2B134' }, colors: ['Rust', 'Clay'], sizes: [7, 8, 9, 10, 11], stock: 0, description: 'A wide, stable heel platform for barbell work paired with a breathable mesh forefoot.' },
  { id: 'strd-009', name: 'Haze Court Classic', brand: 'Haze', category: 'Lifestyle', gender: 'Women', price: 95, originalPrice: null, rating: 4.6, reviews: 203, isNew: true, colorway: { sole: '#F0EEE8', upper: '#F0EEE8', accent: '#16171B' }, colors: ['Bone'], sizes: [6, 7, 8, 9, 10, 11, 12], stock: 40, description: 'A clean, minimal court-inspired sneaker that goes with everything in your closet.' },
  { id: 'strd-010', name: 'Northfield Ascent', brand: 'Northfield', category: 'Running', gender: 'Men', price: 165, originalPrice: null, rating: 4.9, reviews: 88, isNew: true, colorway: { sole: '#16171B', upper: '#F2B134', accent: '#16171B' }, colors: ['Amber'], sizes: [8, 9, 10, 11, 12], stock: 5, description: 'Built for vertical gain — a stiffer plate and aggressive tread for steep, technical climbs.' },
  { id: 'strd-011', name: 'Volt Circuit Low', brand: 'Volt', category: 'Training', gender: 'Child', price: 99, originalPrice: null, rating: 4.0, reviews: 41, isNew: false, colorway: { sole: '#16171B', upper: '#7C8C6C', accent: '#F0EEE8' }, colors: ['Moss', 'Bone'], sizes: [6, 7, 8, 9], stock: 22, description: 'An entry-level cross-trainer built for HIIT classes and general gym work.' },
  { id: 'strd-012', name: 'Haze Weekender', brand: 'Haze', category: 'Lifestyle', gender: 'Women', price: 79, originalPrice: 99, rating: 4.3, reviews: 112, isNew: false, colorway: { sole: '#B5482E', upper: '#3E3A32', accent: '#F0EEE8' }, colors: ['Clay', 'Rust'], sizes: [7, 8, 9, 10, 11], stock: 3, description: 'Canvas upper, cupsole construction — a low-maintenance everyday shoe that breaks in fast.' },
]

const HERO_SLIDES = [
  { eyebrow: 'Fall/Winter drop', heading: ['BUILT FOR', 'MOVEMENT'], description: 'Running, court, gym or street — every pair here is picked for real performance, not just how it photographs.', colorway: { sole: '#F0EEE8', upper: '#F2B134', accent: '#5C6B4F' } },
  { eyebrow: 'New arrivals', heading: ['FRESH OFF', 'THE SHELF'], description: 'Just landed — the latest colorways and silhouettes, tested on pavement before they ever hit the shelf.', colorway: { sole: '#16171B', upper: '#B5482E', accent: '#F0EEE8' } },
  { eyebrow: 'Trail season', heading: ['GO WHERE', 'THE ROAD ENDS'], description: 'Lugged outsoles and reinforced toe caps, built for mud, roots and everything the trail throws at you.', colorway: { sole: '#3E3A32', upper: '#7C8C6C', accent: '#F2B134' } },
]

async function main() {
  console.log('Seeding products...')
  for (const p of PRODUCTS) {
    await prisma.product.upsert({
      where: { id: p.id },
      create: {
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
        colorwaySole: p.colorway.sole,
        colorwayUpper: p.colorway.upper,
        colorwayAccent: p.colorway.accent,
        colors: JSON.stringify(p.colors),
        sizes: JSON.stringify(p.sizes),
      },
      update: {},
    })
  }

  console.log('Seeding banners...')
  const bannerCount = await prisma.banner.count()
  if (bannerCount === 0) {
    for (let i = 0; i < HERO_SLIDES.length; i++) {
      const b = HERO_SLIDES[i]
      await prisma.banner.create({
        data: {
          eyebrow: b.eyebrow,
          headingLine1: b.heading[0],
          headingLine2: b.heading[1],
          description: b.description,
          sole: b.colorway.sole,
          upper: b.colorway.upper,
          accent: b.colorway.accent,
          sortOrder: i,
        },
      })
    }
  }

  console.log('Seeding settings...')
  await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  })

  console.log('Seeding super admin...')
  const superAdminEmail = 'admin@stryde.com'
  const existingAdmin = await prisma.admin.findUnique({ where: { email: superAdminEmail } })
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('stryde2025', 10)
    await prisma.admin.create({
      data: {
        email: superAdminEmail,
        passwordHash,
        role: 'super',
        permissions: JSON.stringify(['dashboard', 'orders', 'products', 'banners', 'users']),
      },
    })
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
