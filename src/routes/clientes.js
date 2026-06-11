const router = require('express').Router()
const {
  buscarClientes, getCliente, crearCliente,
  actualizarCliente, agregarMascota, actualizarMascota,
} = require('../controllers/clientesController')
const { verificarToken } = require('../middlewares/auth')

router.get('/',                              verificarToken, buscarClientes)
router.get('/:id',                           verificarToken, getCliente)
router.post('/',                             verificarToken, crearCliente)
router.put('/:id',                           verificarToken, actualizarCliente)
router.post('/:id/mascotas',                 verificarToken, agregarMascota)
router.put('/:id/mascotas/:mascota_id',      verificarToken, actualizarMascota)

module.exports = router