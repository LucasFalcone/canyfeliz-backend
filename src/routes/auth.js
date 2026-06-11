const router = require('express').Router()
const { login, me } = require('../controllers/authController')
const { verificarToken } = require('../middlewares/auth')

router.post('/login', login)
router.get('/me',     verificarToken, me)

module.exports = router