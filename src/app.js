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
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);

const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

console.log('ALLOWED ORIGINS:', allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    console.log('ORIGIN:', origin);

    if (!origin || allowedOrigins.includes(origin)) {
      console.log('CORS OK');
      callback(null, true);
    } else {
      console.log('CORS BLOQUEADO');
      callback(new Error('CORS no permitido'));
    }
  },
  credentials: true,
}));

app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// app.js — rutas SIN /api (el proxy ya lo saca)
app.use('/productos', productosRoutes);
app.use('/ventas', ventasRoutes);
app.use('/auth', authRoutes);
app.use('/stock', stockRoutes);
app.use('/reportes', reportesRoutes);
app.use('/facturas', facturasRoutes);
app.use('/clientes', clientesRoutes);
app.use('/promociones', promocionesRoutes);
app.use('/notas-credito', notasCreditoRoutes);

// Health check
app.get('/', (req, res) => res.json({ status: 'CanyFeliz API corriendo 🐾' }));

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error('ERROR:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

console.log('ENV TEST:', process.env.DB_HOST);
console.log('ENV TEST URL:', process.env.DATABASE_URL);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});