const pool = require('../db')

const buscarClientes = async (req, res) => {
  const { q = '' } = req.query
  const veterinaria = req.usuario.veterinaria || 'donato'

  try {
    const { rows } = await pool.query(
      `SELECT *
       FROM clientes
       WHERE veterinaria = $1
         AND (
           razon_social ILIKE $2 OR
           nombre_comercial ILIKE $2 OR
           nro_doc ILIKE $2 OR
           telefono ILIKE $2 OR
           email ILIKE $2
         )
       ORDER BY razon_social ASC
       LIMIT 20`,
      [veterinaria, `%${q.trim()}%`]
    )

    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}

const getCliente = async (req, res) => {
  const veterinaria = req.usuario.veterinaria || 'donato'

  try {
    const { rows } = await pool.query(
      `SELECT *
       FROM clientes
       WHERE id=$1
       AND veterinaria=$2`,
      [req.params.id, veterinaria]
    )

    if (!rows.length)
      return res.status(404).json({ error: 'Cliente no encontrado' })

    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}

const crearCliente = async (req, res) => {
  const {
    tipo_doc,
    nro_doc,
    razon_social,
    nombre_comercial,
    tipo_iva,
    telefono,
    email,
    domicilio,
    pais,
    provincia,
    localidad,
    codigo_postal,
  } = req.body

  const veterinaria = req.usuario.veterinaria || 'donato'

  if (!razon_social?.trim())
    return res.status(400).json({
      error: 'La razón social es obligatoria',
    })

  try {
    const { rows } = await pool.query(
      `INSERT INTO clientes
      (
        tipo_doc,
        nro_doc,
        razon_social,
        nombre_comercial,
        tipo_iva,
        telefono,
        email,
        domicilio,
        pais,
        provincia,
        localidad,
        codigo_postal,
        veterinaria
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [
        tipo_doc || 'dni',
        nro_doc || null,
        razon_social.trim(),
        nombre_comercial || null,
        tipo_iva || 'consumidor_final',
        telefono || null,
        email || null,
        domicilio || null,
        pais || 'Argentina',
        provincia || null,
        localidad || null,
        codigo_postal || null,
        veterinaria,
      ]
    )

    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}

const actualizarCliente = async (req, res) => {
  const veterinaria = req.usuario.veterinaria || 'donato'

  const {
    tipo_doc,
    nro_doc,
    razon_social,
    nombre_comercial,
    tipo_iva,
    telefono,
    email,
    domicilio,
    pais,
    provincia,
    localidad,
    codigo_postal,
  } = req.body

  try {
    const { rows } = await pool.query(
      `UPDATE clientes
       SET
        tipo_doc=$1,
        nro_doc=$2,
        razon_social=$3,
        nombre_comercial=$4,
        tipo_iva=$5,
        telefono=$6,
        email=$7,
        domicilio=$8,
        pais=$9,
        provincia=$10,
        localidad=$11,
        codigo_postal=$12
      WHERE id=$13
      AND veterinaria=$14
      RETURNING *`,
      [
        tipo_doc,
        nro_doc,
        razon_social,
        nombre_comercial,
        tipo_iva,
        telefono,
        email,
        domicilio,
        pais,
        provincia,
        localidad,
        codigo_postal,
        req.params.id,
        veterinaria,
      ]
    )

    if (!rows.length)
      return res.status(404).json({
        error: 'Cliente no encontrado',
      })

    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}

const eliminarCliente = async (req, res) => {
  const veterinaria = req.usuario.veterinaria || 'donato'

  try {
    await pool.query(
      `DELETE FROM clientes
       WHERE id=$1
       AND veterinaria=$2`,
      [req.params.id, veterinaria]
    )

    res.json({
      mensaje: 'Cliente eliminado',
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  buscarClientes,
  getCliente,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
}