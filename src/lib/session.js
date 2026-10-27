const crypto = require('crypto')
const prisma = require('./prisma.js')

const SESSION_DAYS = 30
const USER_COOKIE = 'stryde_session'
const ADMIN_COOKIE = 'stryde_admin_session'

function newToken() {
  return crypto.randomBytes(32).toString('hex')
}

async function createUserSession(res, userId) {
  const token = newToken()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await prisma.session.create({ data: { token, userId, expiresAt } })
  res.cookie(USER_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    expires: expiresAt,
  })
}

async function createAdminSession(res, adminId) {
  const token = newToken()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await prisma.session.create({ data: { token, adminId, expiresAt } })
  res.cookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    expires: expiresAt,
  })
}

async function getUserFromRequest(req) {
  const token = req.cookies?.[USER_COOKIE]
  if (!token) return null
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } })
  if (!session || !session.user || session.expiresAt < new Date()) return null
  return session.user
}

async function getAdminFromRequest(req) {
  const token = req.cookies?.[ADMIN_COOKIE]
  if (!token) return null
  const session = await prisma.session.findUnique({ where: { token }, include: { admin: true } })
  if (!session || !session.admin || session.expiresAt < new Date()) return null
  return session.admin
}

function clearUserSession(req, res) {
  const token = req.cookies?.[USER_COOKIE]
  res.clearCookie(USER_COOKIE)
  if (token) return prisma.session.deleteMany({ where: { token } })
}

function clearAdminSession(req, res) {
  const token = req.cookies?.[ADMIN_COOKIE]
  res.clearCookie(ADMIN_COOKIE)
  if (token) return prisma.session.deleteMany({ where: { token } })
}

async function requireUser(req, res, next) {
  const user = await getUserFromRequest(req)
  if (!user) return res.status(401).json({ data: null, error: 'Not logged in.' })
  req.user = user
  next()
}

async function requireAdmin(req, res, next) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return res.status(401).json({ data: null, error: 'Not logged in.' })
  req.admin = admin
  next()
}

module.exports = {
  createUserSession,
  createAdminSession,
  getUserFromRequest,
  getAdminFromRequest,
  clearUserSession,
  clearAdminSession,
  requireUser,
  requireAdmin,
}
