// Use after requireAdmin — gates a route to admins with a specific permission
// key (super admins always pass, regardless of their stored permissions list).
function requirePermission(key) {
  return (req, res, next) => {
    const admin = req.admin
    if (admin.role === 'super') return next()
    const perms = JSON.parse(admin.permissions || '[]')
    if (!perms.includes(key)) {
      return res.status(403).json({ data: null, error: `Your admin account doesn't have the "${key}" permission.` })
    }
    next()
  }
}

module.exports = { requirePermission }
