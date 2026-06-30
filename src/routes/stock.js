const router = require('express').Router()
const { getStock, getLotes, agregarLote, getAlertas, darBajaLote, getFaltantes, actualizarStockMinimo } = require('../controllers/stockController')
const { verificarToken, soloAdmin } = require('../middlewares/auth')


router.get('/', verificarToken, getStock)
router.get('/alertas', verificarToken, getAlertas)
router.get('/faltantes', verificarToken, getFaltantes)

router.get('/:id/lotes', verificarToken, getLotes)
router.post('/:id/lotes', verificarToken, soloAdmin, agregarLote)
router.post('/:id/lotes/:lote_id/baja', verificarToken, soloAdmin, darBajaLote)

router.put('/:id/stock-minimo', verificarToken, soloAdmin, actualizarStockMinimo)

module.exports = router