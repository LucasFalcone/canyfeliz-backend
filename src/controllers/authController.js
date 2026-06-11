const pool    = require('../db')
const bcrypt  = require('bcryptjs')
const jwt     = require('jsonwebtoken')

const login = async (req, res) => {
  const { email, password } = req.body

  if (!email || !password)
    return res.status(400).json({ error: 'Email y contraseña requeridos' })

  try {
    // Trae el usuario completo incluyendo veterinaria
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1 AND activo = TRUE',
      [email.trim().toLowerCase()]
    )

    const usuario = result.rows[0]

    if (!usuario)
      return res.status(401).json({ error: 'Credenciales inválidas' })

    const passwordOk = await bcrypt.compare(password, usuario.password)

    if (!passwordOk)
      return res.status(401).json({ error: 'Credenciales inválidas' })

    const token = jwt.sign(
      {
        id:          usuario.id,
        rol:         usuario.rol,
        nombre:      usuario.nombre,
        veterinaria: usuario.veterinaria || 'donato',
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    )

    res.json({
      token,
      usuario: {
        id:           usuario.id,
        nombre:       usuario.nombre,
        email:        usuario.email,
        rol:          usuario.rol,
        veterinaria:  usuario.veterinaria || 'donato',
      },
    })
  } catch (err) {
    console.error('Error en login:', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

const me = async (req, res) => {
  // req.usuario viene del middleware
  res.json(req.usuario)
}

module.exports = { login, me }