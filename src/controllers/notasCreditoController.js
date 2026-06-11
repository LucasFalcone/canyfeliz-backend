const pool = require('../db')
const { autorizarComprobante } = require('../services/wsfe')

// Tipo de NC según tipo de factura original
const tipoNC = { 1: 3, 6: 8, 11: 13 }

const emitirNotaCredito = async (req, res) => {
  const { factura_id, motivo } = req.body

  if (!factura_id)
    return res.status(400).json({ error: 'factura_id requerido' })

  try {
    // Obtener factura original
    const { rows: [factura] } = await pool.query(
      'SELECT * FROM facturas WHERE id = $1', [factura_id]
    )
    if (!factura)
      return res.status(404).json({ error: 'Factura no encontrada' })

    if (factura.estado !== 'autorizada')
      return res.status(400).json({ error: 'Solo se pueden anular facturas autorizadas' })

    // Verificar que no tenga NC ya emitida
    const { rows: ncExist } = await pool.query(
      `SELECT id FROM notas_credito
       WHERE factura_id = $1 AND estado = 'autorizada'`,
      [factura_id]
    )
    if (ncExist.length > 0)
      return res.status(400).json({ error: 'Esta factura ya tiene una nota de crédito' })

    const tipoCbteNC = tipoNC[factura.tipo_cbte]
    if (!tipoCbteNC)
      return res.status(400).json({ error: 'Tipo de factura no soportado para NC' })

    // Insertar NC pendiente
    const { rows: [nc] } = await pool.query(
      `INSERT INTO notas_credito
         (factura_id, venta_id, tipo_cbte, punto_venta, total, motivo)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [factura_id, factura.venta_id, tipoCbteNC,
       factura.punto_venta, factura.total, motivo || 'Anulación']
    )

    // Calcular montos (igual que la factura original)
    const total      = Number(factura.total)
    const importeNeto = total / 1.21
    const importeIVA  = total - importeNeto

    // Llamar a AFIP
    const resultado = await autorizarComprobante({
      tipoCbte:     tipoCbteNC,
      puntoVenta:   factura.punto_venta,
      importeTotal: total,
      importeNeto,
      importeIVA,
      alicuotaIVA:  5,
      docTipo:      99,
      docNro:       0,
      concepto:     1,
    })

    const caeVto = resultado.caeVto
      ? `${resultado.caeVto.slice(0,4)}-${resultado.caeVto.slice(4,6)}-${resultado.caeVto.slice(6,8)}`
      : null

    // Actualizar NC con CAE
    const { rows: [ncFinal] } = await pool.query(
      `UPDATE notas_credito
       SET cae=$1, cae_vto=$2, nro_cbte=$3, estado='autorizada'
       WHERE id=$4 RETURNING *`,
      [resultado.cae, caeVto, resultado.nroCbte, nc.id]
    )

    res.status(201).json(ncFinal)

  } catch (err) {
    await pool.query(
      `UPDATE notas_credito SET estado='error', error_msg=$1
       WHERE factura_id=$2 AND estado='pendiente'`,
      [err.message, factura_id]
    ).catch(() => {})

    console.error('Error NC:', err.message)
    res.status(500).json({ error: err.message })
  }
}

const listarNotasCredito = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT nc.*, f.tipo_cbte AS tipo_fact_orig, f.nro_cbte AS nro_fact_orig
       FROM notas_credito nc
       JOIN facturas f ON f.id = nc.factura_id
       ORDER BY nc.fecha DESC LIMIT 100`
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { emitirNotaCredito, listarNotasCredito }