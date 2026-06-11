const fs           = require('fs')
const path         = require('path')
const axios        = require('axios')
const xml2js       = require('xml2js')
const { execSync } = require('child_process')
const os           = require('os')

const WSAA_URL = process.env.AFIP_PROD === 'true'
  ? 'https://wsaa.afip.gov.ar/ws/services/LoginCms'
  : 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms'

const TOKEN_FILE = path.join(os.tmpdir(), 'canyfeliz_token.json')

let tokenCache = null

// -------------------------
// Certificados (Railway + Local)
// -------------------------
function getCertPaths() {
  const tmpDir = os.tmpdir()

  // 🔥 PRODUCCIÓN (Railway)
  if (process.env.AFIP_CERT_B64 && process.env.AFIP_KEY_B64) {
    const certPath = path.join(tmpDir, 'afip.crt')
    const keyPath  = path.join(tmpDir, 'afip.key')

    fs.writeFileSync(
      certPath,
      Buffer.from(process.env.AFIP_CERT_B64, 'base64')
    )

    fs.writeFileSync(
      keyPath,
      Buffer.from(process.env.AFIP_KEY_B64, 'base64')
    )

    return { certPath, keyPath }
  }

  // 🧑‍💻 LOCAL (tu PC)
  return {
    certPath: 'C:\\canyfeliz-certs\\canyfeliz.crt',
    keyPath:  'C:\\canyfeliz-certs\\canyfeliz.key',
  }
}

// -------------------------
// Token persistente
// -------------------------
function cargarTokenGuardado() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'))
      if (new Date() < new Date(data.expira)) {
        tokenCache = data
        console.log('Token cargado desde archivo, expira:', data.expira)
      }
    }
  } catch {}
}

cargarTokenGuardado()

// -------------------------
// TRA
// -------------------------
function generarTRA() {
  const ahora = new Date()
  const desde = new Date(ahora.getTime() - 60000)
  const hasta = new Date(ahora.getTime() + 43200000)

  const fmt = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z')
  const uniqueId = Math.floor(Date.now() / 1000).toString()

  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${fmt(desde)}</generationTime>
    <expirationTime>${fmt(hasta)}</expirationTime>
  </header>
  <service>wsfe</service>
</loginTicketRequest>`
}

// -------------------------
// Firmar TRA
// -------------------------
function firmarTRA(tra) {
  const { certPath, keyPath } = getCertPaths()

  const tmpDir  = os.tmpdir()
  const traPath = path.join(tmpDir, 'tra_canyfeliz.xml')
  const cmsPath = path.join(tmpDir, 'tra_canyfeliz.cms')

  fs.writeFileSync(traPath, tra, 'utf8')

  execSync(
    `openssl smime -sign -in "${traPath}" -out "${cmsPath}" ` +
    `-signer "${certPath}" -inkey "${keyPath}" ` +
    `-nodetach -outform PEM`
  )

  const cms = fs.readFileSync(cmsPath, 'utf8')

  try { fs.unlinkSync(traPath) } catch {}
  try { fs.unlinkSync(cmsPath) } catch {}

  return cms
    .replace('-----BEGIN PKCS7-----', '')
    .replace('-----END PKCS7-----', '')
    .replace(/\n/g, '')
    .trim()
}

// -------------------------
// Obtener Token AFIP
// -------------------------
async function obtenerToken() {
  if (tokenCache && new Date() < new Date(tokenCache.expira)) {
    console.log('Usando token en caché')
    return tokenCache
  }

  const tra        = generarTRA()
  const cmsFirmado = firmarTRA(tra)

  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope 
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov.ar">
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${cmsFirmado}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`

  let response
  try {
    response = await axios.post(WSAA_URL, soapEnvelope, {
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction':   'loginCms',
      },
    })
  } catch (axiosErr) {
    const errorData = axiosErr.response?.data || ''
    console.log('WSAA error status:', axiosErr.response?.status)
    console.log('WSAA error data:', errorData)

    if (errorData.includes('alreadyAuthenticated')) {
      console.log('Token ya vigente en AFIP, esperando 2 minutos...')
      await new Promise(r => setTimeout(r, 120000))
      return obtenerToken()
    }

    throw axiosErr
  }

  console.log('WSAA response status:', response.status)

  const parsed = await xml2js.parseStringPromise(response.data, {
    explicitArray: false,
  })

  const loginTicket = parsed['soapenv:Envelope']['soapenv:Body']
    ['loginCmsResponse']['loginCmsReturn']

  const ticketParsed = await xml2js.parseStringPromise(loginTicket, {
    explicitArray: false,
  })

  const credentials = ticketParsed.loginTicketResponse.credentials

  tokenCache = {
    token:  credentials.token,
    sign:   credentials.sign,
    expira: ticketParsed.loginTicketResponse.header.expirationTime,
  }

  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenCache), 'utf8')
    console.log('Token guardado en archivo, expira:', tokenCache.expira)
  } catch {}

  return tokenCache
}

module.exports = { obtenerToken }