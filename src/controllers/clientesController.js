const pool = require('../db')

// GET /clientes?q=...
const buscarClientes = async (req, res) => {
  const { q } = req.query
  try {
    let result
    if (!q || !q.trim()) {
      result = await pool.query(
        `SELECT c.*, COUNT(m.id)::int AS cantidad_mascotas
         FROM clientes c
         LEFT JOIN mascotas m ON m.cliente_id = c.id AND m.activo = TRUE
         WHERE c.activo = TRUE
         GROUP BY c.id
         ORDER BY c.nombre ASC
         LIMIT 50`
      )
    } else {
      result = await pool.query(
        `SELECT c.*, COUNT(m.id)::int AS cantidad_mascotas
         FROM clientes c
         LEFT JOIN mascotas m ON m.cliente_id = c.id AND m.activo = TRUE
         WHERE c.activo = TRUE
           AND (c.nombre ILIKE $1 OR c.dni = $2 OR c.telefono ILIKE $1)
         GROUP BY c.id
         ORDER BY c.nombre ASC
         LIMIT 20`,
        [`%${q.trim()}%`, q.trim()]
      )
    }
    res.json(result.rows)
  } catch (err) {
    console.error('Error buscarClientes:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// GET /clientes/:id
const getCliente = async (req, res) => {
  try {
    const { rows: [cliente] } = await pool.query(
      'SELECT * FROM clientes WHERE id = $1', [req.params.id]
    )
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' })

    const { rows: mascotas } = await pool.query(
      'SELECT * FROM mascotas WHERE cliente_id = $1 AND activo = TRUE ORDER BY nombre',
      [req.params.id]
    )

    const { rows: ventas } = await pool.query(
      `SELECT v.id, v.fecha, v.total, v.medio_pago,
        json_agg(json_build_object(
          'nombre', p.nombre, 'cantidad', vi.cantidad, 'precio_unit', vi.precio_unit
        )) AS items
       FROM ventas v
       JOIN venta_items vi ON vi.venta_id = v.id
       JOIN productos p    ON p.id = vi.producto_id
       WHERE v.cliente_id = $1
       GROUP BY v.id
       ORDER BY v.fecha DESC
       LIMIT 20`,
      [req.params.id]
    )

    res.json({ ...cliente, mascotas, ventas })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// POST /clientes
const crearCliente = async (req, res) => {
  const { nombre, telefono, email, dni, direccion, notas } = req.body
  if (!nombre?.trim())
    return res.status(400).json({ error: 'El nombre es requerido' })

  try {
    const { rows: [cliente] } = await pool.query(
      `INSERT INTO clientes (nombre, telefono, email, dni, direccion, notas)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre.trim(), telefono || null, email || null,
       dni || null, direccion || null, notas || null]
    )
    res.status(201).json(cliente)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// PUT /clientes/:id
const actualizarCliente = async (req, res) => {
  const { nombre, telefono, email, dni, direccion, notas } = req.body
  try {
    const { rows: [cliente] } = await pool.query(
      `UPDATE clientes
       SET nombre = $1, telefono = $2, email = $3,
           dni = $4, direccion = $5, notas = $6
       WHERE id = $7 RETURNING *`,
      [nombre.trim(), telefono || null, email || null,
       dni || null, direccion || null, notas || null, req.params.id]
    )
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' })
    res.json(cliente)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// POST /clientes/:id/mascotas
const agregarMascota = async (req, res) => {
  const { nombre, especie, raza, fecha_nac, sexo, peso, color, notas } = req.body
  if (!nombre?.trim())
    return res.status(400).json({ error: 'El nombre es requerido' })

  try {
    const { rows: [mascota] } = await pool.query(
      `INSERT INTO mascotas
         (cliente_id, nombre, especie, raza, fecha_nac, sexo, peso, color, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.params.id, nombre.trim(), especie || 'perro', raza || null,
       fecha_nac || null, sexo || null, peso || null,
       color || null, notas || null]
    )
    res.status(201).json(mascota)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// PUT /clientes/:id/mascotas/:mascota_id
const actualizarMascota = async (req, res) => {
  const { nombre, especie, raza, fecha_nac, sexo, peso, color, notas } = req.body
  try {
    const { rows: [mascota] } = await pool.query(
      `UPDATE mascotas
       SET nombre=$1, especie=$2, raza=$3, fecha_nac=$4,
           sexo=$5, peso=$6, color=$7, notas=$8
       WHERE id=$9 AND cliente_id=$10 RETURNING *`,
      [nombre.trim(), especie, raza || null, fecha_nac || null,
       sexo || null, peso || null, color || null, notas || null,
       req.params.mascota_id, req.params.id]
    )
    if (!mascota) return res.status(404).json({ error: 'Mascota no encontrada' })
    res.json(mascota)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  buscarClientes, getCliente, crearCliente,
  actualizarCliente, agregarMascota, actualizarMascota,
}