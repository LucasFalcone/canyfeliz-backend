const pool = require('../db')
const path = require('path')
const supabase = require('../supabase')

// Nombre del bucket de Supabase Storage donde se guardan las fotos de producto.
// Ajustá este valor si en tu proyecto de Supabase el bucket se llama distinto.
const BUCKET = 'productos'

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
      SELECT
        p.*,

        -- Próximo vencimiento válido (igual criterio que en getStock)
        MIN(l.fecha_venc) FILTER (
          WHERE l.cantidad > 0
            AND l.fecha_venc IS NOT NULL
            AND l.fecha_venc >= CURRENT_DATE
        ) AS proximo_venc,

        -- Cantidad que vence dentro de los próximos 60 días
        SUM(
          CASE
            WHEN l.fecha_venc IS NOT NULL
              AND l.fecha_venc <= CURRENT_DATE + INTERVAL '60 days'
              AND l.fecha_venc >= CURRENT_DATE
              AND l.cantidad > 0
            THEN l.cantidad
            ELSE 0
          END
        ) AS stock_por_vencer

      FROM productos p
      LEFT JOIN lotes l ON l.producto_id = p.id
      WHERE p.activo = TRUE
        AND p.veterinaria = $1
    `

    const params = [veterinaria]

    if (categoria && categoria !== 'todas') {
      params.push(categoria)

      query += `
        AND p.categoria = $${params.length}
      `
    }

    if (subcategoria && subcategoria !== '') {
      params.push(subcategoria)

      query += `
        AND p.subcategoria = $${params.length}
      `
    }

    if (etiqueta && etiqueta !== '') {
      params.push(etiqueta)

      query += `
        AND p.etiqueta = $${params.length}
      `
    }

    if (q && q.trim()) {
      params.push(
        q.trim(),
        `%${q.trim()}%`
      )

      query += `
        AND (
          p.codigo = $${params.length - 1}
          OR p.nombre ILIKE $${params.length}
          OR REPLACE(p.subcategoria, '_', ' ') ILIKE $${params.length}
          OR p.etiqueta ILIKE $${params.length}
          OR p.droga ILIKE $${params.length}
        )
      `
    }

    query += `
      GROUP BY p.id
      ORDER BY p.nombre
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

// Extrae el "path" interno del bucket a partir de una URL pública de Supabase Storage.
// Ej: https://xxxx.supabase.co/storage/v1/object/public/productos/producto_5_123.jpg
//     -> producto_5_123.jpg
function pathDesdeUrl(url) {
  if (!url) return null
  const marcador = `/storage/v1/object/public/${BUCKET}/`
  const idx = url.indexOf(marcador)
  if (idx === -1) return null
  return url.slice(idx + marcador.length)
}

// POST /productos/:id/imagen
const subirImagen = async (req, res) => {
  const { id } = req.params

  if (!req.file) {
    return res.status(400).json({
      error: 'No se recibió ninguna imagen',
    })
  }

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

    // Si ya tenía una foto, la borramos de Supabase Storage antes de subir la nueva
    const pathAnterior = pathDesdeUrl(prod?.imagen_url)
    if (pathAnterior) {
      await supabase.storage.from(BUCKET).remove([pathAnterior])
    }

    const ext = path.extname(req.file.originalname) || '.jpg'
    const nombreArchivo = `producto_${id}_${Date.now()}${ext}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(nombreArchivo, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      })

    if (uploadError) {
      return res.status(500).json({
        error: `Error al subir la imagen a Supabase: ${uploadError.message}`,
      })
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(nombreArchivo)

    const {
      rows: [producto],
    } = await pool.query(
      `
      UPDATE productos
      SET imagen_url = $1
      WHERE id = $2
      RETURNING *
      `,
      [publicUrl, id]
    )

    res.json(producto)

  } catch (err) {
    console.error('Error subirImagen:', err.message)

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

    const pathArchivo = pathDesdeUrl(prod?.imagen_url)
    if (pathArchivo) {
      await supabase.storage.from(BUCKET).remove([pathArchivo])
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