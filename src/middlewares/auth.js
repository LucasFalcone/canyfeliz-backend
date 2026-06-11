const jwt = require('jsonwebtoken')

const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // "Bearer <token>"

  if (!token)
    return res.status(401).json({ error: 'Token requerido' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.usuario = payload
    next()
  } catch {
    return res.status(403).json({ error: 'Token inválido o expirado' })
  }
}

// Middleware de rol: solo admin puede acceder
const soloAdmin = (req, res, next) => {
  if (req.usuario?.rol !== 'admin')
    return res.status(403).json({ error: 'Acceso restringido a administradores' })
  next()
}

module.exports = { verificarToken, soloAdmin }