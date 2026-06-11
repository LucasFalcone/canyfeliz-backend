const router              = require('express').Router()
const { crearVenta, obtenerVentas } = require('../controllers/ventasController')
const { verificarToken, soloAdmin } = require('../middlewares/auth')

router.post('/', verificarToken,            crearVenta)
router.get('/',  verificarToken, soloAdmin, obtenerVentas) // solo admin ve historial

module.exports = router