if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const path = require('path');

const productosRoutes = require('./routes/productos');
const ventasRoutes = require('./routes/ventas');
const authRoutes = require('./routes/auth');
const stockRoutes = require('./routes/stock');
const reportesRoutes = require('./routes/reportes');
const facturasRoutes = require('./routes/facturas');
const clientesRoutes = require('./routes/clientes');
const promocionesRoutes = require('./routes/promociones');
const notasCreditoRoutes = require('./routes/notasCredito');

const app = express();
const PORT = process.env.PORT || 3001;

console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'CONFIGURADA' : 'NO CONFIGURADA');

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health checks
app.get('/', (req, res) => {
  console.log('GET /');
  res.status(200).json({
    status: 'CanyFeliz API corriendo 🐾'
  });
});

app.get('/ping', (req, res) => {
  console.log('GET /ping');
  res.status(200).send('pong');
});

// Rutas
app.use('/productos', productosRoutes);
app.use('/ventas', ventasRoutes);
app.use('/auth', authRoutes);
app.use('/stock', stockRoutes);
app.use('/reportes', reportesRoutes);
app.use('/facturas', facturasRoutes);
app.use('/clientes', clientesRoutes);
app.use('/promociones', promocionesRoutes);
app.use('/notas-credito', notasCreditoRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('ERROR:', err);
  res.status(500).json({
    error: err.message || 'Error interno del servidor'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});