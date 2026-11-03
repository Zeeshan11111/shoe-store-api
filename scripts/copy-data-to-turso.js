require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const { PrismaLibSQL } = require('@prisma/adapter-libsql')
const { createClient } = require('@libsql/client')

const local = new PrismaClient() // uses DATABASE_URL = file:./dev.db

const libsql = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})
const tursoAdapter = new PrismaLibSQL(libsql)
const turso = new PrismaClient({ adapter: tursoAdapter })

async function copy(name, findMany, createMany) {
  const rows = await findMany()
  if (rows.length === 0) {
    console.log(`${name}: 0 rows, skipping`)
    return
  }
  await createMany(rows)
  console.log(`${name}: copied ${rows.length} row(s)`)
}

async function main() {
  await copy('User', () => local.user.findMany(), (rows) => turso.user.createMany({ data: rows }))
  await copy('Admin', () => local.admin.findMany(), (rows) => turso.admin.createMany({ data: rows }))
  await copy('Sale', () => local.sale.findMany(), (rows) => turso.sale.createMany({ data: rows }))
  await copy('Product', () => local.product.findMany(), (rows) => turso.product.createMany({ data: rows }))
  await copy('Session', () => local.session.findMany(), (rows) => turso.session.createMany({ data: rows }))
  await copy('Order', () => local.order.findMany(), (rows) => turso.order.createMany({ data: rows }))
  await copy('OrderItem', () => local.orderItem.findMany(), (rows) => turso.orderItem.createMany({ data: rows }))
  await copy('Banner', () => local.banner.findMany(), (rows) => turso.banner.createMany({ data: rows }))
  await copy('Settings', () => local.settings.findMany(), (rows) => turso.settings.createMany({ data: rows }))
  await copy('CartItem', () => local.cartItem.findMany(), (rows) => turso.cartItem.createMany({ data: rows }))
  await copy('WishlistItem', () => local.wishlistItem.findMany(), (rows) => turso.wishlistItem.createMany({ data: rows }))

  console.log('Done copying all data to Turso.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await local.$disconnect()
    await turso.$disconnect()
  })
