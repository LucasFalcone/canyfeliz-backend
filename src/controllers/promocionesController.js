const pool = require('../db')

const listarPromociones = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, pr.nombre AS producto_nombre
       FROM promociones p
       LEFT JOIN productos pr ON pr.id = p.producto_id
       WHERE p.activo = TRUE
         AND (p.fecha_hasta IS NULL OR p.fecha_hasta >= CURRENT_DATE)
       ORDER BY p.creado_en DESC`
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const crearPromocion = async (req, res) => {
  const { nombre, tipo, valor, categoria, producto_id, fecha_hasta } = req.body
  if (!nombre || !tipo)
    return res.status(400).json({ error: 'Nombre y tipo son requeridos' })

  try {
    const { rows: [promo] } = await pool.query(
      `INSERT INTO promociones
         (nombre, tipo, valor, categoria, producto_id, fecha_hasta)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [nombre, tipo, valor || null, categoria || null,
       producto_id || null, fecha_hasta || null]
    )
    res.status(201).json(promo)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const actualizarPromocion = async (req, res) => {
  const { nombre, tipo, valor, categoria, producto_id, fecha_hasta, activo } = req.body
  try {
    const { rows: [promo] } = await pool.query(
      `UPDATE promociones
       SET nombre=$1, tipo=$2, valor=$3, categoria=$4,
           producto_id=$5, fecha_hasta=$6, activo=$7
       WHERE id=$8 RETURNING *`,
      [nombre, tipo, valor || null, categoria || null,
       producto_id || null, fecha_hasta || null, activo, req.params.id]
    )
    if (!promo) return res.status(404).json({ error: 'Promoción no encontrada' })
    res.json(promo)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const eliminarPromocion = async (req, res) => {
  try {
    await pool.query(
      'UPDATE promociones SET activo = FALSE WHERE id = $1', [req.params.id]
    )
    res.json({ mensaje: 'Promoción desactivada' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { listarPromociones, crearPromocion, actualizarPromocion, eliminarPromocion }