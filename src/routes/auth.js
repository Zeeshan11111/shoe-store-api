const express = require('express')
const bcrypt = require('bcryptjs')
const prisma = require('../lib/prisma.js')
const { createUserSession, getUserFromRequest, clearUserSession } = require('../lib/session.js')

const router = express.Router()

function safe(user) {
  return { name: user.name, email: user.email, phone: user.phone || '' }
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, phone } = req.body
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) {
    return res.json({ data: null, error: 'An account with that email already exists — try logging in instead.' })
  }
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { name, email: email.toLowerCase(), passwordHash, phone: phone || '' },
  })
  await createUserSession(res, user.id)
  res.json({ data: safe(user), error: null })
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.json({ data: null, error: "That email and password don't match an account." })
  }
  await createUserSession(res, user.id)
  res.json({ data: safe(user), error: null })
})

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  await clearUserSession(req, res)
  res.json({ data: true, error: null })
})

// GET /api/auth/me
router.get('/me', async (req, res) => {
  const user = await getUserFromRequest(req)
  res.json({ data: user ? safe(user) : null, error: null })
})

module.exports = { router }
