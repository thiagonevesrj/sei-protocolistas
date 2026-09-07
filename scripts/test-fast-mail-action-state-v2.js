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
const processTypes = catalog.processTypes || []

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

const transferencia = processTypes.find((process) => process.id === 'transferencia-prontuario-habilitacao')
const transferenciaTopic = topics.find((topic) => topic.processId === 'transferencia-prontuario-habilitacao')
const transferenciaMissingIds = (transferencia?.missingDocuments || []).map((item) => item.id)

expect(Boolean(transferencia), 'FAST MAIL ações V2: Transferência de Prontuário deve existir como procedimento próprio')
expect(transferencia?.destinationUnit === 'NUCRA', 'FAST MAIL ações V2: Transferência de Prontuário deve manter destino NUCRA')
expect((transferencia?.seiNames || []).includes('Detran: Solicitação Geral - Habilitação'), 'FAST MAIL ações V2: Transferência de Prontuário deve manter o mapeamento técnico para Solicitação Geral - Habilitação')
expect(transferenciaMissingIds.includes('duda-206-2'), 'FAST MAIL ações V2: checklist de Transferência deve conter DUDA 206-2')
expect(transferenciaMissingIds.includes('duda-payment-proof'), 'FAST MAIL ações V2: checklist de Transferência deve conter comprovante de pagamento do DUDA')
expect(Boolean(transferenciaTopic), 'FAST MAIL ações V2: Transferência de Prontuário deve possuir tópico operacional')
expect(transferenciaTopic?.canOpenProcess === true, 'FAST MAIL ações V2: Transferência de Prontuário deve permitir abertura por e-mail')

expect(source.includes("TRANSFER_PROCESS_ID = 'transferencia-prontuario-habilitacao'"), 'FAST MAIL ações V2: atalho rápido de Transferência não está configurado')
expect(source.includes('Transferência de prontuário'), 'FAST MAIL ações V2: rótulo visual de Transferência de Prontuário está ausente')
expect(source.includes('spfm-v2-route-meta'), 'FAST MAIL ações V2: metadados compactos de destino/tipo SEI estão ausentes')
expect(source.includes('spfm-v2-fallback-button'), 'FAST MAIL ações V2: genéricos não estão marcados visualmente como fallback')

if (errors.length) {
  console.error('Falhas na validação dos estados operacionais do FAST MAIL V2:')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log('Estados operacionais do FAST MAIL V2 validados.')
