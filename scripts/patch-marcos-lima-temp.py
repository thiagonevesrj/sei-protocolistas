from pathlib import Path

central_path = Path('central_protocolista/main.js')
central = central_path.read_text(encoding='utf-8')

old = "  const FEEDBACK_KEY = 'centralProtocolistaPendingFeedback'\n  const CATALOG_PATH = '../data/catalogo-processos.json'"
new = """  const FEEDBACK_KEY = 'centralProtocolistaPendingFeedback'
  const SPECIAL_PROTOCOLISTA_EMAILS = {
    'marcos.lima@detran.rj.gov.br': {
      number: 'MARCOS',
      email: 'marcos.lima@detran.rj.gov.br',
      displayName: 'Marcos Lima'
    }
  }
  const CATALOG_PATH = '../data/catalogo-processos.json'"""
assert central.count(old) == 1, 'Ponto de contas especiais não encontrado na Central'
central = central.replace(old, new, 1)

old = """  function extractProtocolista (email) {
    const normalized = clean(email).toLowerCase()
    const match = normalized.match(/^protocolista\\s*(\\d{1,4})@detran\\.rj\\.gov\\.br$/i)
    if (!match) return null

    return {
      number: match[1],
      email: `protocolista${match[1]}@detran.rj.gov.br`
    }
  }"""
new = """  function extractProtocolista (email) {
    const normalized = clean(email).toLowerCase()
    const special = SPECIAL_PROTOCOLISTA_EMAILS[normalized]
    if (special) return { ...special }

    const match = normalized.match(/^protocolista\\s*(\\d{1,4})@detran\\.rj\\.gov\\.br$/i)
    if (!match) return null

    return {
      number: match[1],
      email: `protocolista${match[1]}@detran.rj.gov.br`
    }
  }"""
assert central.count(old) == 1, 'extractProtocolista não encontrado'
central = central.replace(old, new, 1)

old = "<strong>Protocolista ${operator.number} ${isValidated ? 'validado' : 'configurado'}</strong>"
new = "<strong>Protocolista ${operator.displayName || operator.number} ${isValidated ? 'validado' : 'configurado'}</strong>"
assert central.count(old) == 1, 'renderOperator não encontrado'
central = central.replace(old, new, 1)

old = 'Use o e-mail institucional no padrão protocolistaN@detran.rj.gov.br.'
new = 'Use uma conta institucional autorizada para o SEI Protocolistas.'
assert central.count(old) == 1, 'Mensagem de validação não encontrada'
central = central.replace(old, new, 1)
central_path.write_text(central, encoding='utf-8')

fast_path = Path('cs_modules/fast_mail/index.js')
fast = fast_path.read_text(encoding='utf-8')

old = "  const FEEDBACK_KEY = 'centralProtocolistaPendingFeedback'\n  const FEEDBACK_COMPOSE_URL = 'https://venus2.detran.rj.gov.br/owa/?ae=Item&a=New&t=IPM.Note'"
new = """  const FEEDBACK_KEY = 'centralProtocolistaPendingFeedback'
  const SPECIAL_PROTOCOLISTA_EMAILS = {
    'marcos.lima@detran.rj.gov.br': {
      number: 'MARCOS',
      email: 'marcos.lima@detran.rj.gov.br',
      displayName: 'Marcos Lima'
    }
  }
  const FEEDBACK_COMPOSE_URL = 'https://venus2.detran.rj.gov.br/owa/?ae=Item&a=New&t=IPM.Note'"""
assert fast.count(old) == 1, 'Ponto de contas especiais não encontrado no FAST MAIL'
fast = fast.replace(old, new, 1)

old = """  function findOperator () {
    const text = textFromDocuments()
    const accountMatch = text.match(/protocolista\\s*(\\d{1,4})@detran\\.rj\\.gov\\.br/i)
    const labelMatch = text.match(/\\bProtocolista\\s+(\\d{1,4})\\b/i)
    const number = accountMatch?.[1] || labelMatch?.[1] || ''

    if (!number) return null

    return {
      number,
      email: `protocolista${number}@detran.rj.gov.br`,
      source: accountMatch ? 'conta-webmail' : 'rotulo-webmail',
      validatedAt: Date.now()
    }
  }"""
new = """  function findOperator () {
    const text = textFromDocuments()
    const normalizedText = text.toLowerCase()
    const specialEmail = Object.keys(SPECIAL_PROTOCOLISTA_EMAILS)
      .find((email) => normalizedText.includes(email))

    if (specialEmail) {
      return {
        ...SPECIAL_PROTOCOLISTA_EMAILS[specialEmail],
        source: 'conta-webmail',
        validatedAt: Date.now()
      }
    }

    const accountMatch = text.match(/protocolista\\s*(\\d{1,4})@detran\\.rj\\.gov\\.br/i)
    const labelMatch = text.match(/\\bProtocolista\\s+(\\d{1,4})\\b/i)
    const number = accountMatch?.[1] || labelMatch?.[1] || ''

    if (!number) return null

    return {
      number,
      email: `protocolista${number}@detran.rj.gov.br`,
      source: accountMatch ? 'conta-webmail' : 'rotulo-webmail',
      validatedAt: Date.now()
    }
  }"""
assert fast.count(old) == 1, 'findOperator não encontrado'
fast = fast.replace(old, new, 1)

old = """  function validStoredOperator (value) {
    const number = cleanValue(value?.number)
    const email = normalizeEmail(value?.email)
    const expectedEmail = number
      ? `protocolista${number}@detran.rj.gov.br`
      : ''

    if (
      !/^\\d{1,4}$/.test(number) ||
      email !== expectedEmail
    ) {
      return null
    }

    return {
      ...value,
      number,
      email: expectedEmail,
      source: value.source || 'central-config'
    }
  }"""
new = """  function validStoredOperator (value) {
    const number = cleanValue(value?.number)
    const email = normalizeEmail(value?.email)
    const special = SPECIAL_PROTOCOLISTA_EMAILS[email]

    if (special) {
      return {
        ...value,
        ...special,
        source: value.source || 'central-config'
      }
    }

    const expectedEmail = number
      ? `protocolista${number}@detran.rj.gov.br`
      : ''

    if (
      !/^\\d{1,4}$/.test(number) ||
      email !== expectedEmail
    ) {
      return null
    }

    return {
      ...value,
      number,
      email: expectedEmail,
      source: value.source || 'central-config'
    }
  }"""
assert fast.count(old) == 1, 'validStoredOperator não encontrado'
fast = fast.replace(old, new, 1)

old = "      if (/^protocolista\\d+@detran\\.rj\\.gov\\.br$/i.test(email)) return\n      if (email === normalizeEmail(BCC_EMAIL)) return"
new = "      if (/^protocolista\\d+@detran\\.rj\\.gov\\.br$/i.test(email)) return\n      if (SPECIAL_PROTOCOLISTA_EMAILS[email]) return\n      if (email === normalizeEmail(BCC_EMAIL)) return"
assert fast.count(old) == 1, 'Filtro de remetente não encontrado'
fast = fast.replace(old, new, 1)
fast_path.write_text(fast, encoding='utf-8')
