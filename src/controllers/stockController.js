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
        p.categoria,
        p.stock_minimo,  
        p.subcategoria,
        p.etiqueta,
        p.imagen_url, 

        -- STOCK REAL (incluye lotes sin vencimiento o vigentes)
        COALESCE(
          SUM(
            CASE
              WHEN l.cantidad > 0 THEN l.cantidad
              ELSE 0
            END
          ), 0
        ) AS stock,

        -- Próximo vencimiento válido
        MIN(l.fecha_venc) FILTER (
          WHERE l.cantidad > 0
            AND l.fecha_venc IS NOT NULL
            AND l.fecha_venc >= CURRENT_DATE
        ) AS proximo_venc,

        -- cantidad de lotes activos
        COUNT(l.id) FILTER (WHERE l.cantidad > 0) AS cantidad_lotes,

        -- por vencer (60 días)
        SUM(
          CASE
            WHEN l.fecha_venc IS NOT NULL
              AND l.fecha_venc <= CURRENT_DATE + INTERVAL '60 days'
              AND l.fecha_venc >= CURRENT_DATE
              AND l.cantidad > 0
            THEN l.cantidad
            ELSE 0
          END
        ) AS stock_por_vencer,

        -- vencidos
        SUM(
          CASE
            WHEN l.fecha_venc IS NOT NULL
              AND l.fecha_venc < CURRENT_DATE
              AND l.cantidad > 0
            THEN l.cantidad
            ELSE 0
          END
        ) AS stock_vencido

      FROM productos p
      LEFT JOIN lotes l ON l.producto_id = p.id

      WHERE p.veterinaria = $1
        AND p.activo = TRUE

      GROUP BY p.id
      ORDER BY p.nombre ASC`,
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
          WHEN fecha_venc IS NULL                               THEN 'sin_vencimiento'
          WHEN fecha_venc < CURRENT_DATE                        THEN 'vencido'
          WHEN fecha_venc <= CURRENT_DATE + INTERVAL '30 days' THEN 'por_vencer'
          ELSE 'ok'
        END AS estado
       FROM lotes
       WHERE producto_id = $1
         AND cantidad > 0        -- ← esto hace que desaparezcan los dados de baja
       ORDER BY fecha_venc ASC NULLS LAST`,
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
  

  const cant = Number(cantidad)

  if (!cant || cant <= 0) {
    return res.status(400).json({ error: 'Cantidad inválida' })
  }

  const fechaFinal =
    !fecha_venc || fecha_venc === '' || fecha_venc === 'null'
      ? null
      : fecha_venc

  try {
    const { rows: [lote] } = await pool.query(
      `INSERT INTO lotes (producto_id, cantidad, fecha_venc, numero_lote)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        producto_id,
        cant,
        fechaFinal,
        numero_lote || null
      ]
    )

    res.status(201).json(lote)

  } catch (err) {
    console.error('Error agregarLote FULL:', err) // 👈 clave
    res.status(500).json({ error: err.message })
  }
}

const darBajaLote = async (req, res) => {
  const { id, lote_id } = req.params
  const { motivo, cantidad } = req.body

  // cantidad es opcional: sin cantidad se da de baja el lote entero (como antes);
  // con cantidad se descuentan solo esas unidades y el resto queda en el lote.
  const sinCantidad = cantidad === undefined || cantidad === null || cantidad === ''
  const cant = sinCantidad ? null : Number(cantidad)

  if (!sinCantidad && (!Number.isFinite(cant) || cant <= 0)) {
    return res.status(400).json({ error: 'Cantidad inválida' })
  }

  try {
    const { rows: [actual] } = await pool.query(
      `SELECT cantidad FROM lotes WHERE id = $1 AND producto_id = $2`,
      [lote_id, id]
    )

    if (!actual)
      return res.status(404).json({ error: 'Lote no encontrado' })

    if (!sinCantidad && cant > Number(actual.cantidad)) {
      return res.status(400).json({ error: `El lote solo tiene ${actual.cantidad} unidades` })
    }

    const { rows: [lote] } = await pool.query(
      `UPDATE lotes
       SET cantidad = CASE WHEN $3::numeric IS NULL THEN 0 ELSE cantidad - $3::numeric END
       WHERE id = $1 AND producto_id = $2
       RETURNING *`,
      [lote_id, id, cant]
    )

    res.json({
      mensaje: sinCantidad
        ? `Lote dado de baja. Motivo: ${motivo || 'manual'}`
        : `Baja de ${cant} unidad(es). Motivo: ${motivo || 'manual'}`,
      lote
    })
  } catch (err) {
    console.error('Error darBajaLote:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// Cambia la fecha de vencimiento de un lote (null = sin vencimiento).
// Si viene `cantidad` menor a la del lote, solo esas unidades pasan a la nueva fecha:
// se descuentan del lote original y se crea un lote nuevo con ellas.
const editarLote = async (req, res) => {
  const { id, lote_id } = req.params
  const { fecha_venc, cantidad } = req.body

  const fecha =
    !fecha_venc || fecha_venc === '' || fecha_venc === 'null' ? null : String(fecha_venc).slice(0, 10)

  if (fecha !== null && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: 'Fecha inválida' })
  }

  const hayCantidad = cantidad !== undefined && cantidad !== null && cantidad !== ''
  const cant = hayCantidad ? Number(cantidad) : null
  if (hayCantidad && (!Number.isFinite(cant) || cant <= 0)) {
    return res.status(400).json({ error: 'Cantidad inválida' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: [actual] } = await client.query(
      `SELECT * FROM lotes WHERE id = $1 AND producto_id = $2 FOR UPDATE`,
      [lote_id, id]
    )
    if (!actual) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Lote no encontrado' })
    }

    let lote
    if (hayCantidad && cant < Number(actual.cantidad)) {
      // separar unidades en un lote nuevo
      await client.query(
        `UPDATE lotes SET cantidad = cantidad - $2 WHERE id = $1`,
        [lote_id, cant]
      )
      ;({ rows: [lote] } = await client.query(
        `INSERT INTO lotes (producto_id, cantidad, fecha_venc, numero_lote)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [id, cant, fecha, actual.numero_lote]
      ))
    } else {
      ;({ rows: [lote] } = await client.query(
        `UPDATE lotes SET fecha_venc = $3
         WHERE id = $1 AND producto_id = $2
         RETURNING *`,
        [lote_id, id, fecha]
      ))
    }

    await client.query('COMMIT')
    res.json(lote)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Error editarLote:', err.message)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
}

const getAlertas = async (req, res) => {
  const dias = parseInt(req.query.dias) || 30
  const veterinaria = req.usuario?.veterinaria || 'donato'

  try {
    const { rows } = await pool.query(
      `SELECT
        p.id, p.nombre, p.codigo, p.categoria, p.stock,
        MIN(l.fecha_venc) FILTER (WHERE l.cantidad > 0) AS proximo_venc,
        SUM(
          CASE WHEN l.fecha_venc <= CURRENT_DATE + ($1 || ' days')::INTERVAL
                    AND l.fecha_venc >= CURRENT_DATE
                    AND l.cantidad > 0
               THEN l.cantidad ELSE 0 END
        ) AS stock_por_vencer,
        SUM(
          CASE WHEN l.fecha_venc < CURRENT_DATE AND l.cantidad > 0
               THEN l.cantidad ELSE 0 END
        ) AS stock_vencido
       FROM productos p
       JOIN lotes l ON l.producto_id = p.id   -- JOIN en vez de LEFT JOIN
       WHERE p.veterinaria = $2
         AND p.activo = TRUE
       GROUP BY p.id, p.nombre, p.codigo, p.categoria, p.stock
       HAVING
         MIN(l.fecha_venc) FILTER (WHERE l.cantidad > 0)
           <= CURRENT_DATE + ($1 || ' days')::INTERVAL
         OR SUM(
              CASE WHEN l.fecha_venc < CURRENT_DATE AND l.cantidad > 0
                   THEN l.cantidad ELSE 0 END
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

const getFaltantes = async (req, res) => {
  const veterinaria = req.usuario?.veterinaria || 'donato'
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.nombre, p.codigo, p.categoria, p.stock, p.stock_minimo, - p.stock AS unidades_faltantes
       FROM productos p
       WHERE p.veterinaria = $1
         AND p.activo = TRUE
         AND p.stock_minimo > 0
         AND p.stock < p.stock_minimo
       ORDER BY unidades_faltantes DESC`,
      [veterinaria]
    )
    res.json(rows)
  } catch (err) {
    console.error('Error getFaltantes:', err.message)
    res.status(500).json({ error: err.message })
  }
}

const actualizarStockMinimo = async (req, res) => {
  const { id } = req.params
  const { stock_minimo } = req.body
  const veterinaria = req.usuario?.veterinaria || 'donato'
  try {
    const { rows: [p] } = await pool.query(
      `UPDATE productos SET stock_minimo = $1
       WHERE id = $2 AND veterinaria = $3 RETURNING *`,
      [parseInt(stock_minimo) || 0, id, veterinaria]
    )
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' })
    res.json(p)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getStock, getLotes, agregarLote, getAlertas, darBajaLote, editarLote, getFaltantes, actualizarStockMinimo }