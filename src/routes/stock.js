const router = require('express').Router()
const { getStock, getLotes, agregarLote, getAlertas, darBajaLote } = require('../controllers/stockController')
const { verificarToken, soloAdmin } = require('../middlewares/auth')

router.get('/',              verificarToken,            getStock)
router.get('/alertas',       verificarToken,            getAlertas)
router.get('/:id/lotes',     verificarToken,            getLotes)
router.post('/:id/lotes',    verificarToken, soloAdmin, agregarLote)
router.post('/:id/lotes/:lote_id/baja', verificarToken, soloAdmin, darBajaLote)

module.exports = router