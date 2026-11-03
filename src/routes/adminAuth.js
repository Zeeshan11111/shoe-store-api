const express = require('express')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const prisma = require('../lib/prisma.js')
const { sendEmail } = require('../lib/email.js')
const {
  createAdminSession,
  getAdminFromRequest,
  clearAdminSession,
  requireAdmin,
} = require('../lib/session.js')

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

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

// POST /api/admin-auth/forgot-password — request a reset link by email.
// Always responds with success regardless of whether the email matches an
// admin, so this can't be used to probe which addresses have admin access.
router.post('/forgot-password', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase()
  const admin = email ? await prisma.admin.findUnique({ where: { email } }) : null

  if (admin) {
    const token = crypto.randomBytes(32).toString('hex')
    await prisma.admin.update({
      where: { id: admin.id },
      data: { resetToken: hashToken(token), resetTokenExpiry: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    })
    const resetUrl = `${process.env.FRONTEND_ORIGIN}/admin/reset-password?token=${token}`
    try {
      await sendEmail({
        to: admin.email,
        subject: 'Reset your AF Shoes admin password',
        html: `<p>Someone requested a password reset for the AF Shoes admin panel.</p>
<p><a href="${resetUrl}">Click here to set a new password</a> — this link expires in 30 minutes.</p>
<p>If you didn't request this, you can ignore this email.</p>`,
      })
    } catch (err) {
      console.error('Failed to send admin reset email:', err)
    }
  }

  res.json({ data: true, error: null })
})

// POST /api/admin-auth/reset-password — consume a token from the email link.
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body
  if (!token || !password || password.length < 4) {
    return res.json({ data: null, error: 'Enter a token and a password of at least 4 characters.' })
  }

  const admin = await prisma.admin.findUnique({ where: { resetToken: hashToken(token) } })
  if (!admin || !admin.resetTokenExpiry || admin.resetTokenExpiry < new Date()) {
    return res.json({ data: null, error: 'This reset link is invalid or has expired.' })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.admin.update({
    where: { id: admin.id },
    data: { passwordHash, resetToken: null, resetTokenExpiry: null },
  })
  res.json({ data: true, error: null })
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

// PATCH /api/admin-auth/admins/:email/password — super admin sets another
// admin's password directly, no token/email needed.
router.patch('/admins/:email/password', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { password } = req.body
  if (!password || password.length < 4) {
    return res.json({ data: null, error: 'Password must be at least 4 characters.' })
  }
  const email = req.params.email.toLowerCase()
  const admin = await prisma.admin.findUnique({ where: { email } })
  if (!admin) {
    return res.json({ data: null, error: 'No admin with that email.' })
  }
  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.admin.update({
    where: { id: admin.id },
    data: { passwordHash, resetToken: null, resetTokenExpiry: null },
  })
  res.json({ data: true, error: null })
})

// DELETE /api/admin-auth/admins/:email (super admin only)
router.delete('/admins/:email', requireAdmin, requireSuperAdmin, async (req, res) => {
  await prisma.admin.deleteMany({ where: { email: req.params.email.toLowerCase(), role: 'admin' } })
  res.json({ data: true, error: null })
})

module.exports = { router }
