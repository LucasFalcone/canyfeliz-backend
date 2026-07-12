const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

// Usamos la SERVICE ROLE KEY (no la anon key) porque este cliente corre
// del lado del servidor y necesita poder subir/borrar archivos sin
// depender de las políticas RLS de un usuario autenticado.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

module.exports = supabase