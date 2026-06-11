const router = require('express').Router()
const { emitirFactura, listarFacturas, getFactura } = require('../controllers/facturasController')
const { verificarToken, soloAdmin } = require('../middlewares/auth')

router.post('/',    verificarToken,            emitirFactura)
router.get('/',     verificarToken, soloAdmin, listarFacturas)
router.get('/:id',  verificarToken,            getFactura)

module.exports = router