require('dotenv').config()
const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const swaggerUi = require('swagger-ui-express')
const swaggerSpec = require('./swagger.js')

const { router: productsRouter } = require('./routes/products.js')
const { router: ordersRouter } = require('./routes/orders.js')
const { router: dashboardRouter } = require('./routes/dashboard.js')
const { router: usersRouter } = require('./routes/users.js')
const { router: bannersRouter } = require('./routes/banners.js')
const { router: settingsRouter } = require('./routes/settings.js')
const { router: authRouter } = require('./routes/auth.js')
const { router: adminAuthRouter } = require('./routes/adminAuth.js')
const { router: cartRouter } = require('./routes/cart.js')
const { router: wishlistRouter } = require('./routes/wishlist.js')

const app = express()
const PORT = process.env.PORT || 4000
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000'

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.get('/', (req, res) => res.json({ ok: true, service: 'shoe-store-api' }))
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

app.use('/api/products', productsRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/users', usersRouter)
app.use('/api/banners', bannersRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/auth', authRouter)
app.use('/api/admin-auth', adminAuthRouter)
app.use('/api/cart', cartRouter)
app.use('/api/wishlist', wishlistRouter)

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ data: null, error: 'Internal server error.' })
})

app.listen(PORT, () => {
  console.log(`shoe-store-api listening on http://localhost:${PORT}`)
})
