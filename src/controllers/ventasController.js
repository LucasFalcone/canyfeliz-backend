const pool = require('../db')

const crearVenta = async (req, res) => {
  const {
    items,
    medio_pago = 'efectivo',
    pagos = null,
    cliente_id = null,
    descuento = 0,
    promocion_id = null,
  } = req.body

  const veterinaria = req.usuario?.veterinaria || 'donato'
  if (!items || items.length === 0)
    return res.status(400).json({ error: 'La venta debe tener al menos un item' })

  const subtotal = items.reduce(
    (acc, i) => acc + i.cantidad * i.precio_unit,
    0
  )

  const total = Math.max(0, subtotal - descuento)
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Determinar medio_pago principal para compatibilidad
    const medioPrincipal = pagos?.length > 1
      ? 'mixto'
      : pagos?.[0]?.medio_pago || medio_pago

    const { rows: [venta] } = await client.query(
      `INSERT INTO ventas
     (total, medio_pago, cliente_id, descuento, promocion_id, veterinaria)
   VALUES ($1, $2, $3, $4, $5, $6)
   RETURNING *`,
      [
        total,
        medioPrincipal,
        cliente_id,
        descuento,
        promocion_id,
        veterinaria,
      ]
    )

    const totalFinal = Math.max(0, total - descuento)

    const pagosAGuardar = pagos?.length
      ? pagos
      : [{ medio_pago, monto: totalFinal }]

    for (const pago of pagosAGuardar) {
      await client.query(
        `INSERT INTO venta_pagos (venta_id, medio_pago, monto)
         VALUES ($1, $2, $3)`,
        [venta.id, pago.medio_pago, pago.monto]
      )
    }

    const itemsConLotes = []

    for (const item of items) {
      const { producto_id, cantidad, precio_unit } = item

      const { rows: [prod] } = await client.query(
        'SELECT es_servicio FROM productos WHERE id = $1', [producto_id]
      )

      if (prod?.es_servicio) {
        await client.query(
          `INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unit)
           VALUES ($1, $2, $3, $4)`,
          [venta.id, producto_id, cantidad, precio_unit]
        )
        itemsConLotes.push({ producto_id, cantidad, precio_unit, lotes: [] })
        continue
      }

      let restante = cantidad
      const { rows: lotes } = await client.query(
        `SELECT id, cantidad, fecha_venc, numero_lote
         FROM lotes
         WHERE producto_id = $1
           AND cantidad > 0
           AND fecha_venc >= CURRENT_DATE
         ORDER BY fecha_venc ASC
         FOR UPDATE`,
        [producto_id]
      )

      const stockTotal = lotes.reduce((a, l) => a + l.cantidad, 0)
      if (stockTotal < cantidad) {
        throw new Error(
          `Stock insuficiente para producto ${producto_id}. ` +
          `Disponible: ${stockTotal}, solicitado: ${cantidad}`
        )
      }

      const lotesUsados = []
      for (const lote of lotes) {
        if (restante <= 0) break
        const aDescontar = Math.min(lote.cantidad, restante)
        await client.query(
          'UPDATE lotes SET cantidad = cantidad - $1 WHERE id = $2',
          [aDescontar, lote.id]
        )
        lotesUsados.push({
          lote_id: lote.id, numero_lote: lote.numero_lote,
          fecha_venc: lote.fecha_venc, cantidad: aDescontar
        })
        restante -= aDescontar
      }

      await client.query(
        `INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unit)
         VALUES ($1, $2, $3, $4)`,
        [venta.id, producto_id, cantidad, precio_unit]
      )
      itemsConLotes.push({ producto_id, cantidad, precio_unit, lotes: lotesUsados })
    }

    await client.query('COMMIT')
    res.status(201).json({ venta, items: itemsConLotes, pagos: pagosAGuardar })

  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Error al crear venta:', err)
    res.status(400).json({ error: err.message || 'Error al procesar la venta' })
  } finally {
    client.release()
  }
}

const obtenerVentas = async (req, res) => {
  const veterinaria = req.usuario.veterinaria || 'donato'

  try {
    const { rows } = await pool.query(
      `SELECT v.*,
        f.id AS factura_id,
        f.cae AS factura_cae,
        f.estado AS factura_estado,
        json_agg(
          json_build_object(
            'nombre', p.nombre,
            'cantidad', vi.cantidad,
            'precio_unit', vi.precio_unit
          )
        ) AS items
       FROM ventas v
       LEFT JOIN facturas f
         ON f.venta_id = v.id
        AND f.estado = 'autorizada'
       JOIN venta_items vi
         ON vi.venta_id = v.id
       JOIN productos p
         ON p.id = vi.producto_id
       WHERE v.veterinaria = $1
       GROUP BY v.id, f.id
       ORDER BY v.fecha DESC
       LIMIT 100`,
      [veterinaria]
    )

    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
module.exports = { crearVenta, obtenerVentas }