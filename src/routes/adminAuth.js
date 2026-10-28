const express = require('express')
const bcrypt = require('bcryptjs')
const prisma = require('../lib/prisma.js')
const {
  createAdminSession,
  getAdminFromRequest,
  clearAdminSession,
  requireAdmin,
} = require('../lib/session.js')

const router = express.Router()

const ALL_PERMISSIONS = ['dashboard', 'orders', 'products', 'banners', 'users', 'sales']

function safe(admin) {
  return { email: admin.email, role: admin.role, permissions: JSON.parse(admin.permissions) }
}

function requireSuperAdmin(req, res, next) {
  if (req.admin.role !== 'super') {
    return res.status(403).json({ data: null, error: 'Only a super admin can do this.' })
  }
  next()
}

// POST /api/admin-auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  const admin = await prisma.admin.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    return res.json({ data: null, error: 'Incorrect admin email or password.' })
  }
  await createAdminSession(res, admin.id)
  res.json({ data: safe(admin), error: null })
})

// POST /api/admin-auth/logout
router.post('/logout', async (req, res) => {
  await clearAdminSession(req, res)
  res.json({ data: true, error: null })
})

// GET /api/admin-auth/me
router.get('/me', async (req, res) => {
  const admin = await getAdminFromRequest(req)
  res.json({ data: admin ? safe(admin) : null, error: null })
})

// GET /api/admin-auth/admins — list (super admin only)
router.get('/admins', requireAdmin, requireSuperAdmin, async (req, res) => {
  const admins = await prisma.admin.findMany({ orderBy: { createdAt: 'asc' } })
  res.json({ data: admins.map(safe), error: null })
})

// POST /api/admin-auth/admins — create a limited admin (super admin only)
router.post('/admins', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { email, password, permissions } = req.body
  const existing = await prisma.admin.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) {
    return res.json({ data: null, error: 'An admin with that email already exists.' })
  }
  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.admin.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      role: 'admin',
      permissions: JSON.stringify(permissions.filter((p) => ALL_PERMISSIONS.includes(p))),
    },
  })
  res.json({ data: true, error: null })
})

// PATCH /api/admin-auth/admins/:email — update permissions (super admin only)
router.patch('/admins/:email', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { permissions } = req.body
  await prisma.admin.update({
    where: { email: req.params.email.toLowerCase() },
    data: { permissions: JSON.stringify(permissions.filter((p) => ALL_PERMISSIONS.includes(p))) },
  })
  res.json({ data: true, error: null })
})

// DELETE /api/admin-auth/admins/:email (super admin only)
router.delete('/admins/:email', requireAdmin, requireSuperAdmin, async (req, res) => {
  await prisma.admin.deleteMany({ where: { email: req.params.email.toLowerCase(), role: 'admin' } })
  res.json({ data: true, error: null })
})

module.exports = { router }
