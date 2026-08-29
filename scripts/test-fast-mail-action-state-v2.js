/* eslint-env node */
'use strict'

const fs = require('fs')
const path = require('path')

const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..')
const errors = []

function readJson (relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'))
}

function readText (relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function expect (condition, message) {
  if (!condition) errors.push(message)
}

const manifest = readJson('manifest.json')
const catalog = readJson('data/catalogo-processos.json')
const source = readText('cs_modules/fast_mail/action-state-v2.js')
const topics = catalog.fastMailPriorityTopics || []

const webmailEntry = (manifest.content_scripts || []).find((entry) =>
  (entry.matches || []).includes('https://venus2.detran.rj.gov.br/owa/*')
)

expect(Boolean(webmailEntry), 'FAST MAIL ações V2: entrada do Webmail ausente no manifest')
expect((webmailEntry?.js || []).includes('cs_modules/fast_mail/action-state-v2.js'), 'FAST MAIL ações V2: action-state-v2.js não está carregado')
expect((webmailEntry?.css || []).includes('cs_modules/fast_mail/action-state-v2.css'), 'FAST MAIL ações V2: action-state-v2.css não está carregado')

;[
  'ORIENTAR',
  'COBRAR DOCUMENTOS',
  'ABRIR PROCESSO',
  'SOMENTE PRESENCIAL',
  'NÃO ABRE PROCESSO',
  'ABERTURA INDISPONÍVEL'
].forEach((label) => {
  expect(source.includes(label), `FAST MAIL ações V2: rótulo operacional ausente: ${label}`)
})

const oficios = topics.find((topic) => topic.id === 'oficios')
expect(oficios?.canOpenProcess === true, 'FAST MAIL ações V2: Ofícios deve permanecer com abertura habilitada')
expect(Boolean(oficios?.processId), 'FAST MAIL ações V2: Ofícios precisa manter procedimento vinculado')

const presencial = topics.filter((topic) => /somente presencial/i.test(topic.blockedReason || ''))
expect(presencial.length >= 1, 'FAST MAIL ações V2: catálogo deve possuir atendimento somente presencial para validar o estado visual')
presencial.forEach((topic) => {
  expect(topic.canOpenProcess === false, `FAST MAIL ações V2: ${topic.id} presencial não pode abrir processo`)
})

const semProcesso = topics.find((topic) => /sem abertura de processo administrativo/i.test(topic.blockedReason || ''))
expect(Boolean(semProcesso), 'FAST MAIL ações V2: catálogo deve possuir serviço sem abertura de processo')
expect(semProcesso?.canOpenProcess === false, 'FAST MAIL ações V2: serviço sem processo não pode habilitar abertura')

const leilao = topics.find((topic) => topic.id === 'leilao-veiculos')
expect(leilao?.canOpenProcess === false, 'FAST MAIL ações V2: Leilão deve continuar bloqueado')
expect(/tipo SEI/i.test(leilao?.blockedReason || ''), 'FAST MAIL ações V2: Leilão deve explicar a pendência do tipo SEI')

if (errors.length) {
  console.error('Falhas na validação dos estados operacionais do FAST MAIL V2:')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log('Estados operacionais do FAST MAIL V2 validados.')
