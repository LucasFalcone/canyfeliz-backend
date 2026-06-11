const multer = require('multer')
const path   = require('path')
const fs     = require('fs')

const dir = path.join(__dirname, '../uploads/productos')
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dir),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname)
    const name = `producto_${req.params.id}_${Date.now()}${ext}`
    cb(null, name)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Solo se permiten imágenes JPG, PNG o WEBP'))
  },
})

module.exports = upload