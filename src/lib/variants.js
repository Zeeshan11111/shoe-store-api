// Mirrors COLOR_SWATCHES in the storefront's src/data/products.js — only
// used to give older products (saved before variants existed) a swatch.
const SWATCHES = {
  Amber: '#F2B134',
  Ink: '#16171B',
  Moss: '#5C6B4F',
  Rust: '#B5482E',
  Bone: '#F0EEE8',
  Clay: '#3E3A32',
}

// Builds variants for a product saved before they existed: one per colour,
// existing photos on the first colour, and the old single stock number
// spread evenly across every colour + size.
function legacyVariants(row) {
  const colors = JSON.parse(row.colors || '[]')
  const sizes = JSON.parse(row.sizes || '[]')
  const rawImages = row.images ? JSON.parse(row.images) : []
  const images = Array.isArray(rawImages) ? rawImages : Object.values(rawImages).flat()
  const names = colors.length ? colors : ['Default']
  const cells = names.length * Math.max(sizes.length, 1)
  const base = Math.floor((row.stock || 0) / cells)
  let remainder = (row.stock || 0) - base * cells

  return names.map((color, i) => {
    const stock = {}
    for (const size of sizes) {
      stock[String(size)] = base + (remainder > 0 ? 1 : 0)
      if (remainder > 0) remainder--
    }
    return {
      color,
      hex: SWATCHES[color] || row.colorwayUpper || '#16171B',
      images: i === 0 ? images : [],
      stock,
    }
  })
}

function parseVariants(row) {
  const parsed = row.variants ? JSON.parse(row.variants) : []
  return Array.isArray(parsed) && parsed.length ? parsed : legacyVariants(row)
}

// Admin input is trusted for shape only after this: strings trimmed, photo
// lists kept to strings, stock kept to non-negative integers for sizes that
// the product actually offers.
function sanitizeVariants(input, sizes) {
  const list = Array.isArray(input) ? input : []
  const seen = new Set()
  const clean = []
  for (const v of list) {
    const color = String(v?.color || '').trim()
    if (!color || seen.has(color.toLowerCase())) continue
    seen.add(color.toLowerCase())
    const stock = {}
    for (const size of sizes) {
      const qty = Math.floor(Number(v?.stock?.[String(size)]) || 0)
      stock[String(size)] = Math.max(0, qty)
    }
    clean.push({
      color,
      hex: /^#[0-9a-fA-F]{6}$/.test(v?.hex) ? v.hex : SWATCHES[color] || '#16171B',
      images: Array.isArray(v?.images) ? v.images.filter((u) => typeof u === 'string') : [],
      stock,
    })
  }
  return clean
}

function totalStock(variants) {
  return variants.reduce((sum, v) => sum + Object.values(v.stock || {}).reduce((a, b) => a + b, 0), 0)
}

// Cart items saved before colours were tracked (colorName null) fall back to
// the first colour.
function findVariantIndex(variants, colorName) {
  const i = variants.findIndex((v) => v.color === colorName)
  return i === -1 ? 0 : i
}

module.exports = { parseVariants, sanitizeVariants, totalStock, findVariantIndex }
