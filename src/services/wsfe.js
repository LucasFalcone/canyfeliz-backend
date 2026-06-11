const axios  = require('axios')
const xml2js = require('xml2js')
const { obtenerToken } = require('./wsaa')

const WSFE_URL = process.env.AFIP_PROD === 'true'
  ? 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
  : 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx'

const CUIT = process.env.AFIP_CUIT

async function soapRequest(action, body) {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Header/><soapenv:Body>${body}</soapenv:Body></soapenv:Envelope>`

  // ← AGREGÁ ESTO
  console.log(`\n=== WSFE REQUEST [${action}] ===`)
  console.log(envelope)
  console.log('=== FIN REQUEST ===\n')

  const response = await axios.post(WSFE_URL, envelope, {
    headers: {
      'Content-Type': 'text/xml;charset=UTF-8',
      'SOAPAction':   `http://ar.gov.afip.dif.FEV1/${action}`,
    },
  })
  console.log(`WSFE [${action}] status:`, response.status)
  console.log(`WSFE [${action}] data:`, response.data)
  return xml2js.parseStringPromise(response.data, { explicitArray: false })
}

async function getUltimoComprobante(puntoVenta, tipoCbte) {
  const { token, sign } = await obtenerToken()

  const body = `<ar:FECompUltimoAutorizado xmlns:ar="http://ar.gov.afip.dif.FEV1/"><ar:Auth><ar:Token>${token}</ar:Token><ar:Sign>${sign}</ar:Sign><ar:Cuit>${CUIT}</ar:Cuit></ar:Auth><ar:PtoVta>${puntoVenta}</ar:PtoVta><ar:CbteTipo>${tipoCbte}</ar:CbteTipo></ar:FECompUltimoAutorizado>`

  const result = await soapRequest('FECompUltimoAutorizado', body)

  const envelope = result['soap:Envelope'] || result['soapenv:Envelope']
  const body2    = envelope['soap:Body']   || envelope['soapenv:Body']
  const resp     = body2['FECompUltimoAutorizadoResponse']['FECompUltimoAutorizadoResult']

  if (resp.Errors) throw new Error(resp.Errors.Err.Msg)
  return parseInt(resp.CbteNro)
}

async function autorizarComprobante({
  tipoCbte,
  puntoVenta = 1,
  importeTotal,
  importeNeto,
  importeIVA,
  alicuotaIVA,
  docTipo = 99,
  docNro  = 0,
  concepto = 1,
}) {
  const { token, sign } = await obtenerToken()
  const ultimoNro = await getUltimoComprobante(puntoVenta, tipoCbte)
  const nroCbte   = ultimoNro + 1
  const fecha     = new Date().toISOString().split('T')[0].replace(/-/g, '')

  const body = `<ar:FECAESolicitar xmlns:ar="http://ar.gov.afip.dif.FEV1/"><ar:Auth><ar:Token>${token}</ar:Token><ar:Sign>${sign}</ar:Sign><ar:Cuit>${CUIT}</ar:Cuit></ar:Auth><ar:FeCAEReq><ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>${puntoVenta}</ar:PtoVta><ar:CbteTipo>${tipoCbte}</ar:CbteTipo></ar:FeCabReq><ar:FeDetReq><ar:FECAEDetReq><ar:Concepto>${concepto}</ar:Concepto><ar:DocTipo>${docTipo}</ar:DocTipo><ar:DocNro>${docNro}</ar:DocNro><ar:CbteDesde>${nroCbte}</ar:CbteDesde><ar:CbteHasta>${nroCbte}</ar:CbteHasta><ar:CbteFch>${fecha}</ar:CbteFch><ar:ImpTotal>${importeTotal.toFixed(2)}</ar:ImpTotal><ar:ImpTotConc>0.00</ar:ImpTotConc><ar:ImpNeto>${importeNeto.toFixed(2)}</ar:ImpNeto><ar:ImpOpEx>0.00</ar:ImpOpEx><ar:ImpIVA>${importeIVA.toFixed(2)}</ar:ImpIVA><ar:ImpTrib>0.00</ar:ImpTrib><ar:MonId>PES</ar:MonId><ar:MonCotiz>1</ar:MonCotiz><ar:Iva><ar:AlicIva><ar:Id>${alicuotaIVA}</ar:Id><ar:BaseImp>${importeNeto.toFixed(2)}</ar:BaseImp><ar:Importe>${importeIVA.toFixed(2)}</ar:Importe></ar:AlicIva></ar:Iva></ar:FECAEDetReq></ar:FeDetReq></ar:FeCAEReq></ar:FECAESolicitar>`

  const result = await soapRequest('FECAESolicitar', body)

  const envelope = result['soap:Envelope'] || result['soapenv:Envelope']
  const body2    = envelope['soap:Body']   || envelope['soapenv:Body']
  const respRoot = body2['FECAESolicitarResponse']['FECAESolicitarResult']

  if (respRoot.Errors) {
    const err = respRoot.Errors.Err
    const msg = Array.isArray(err) ? err.map(e => e.Msg).join(', ') : err.Msg
    throw new Error(`AFIP error: ${msg}`)
  }

  const detalle = respRoot.FeDetResp?.FECAEDetResp
  if (!detalle) throw new Error('AFIP no devolvió detalle de comprobante')

  if (detalle.Resultado === 'R') {
    const obs = detalle.Observaciones?.Obs
    const msg = Array.isArray(obs) ? obs.map(o => o.Msg).join(', ') : obs?.Msg
    throw new Error(`AFIP rechazó el comprobante: ${msg}`)
  }

  return {
    cae:        detalle.CAE,
    caeVto:     detalle.CAEFchVto,
    nroCbte,
    tipoCbte,
    puntoVenta,
  }
}

module.exports = { autorizarComprobante, getUltimoComprobante }