const pool = require('../db')

const getStock = async (req, res) => {
  const veterinaria = req.usuario?.veterinaria || 'donato'

  try {
    const { rows } = await pool.query(
      `SELECT
        p.id,
        p.nombre,
        p.precio,
        p.codigo,
        p.stock,
        MIN(l.fecha_venc)
          FILTER (
            WHERE l.cantidad > 0
              AND l.fecha_venc >= CURRENT_DATE
          ) AS proximo_venc,
        COUNT(DISTINCT l.id)
          FILTER (WHERE l.cantidad > 0) AS cantidad_lotes,
        SUM(
          CASE
            WHEN l.fecha_venc <= CURRENT_DATE + INTERVAL '30 days'
             AND l.fecha_venc >= CURRENT_DATE
             AND l.cantidad > 0
            THEN l.cantidad
            ELSE 0
          END
        ) AS stock_por_vencer,
        SUM(
          CASE
            WHEN l.fecha_venc < CURRENT_DATE
             AND l.cantidad > 0
            THEN l.cantidad
            ELSE 0
          END
        ) AS stock_vencido
       FROM productos p
       LEFT JOIN lotes l
         ON l.producto_id = p.id
       WHERE p.veterinaria = $1
       GROUP BY p.id
       ORDER BY proximo_venc ASC NULLS LAST`,
      [veterinaria]
    )

    res.json(rows)
  } catch (err) {
    console.error('Error getStock:', err.message)
    res.status(500).json({ error: err.message })
  }
}

const getLotes = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT *,
        CASE
          WHEN fecha_venc < CURRENT_DATE                        THEN 'vencido'
          WHEN fecha_venc <= CURRENT_DATE + INTERVAL '30 days' THEN 'por_vencer'
          ELSE 'ok'
        END AS estado
       FROM lotes
       WHERE producto_id = $1
       AND cantidad > 0
       ORDER BY fecha_venc ASC`,
      [req.params.id]
    )

    res.json(rows)

  } catch (err) {
    console.error('Error getLotes:', err.message)
    res.status(500).json({ error: err.message })
  }
}

const agregarLote = async (req, res) => {
  const { cantidad, fecha_venc, numero_lote } = req.body
  const { id: producto_id } = req.params

  if (!cantidad || !fecha_venc)
    return res.status(400).json({ error: 'Cantidad y fecha de vencimiento requeridas' })

  try {
    const { rows: [lote] } = await pool.query(
      `INSERT INTO lotes (producto_id, cantidad, fecha_venc, numero_lote)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [producto_id, cantidad, fecha_venc, numero_lote || null]
    )
    res.status(201).json(lote)
  } catch (err) {
    console.error('Error agregarLote:', err.message)
    res.status(500).json({ error: err.message })
  }
}

const darBajaLote = async (req, res) => {
  const { id, lote_id } = req.params
  const { motivo } = req.body

  try {
    const { rows: [lote] } = await pool.query(
      `UPDATE lotes SET cantidad = 0
       WHERE id = $1 AND producto_id = $2
       RETURNING *`,
      [lote_id, id]
    )

    if (!lote)
      return res.status(404).json({ error: 'Lote no encontrado' })

    res.json({ mensaje: `Lote dado de baja. Motivo: ${motivo || 'manual'}`, lote })
  } catch (err) {
    console.error('Error darBajaLote:', err.message)
    res.status(500).json({ error: err.message })
  }
}



const getAlertas = async (req, res) => {
  const dias = parseInt(req.query.dias) || 30
  const veterinaria = req.usuario?.veterinaria || 'donato'

  try {
    const { rows } = await pool.query(
      `SELECT
        p.id,
        p.nombre,
        p.codigo,
        p.stock,
        MIN(l.fecha_venc) FILTER (WHERE l.cantidad > 0) AS proximo_venc,
        SUM(
          CASE
            WHEN l.fecha_venc <= CURRENT_DATE + ($1 || ' days')::INTERVAL
                 AND l.cantidad > 0
            THEN l.cantidad
            ELSE 0
          END
        ) AS stock_por_vencer,
        SUM(
          CASE
            WHEN l.fecha_venc < CURRENT_DATE
                 AND l.cantidad > 0
            THEN l.cantidad
            ELSE 0
          END
        ) AS stock_vencido
       FROM productos p
       LEFT JOIN lotes l
         ON l.producto_id = p.id
       WHERE p.veterinaria = $2
       GROUP BY p.id, p.nombre, p.codigo, p.stock
       HAVING
         p.stock = 0
         OR MIN(l.fecha_venc) FILTER (WHERE l.cantidad > 0)
              <= CURRENT_DATE + ($1 || ' days')::INTERVAL
         OR SUM(
              CASE
                WHEN l.fecha_venc < CURRENT_DATE
                     AND l.cantidad > 0
                THEN l.cantidad
                ELSE 0
              END
            ) > 0
       ORDER BY proximo_venc ASC NULLS LAST`,
      [dias, veterinaria]
    )

    res.json(rows)
  } catch (err) {
    console.error('Error getAlertas:', err.message)
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getStock, getLotes, agregarLote, getAlertas, darBajaLote }