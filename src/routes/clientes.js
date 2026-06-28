const router = require('express').Router()

const {
  buscarClientes,
  getCliente,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
} = require('../controllers/clientesController')

const { verificarToken } = require('../middlewares/auth')

router.get('/', verificarToken, buscarClientes)
router.get('/:id', verificarToken, getCliente)

router.post('/', verificarToken, crearCliente)

router.put('/:id', verificarToken, actualizarCliente)

router.delete('/:id', verificarToken, eliminarCliente)

module.exports = router