const router = require('express').Router()
const { getResumen } = require('../controllers/reportesController')
const { verificarToken, soloAdmin } = require('../middlewares/auth')

router.get('/resumen', verificarToken, soloAdmin, getResumen)

module.exports = router