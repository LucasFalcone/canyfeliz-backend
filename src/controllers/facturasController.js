const pool = require('../db')
const { autorizarComprobante } = require('../services/wsfe')

// Calcular IVA según tipo de factura
function calcularMontos(total, tipoCbte) {
  if (tipoCbte === 6 || tipoCbte === 11) {
    // Factura B o C — el total ya incluye IVA 21%
    const neto = total / 1.21
    const iva  = total - neto
    return { importeNeto: neto, importeIVA: iva, alicuotaIVA: 5 } // 5 = 21%
  }
  // Factura A — el total es neto, se suma IVA
  const iva = total * 0.21
  return { importeNeto: total, importeIVA: iva, alicuotaIVA: 5 }
}

// POST /facturas — emitir factura para una venta
const emitirFactura = async (req, res) => {
  const {
    venta_id,
    tipo_cbte = 6,   // 6=B por defecto
    punto_venta = 4,
    doc_tipo = 99,   // 99=consumidor final
    doc_nro  = 0,
    concepto = 1,
  } = req.body

  try {
    // Verificar que la venta existe y no tiene factura
    const { rows: [venta] } = await pool.query(
      'SELECT * FROM ventas WHERE id = $1', [venta_id]
    )
    if (!venta)
      return res.status(404).json({ error: 'Venta no encontrada' })

    const { rows: factExist } = await pool.query(
      `SELECT id FROM facturas 
       WHERE venta_id = $1 AND estado = 'autorizada'`,
      [venta_id]
    )
    if (factExist.length > 0)
      return res.status(400).json({ error: 'Esta venta ya tiene factura autorizada' })

    // Insertar factura en estado pendiente
    const { rows: [factura] } = await pool.query(
      `INSERT INTO facturas (venta_id, tipo_cbte, nro_cbte, punto_venta, total, estado)
       VALUES ($1, $2, 0, $3, $4, 'pendiente') RETURNING *`,
      [venta_id, tipo_cbte, punto_venta, venta.total]
    )

    // Calcular montos
    const { importeNeto, importeIVA, alicuotaIVA } =
      calcularMontos(Number(venta.total), tipo_cbte)

    // Llamar a AFIP
    const resultado = await autorizarComprobante({
      tipoCbte:    tipo_cbte,
      puntoVenta:  punto_venta,
      importeTotal: Number(venta.total),
      importeNeto,
      importeIVA,
      alicuotaIVA,
      docTipo:   doc_tipo,
      docNro:    doc_nro,
      concepto,
    })

    // Formatear fecha vencimiento CAE
    const caeVto = resultado.caeVto
      ? `${resultado.caeVto.slice(0,4)}-${resultado.caeVto.slice(4,6)}-${resultado.caeVto.slice(6,8)}`
      : null

    // Actualizar factura con CAE
    const { rows: [facturaFinal] } = await pool.query(
      `UPDATE facturas
       SET cae = $1, cae_vto = $2, nro_cbte = $3, estado = 'autorizada',
           datos_json = $4
       WHERE id = $5 RETURNING *`,
      [
        resultado.cae,
        caeVto,
        resultado.nroCbte,
        JSON.stringify(resultado),
        factura.id,
      ]
    )

    res.status(201).json(facturaFinal)

  } catch (err) {
    console.error('Error emitir factura:', err.message)
    console.error('Error stack:', err.stack)
    // Guardar el error en la factura
    await pool.query(
      `UPDATE facturas SET estado = 'error', error_msg = $1
       WHERE venta_id = $2 AND estado = 'pendiente'`,
      [err.message, venta_id]
    ).catch(() => {})

    res.status(500).json({ error: err.message })
  }
}

// GET /facturas — listar facturas
const listarFacturas = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT f.*, v.medio_pago
       FROM facturas f
       JOIN ventas v ON v.id = f.venta_id
       ORDER BY f.fecha DESC
       LIMIT 100`
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// GET /facturas/:id — detalle de una factura
const getFactura = async (req, res) => {
  try {
    const { rows: [factura] } = await pool.query(
      `SELECT f.*, 
        v.medio_pago, v.fecha AS fecha_venta,
        json_agg(json_build_object(
          'nombre',      p.nombre,
          'cantidad',    vi.cantidad,
          'precio_unit', vi.precio_unit
        )) AS items
       FROM facturas f
       JOIN ventas v      ON v.id = f.venta_id
       JOIN venta_items vi ON vi.venta_id = v.id
       JOIN productos p   ON p.id = vi.producto_id
       WHERE f.id = $1
       GROUP BY f.id, v.medio_pago, v.fecha`,
      [req.params.id]
    )
    if (!factura)
      return res.status(404).json({ error: 'Factura no encontrada' })
    res.json(factura)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { emitirFactura, listarFacturas, getFactura }