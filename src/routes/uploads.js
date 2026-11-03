const express = require('express')
const multer = require('multer')
const path = require('path')
const crypto = require('crypto')
const fs = require('fs')
const { requireAdmin } = require('../lib/session.js')

const router = express.Router()

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads')
fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg'
    cb(null, `${crypto.randomUUID()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed.'))
    }
    cb(null, true)
  },
})

// POST /api/uploads/image — admin uploads a product/banner photo, gets back its URL
router.post('/image', requireAdmin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.json({ data: null, error: err.message })
    if (!req.file) return res.json({ data: null, error: 'No file uploaded.' })
    res.json({ data: { url: `/uploads/${req.file.filename}` }, error: null })
  })
})

module.exports = { router }
