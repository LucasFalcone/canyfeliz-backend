const router = require('express').Router()
const { emitirNotaCredito, listarNotasCredito } = require('../controllers/notasCreditoController')
const { verificarToken, soloAdmin } = require('../middlewares/auth')

router.post('/',  verificarToken, soloAdmin, emitirNotaCredito)
router.get('/',   verificarToken, soloAdmin, listarNotasCredito)

module.exports = router