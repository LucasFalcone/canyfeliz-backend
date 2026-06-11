const router = require('express').Router()
const upload = require('../middlewares/upload')
const {
  buscarProductos,
  listarProductos,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  darBajaLote,
  subirImagen,
  eliminarImagen,
} = require('../controllers/productosController')
const { verificarToken, soloAdmin } = require('../middlewares/auth')



router.get('/todos',              verificarToken, soloAdmin, listarProductos)
router.get('/',                   verificarToken,            buscarProductos)
router.post('/',                  verificarToken, soloAdmin, crearProducto)
router.put('/:id',                verificarToken, soloAdmin, actualizarProducto)
router.delete('/:id',             verificarToken, soloAdmin, eliminarProducto)
router.post('/:id/dar-baja-lote/:lote_id', verificarToken, soloAdmin, darBajaLote)
router.post('/:id/imagen',   verificarToken, soloAdmin, upload.single('imagen'), subirImagen)
router.delete('/:id/imagen', verificarToken, soloAdmin, eliminarImagen)

module.exports = router