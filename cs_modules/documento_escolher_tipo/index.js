/* global ModuleInit, EscolherDocumentoComModelo, currentBrowser */
const BaseName = 'documento_escolher_tipo'
const CliqueProtocolistaContextKey = 'cliqueProtocolistaContexto'

function normalizarTextoDocumento (value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function lerContextoCliqueProtocolista () {
  return new Promise((resolve, reject) => {
    const result = currentBrowser.storage.local.get(
      CliqueProtocolistaContextKey,
      (items) => {
        const lastError = currentBrowser.runtime?.lastError
        if (lastError) reject(lastError)
        else resolve(items[CliqueProtocolistaContextKey])
      }
    )
    if (result && typeof result.then === 'function') {
      result.then(items => resolve(items[CliqueProtocolistaContextKey]), reject)
    }
  })
}

function extrairUrlSeguraDocumento (element) {
  const href = element.getAttribute('href') || element.getAttribute('data-url') || ''
  if (href && !href.toLowerCase().startsWith('javascript:')) {
    try {
      return new URL(href, window.location.href).href
    } catch (error) {
      return ''
    }
  }

  const source = [href, element.getAttribute('onclick')].filter(Boolean).join(' ')
  const match = source.match(/(?:https?:\/\/[^'"\s]+|controlador\.php\?[^'"\s)]+)/i)
  if (!match) return ''

  try {
    return new URL(match[0].replace(/&amp;/g, '&'), window.location.href).href
  } catch (error) {
    return ''
  }
}

async function selecionarDocumentoExternoPresencial () {
  const contexto = await lerContextoCliqueProtocolista()
  if (
    !contexto ||
    !contexto.documentoPresencialPendente ||
    contexto.modalidade !== 'presencial' ||
    Date.now() > contexto.expiresAt
  ) return false

  const externo = Array.from(document.querySelectorAll(
    'a, button, [role="button"], [data-url], [onclick]'
  )).find(element => normalizarTextoDocumento(element.textContent) === 'externo')
  if (!externo) return false

  const safeUrl = extrairUrlSeguraDocumento(externo)
  if (safeUrl) {
    window.location.assign(safeUrl)
    return true
  }

  externo.style.outline = '3px solid #e0ae28'
  externo.title = 'Selecione Externo para continuar o requerimento presencial'
  return false
}

ModuleInit(BaseName).then(async (options) => {
  if (await selecionarDocumentoExternoPresencial()) return
  if (options.usardocumentocomomodelo) {
    EscolherDocumentoComModelo(BaseName)
  }
}).catch(e => console.log(e.message))
