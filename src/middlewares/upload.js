const multer = require('multer')

// memoryStorage: el archivo queda disponible como buffer en req.file.buffer,
// listo para subir a Supabase Storage. No se escribe nada en el disco del
// servidor (Railway tiene el filesystem efímero: se borra en cada redeploy).
const storage = multer.memoryStorage()

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