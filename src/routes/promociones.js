const router = require('express').Router()
const {
  listarPromociones, crearPromocion,
  actualizarPromocion, eliminarPromocion,
} = require('../controllers/promocionesController')
const { verificarToken, soloAdmin } = require('../middlewares/auth')

router.get('/',     verificarToken,            listarPromociones)
router.post('/',    verificarToken, soloAdmin, crearPromocion)
router.put('/:id',  verificarToken, soloAdmin, actualizarPromocion)
router.delete('/:id', verificarToken, soloAdmin, eliminarPromocion)

module.exports = router