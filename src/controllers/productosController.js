const pool = require('../db')
const path = require('path')
const fs = require('fs')

const CATEGORIAS = [
  'balanceado',
  'farmacia',
  'sanitarios',
  'accesorios',
  'consultorio',
  'cirugias_y_especialidades',
]

// GET /productos?q=...&categoria=...
const buscarProductos = async (req, res) => {
  const {
    q,
    categoria,
    subcategoria,
    etiqueta,
  } = req.query

  const veterinaria = req.usuario.veterinaria || 'donato'

  try {
    let query = `
      SELECT *
      FROM productos
      WHERE activo = TRUE
        AND veterinaria = $1
    `

    const params = [veterinaria]

    if (categoria && categoria !== 'todas') {
      params.push(categoria)

      query += `
        AND categoria = $${params.length}
      `
    }

    if (subcategoria && subcategoria !== '') {
      params.push(subcategoria)

      query += `
        AND subcategoria = $${params.length}
      `
    }

    if (etiqueta && etiqueta !== '') {
      params.push(etiqueta)

      query += `
        AND etiqueta = $${params.length}
      `
    }

    if (q && q.trim()) {
      params.push(
        q.trim(),
        `%${q.trim()}%`
      )

      query += `
        AND (
          codigo = $${params.length - 1}
          OR nombre ILIKE $${params.length}
        )
      `
    }

    query += `
      ORDER BY nombre
      LIMIT 50
    `

    const { rows } = await pool.query(query, params)

    res.json(rows)

  } catch (err) {
    console.error('Error buscarProductos:', err.message)

    res.status(500).json({
      error: err.message,
    })
  }
}

// GET /productos/todos
const listarProductos = async (req, res) => {
  const veterinaria = req.usuario.veterinaria || 'donato'

  try {
    const { rows } = await pool.query(
      `
      SELECT
        p.*,
        COALESCE(
          SUM(l.cantidad) FILTER (
            WHERE l.fecha_venc >= CURRENT_DATE
          ),
          0
        ) AS stock_real
      FROM productos p
      LEFT JOIN lotes l
        ON l.producto_id = p.id
      WHERE p.veterinaria = $1
      GROUP BY p.id
      ORDER BY p.categoria ASC, p.nombre ASC
      `,
      [veterinaria]
    )

    res.json(rows)

  } catch (err) {
    console.error('Error listarProductos:', err.message)

    res.status(500).json({
      error: err.message,
    })
  }
}

// POST /productos
const crearProducto = async (req, res) => {
  const {
    nombre,
    precio,
    codigo,
    stock,
    categoria,
    precio_costo,
    margen,
    subcategoria,
    etiqueta,
    droga,
    precio_efectivo,
    edad,
    mordida,
  } = req.body

  const veterinaria = req.usuario.veterinaria || 'donato'

  if (!nombre || !precio) {
    return res.status(400).json({
      error: 'Nombre y precio son requeridos',
    })
  }

  try {
    const esServicio = [
      'consultorio',
      'cirugias_y_especialidades',
    ].includes(categoria)

    const {
      rows: [producto],
    } = await pool.query(
      `
      INSERT INTO productos
(
  nombre,
  precio,
  codigo,
  stock,
  categoria,
  es_servicio,
  precio_costo,
  margen,
  subcategoria,
  etiqueta,
  droga,
  precio_efectivo,
  edad,
  veterinaria,
  mordida
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
RETURNING *
      `,
      [
        nombre.trim(),
        precio,
        codigo?.trim() || null,
        esServicio ? 0 : (stock || 0),
        categoria || 'sin_categoria',
        esServicio,
        precio_costo || 0,
        margen || 0,
        subcategoria || null,
        etiqueta || null,
        droga || null,
        precio_efectivo || null,
        edad || null,
        veterinaria,
        mordida || null,
      ]
    )

    res.status(201).json(producto)

  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({
        error: 'Ya existe un producto con ese código',
      })
    }

    console.error(
      'Error crearProducto:',
      err.message
    )

    res.status(500).json({
      error: err.message,
    })
  }
}

// PUT /productos/:id
const actualizarProducto = async (req, res) => {
  const { id } = req.params

  const {
    nombre,
    precio,
    codigo,
    categoria,
    precio_costo,
    margen,
    subcategoria,
    etiqueta,
    droga,
    precio_efectivo,
    edad,
    mordida,
  } = req.body

  if (!nombre || !precio) {
    return res.status(400).json({
      error: 'Nombre y precio son requeridos',
    })
  }

  try {
    const esServicio = [
      'consultorio',
      'cirugias_y_especialidades',
    ].includes(categoria)

    const {
      rows: [producto],
    } = await pool.query(
      `
      UPDATE productos
      SET
        nombre          = $1,
        precio          = $2,
        codigo          = $3,
        categoria       = $4,
        es_servicio     = $5,
        precio_costo    = $6,
        margen          = $7,
        subcategoria    = $8,
        etiqueta        = $9,
        droga           = $10,
        precio_efectivo = $11,
        edad            = $12,
        mordida         = $13
      WHERE id = $14
      RETURNING *
      `,
      [
        nombre.trim(),
        precio,
        codigo?.trim() || null,
        categoria || 'sin_categoria',
        esServicio,
        precio_costo || 0,
        margen || 0,
        subcategoria || null,
        etiqueta || null,
        droga || null,
        precio_efectivo || null,
        edad || null,
        mordida || null,
        id,
      ]
    )

    if (!producto) {
      return res.status(404).json({
        error: 'Producto no encontrado',
      })
    }

    res.json(producto)

  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({
        error: 'Ya existe un producto con ese código',
      })
    }

    console.error(
      'Error actualizarProducto:',
      err.message
    )

    res.status(500).json({
      error: err.message,
    })
  }
}

// DELETE /productos/:id
const eliminarProducto = async (req, res) => {
  const { id } = req.params

  try {
    const { rows } = await pool.query(
      `
      SELECT COUNT(*)
      FROM venta_items
      WHERE producto_id = $1
      `,
      [id]
    )

    if (parseInt(rows[0].count) > 0) {
      await pool.query(
        `
        UPDATE productos
        SET activo = FALSE
        WHERE id = $1
        `,
        [id]
      )

      return res.json({
        mensaje: 'Producto desactivado (tiene ventas asociadas)',
      })
    }

    await pool.query(
      `
      DELETE FROM productos
      WHERE id = $1
      `,
      [id]
    )

    res.json({
      mensaje: 'Producto eliminado',
    })

  } catch (err) {
    res.status(500).json({
      error: err.message,
    })
  }
}

// POST /productos/:id/dar-baja-lote/:lote_id
const darBajaLote = async (req, res) => {
  const { lote_id } = req.params
  const { motivo } = req.body

  try {
    const {
      rows: [lote],
    } = await pool.query(
      `
      UPDATE lotes
      SET cantidad = 0
      WHERE id = $1
      RETURNING *
      `,
      [lote_id]
    )

    if (!lote) {
      return res.status(404).json({
        error: 'Lote no encontrado',
      })
    }

    res.json({
      mensaje: `Lote dado de baja. Motivo: ${motivo || 'vencimiento'}`,
      lote,
    })

  } catch (err) {
    console.error(
      'Error darBajaLote:',
      err.message
    )

    res.status(500).json({
      error: err.message,
    })
  }
}

// POST /productos/:id/imagen
const subirImagen = async (req, res) => {
  const { id } = req.params

  if (!req.file) {
    return res.status(400).json({
      error: 'No se recibió ninguna imagen',
    })
  }

  const imagen_url = `/uploads/productos/${req.file.filename}`

  try {
    const {
      rows: [prod],
    } = await pool.query(
      `
      SELECT imagen_url
      FROM productos
      WHERE id = $1
      `,
      [id]
    )

    if (prod?.imagen_url) {
      const oldPath = path.join(
        __dirname,
        '../..',
        prod.imagen_url
      )

      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath)
      }
    }

    const {
      rows: [producto],
    } = await pool.query(
      `
      UPDATE productos
      SET imagen_url = $1
      WHERE id = $2
      RETURNING *
      `,
      [imagen_url, id]
    )

    res.json(producto)

  } catch (err) {
    res.status(500).json({
      error: err.message,
    })
  }
}

// DELETE /productos/:id/imagen
const eliminarImagen = async (req, res) => {
  const { id } = req.params

  try {
    const {
      rows: [prod],
    } = await pool.query(
      `
      SELECT imagen_url
      FROM productos
      WHERE id = $1
      `,
      [id]
    )

    if (prod?.imagen_url) {
      const filePath = path.join(
        __dirname,
        '../..',
        prod.imagen_url
      )

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }

    await pool.query(
      `
      UPDATE productos
      SET imagen_url = NULL
      WHERE id = $1
      `,
      [id]
    )

    res.json({
      mensaje: 'Imagen eliminada',
    })

  } catch (err) {
    res.status(500).json({
      error: err.message,
    })
  }
}

module.exports = {
  buscarProductos,
  listarProductos,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  darBajaLote,
  subirImagen,
  eliminarImagen,
}