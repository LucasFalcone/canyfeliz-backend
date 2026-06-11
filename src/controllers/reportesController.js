const pool = require('../db')

// GET /reportes/resumen?desde=&hasta=
const getResumen = async (req, res) => {
  const veterinaria = req.usuario.veterinaria || 'donato'

  const desde =
    req.query.desde ||
    new Date(new Date().setDate(1))
      .toISOString()
      .split('T')[0]

  const hasta =
    req.query.hasta ||
    new Date()
      .toISOString()
      .split('T')[0]

  try {
    const [ventas, productos, medios, porDia] = await Promise.all([

      // Totales generales
      pool.query(
        `SELECT
          COUNT(*)::int          AS cantidad_ventas,
          COALESCE(SUM(total),0) AS total_facturado,
          COALESCE(AVG(total),0) AS ticket_promedio
         FROM ventas
         WHERE fecha::date BETWEEN $1 AND $2
           AND veterinaria = $3`,
        [desde, hasta, veterinaria]
      ),

      // Top 5 productos más vendidos
      pool.query(
        `SELECT
          p.nombre,
          SUM(vi.cantidad)::int             AS unidades,
          SUM(vi.cantidad * vi.precio_unit) AS total
         FROM venta_items vi
         JOIN ventas v
           ON v.id = vi.venta_id
         JOIN productos p
           ON p.id = vi.producto_id
         WHERE v.fecha::date BETWEEN $1 AND $2
           AND v.veterinaria = $3
         GROUP BY p.id, p.nombre
         ORDER BY unidades DESC
         LIMIT 5`,
        [desde, hasta, veterinaria]
      ),

      // Ventas por medio de pago
      pool.query(
        `SELECT
          medio_pago,
          COUNT(*)::int          AS cantidad,
          COALESCE(SUM(total),0) AS total
         FROM ventas
         WHERE fecha::date BETWEEN $1 AND $2
           AND veterinaria = $3
         GROUP BY medio_pago
         ORDER BY total DESC`,
        [desde, hasta, veterinaria]
      ),

      // Ventas por día
      pool.query(
        `SELECT
          fecha::date            AS dia,
          COUNT(*)::int          AS cantidad,
          COALESCE(SUM(total),0) AS total
         FROM ventas
         WHERE fecha::date BETWEEN $1 AND $2
           AND veterinaria = $3
         GROUP BY fecha::date
         ORDER BY dia ASC`,
        [desde, hasta, veterinaria]
      ),
    ])

    res.json({
      resumen: ventas.rows[0],
      productos: productos.rows,
      medios: medios.rows,
      porDia: porDia.rows,
      desde,
      hasta,
    })
  } catch (err) {
    console.error('Error reportes:', err.message)
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getResumen }