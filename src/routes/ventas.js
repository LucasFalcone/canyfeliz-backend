const router              = require('express').Router()
const { crearVenta, obtenerVentas, eliminarVentas } = require('../controllers/ventasController')
const { verificarToken, soloAdmin } = require('../middlewares/auth')

router.post('/', verificarToken,            crearVenta)
router.get('/',  verificarToken, soloAdmin, obtenerVentas) // solo admin ve historial
router.delete('/', verificarToken, soloAdmin, eliminarVentas)

module.exports = router