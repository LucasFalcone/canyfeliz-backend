const express = require('express');
const cors    = require('cors');
require('dotenv').config();
const path = require('path')

const productosRoutes = require('./routes/productos');
const ventasRoutes    = require('./routes/ventas');
const authRoutes = require('./routes/auth')
const stockRoutes = require('./routes/stock')
const reportesRoutes = require('./routes/reportes')
const facturasRoutes = require('./routes/facturas')
const clientesRoutes = require('./routes/clientes')
const promocionesRoutes = require('./routes/promociones')
const notasCreditoRoutes = require('./routes/notasCredito')


const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// app.js — rutas SIN /api (el proxy ya lo saca)
app.use('/productos', productosRoutes);
app.use('/ventas',    ventasRoutes);
app.use('/auth',      authRoutes);
app.use('/stock',     stockRoutes);
app.use('/reportes', reportesRoutes);
app.use('/facturas', facturasRoutes);
app.use('/clientes', clientesRoutes);
app.use('/promociones', promocionesRoutes)
app.use('/notas-credito', notasCreditoRoutes)


// Health check
app.get('/', (req, res) => res.json({ status: 'CanyFeliz API corriendo 🐾' }));

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));