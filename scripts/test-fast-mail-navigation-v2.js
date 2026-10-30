/* eslint-env node */
'use strict'

const fs = require('fs')
const path = require('path')

const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..')
const errors = []

function readJson (relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'))
}

function expect (condition, message) {
  if (!condition) errors.push(message)
}

const manifest = readJson('manifest.json')
const scripts = readJson('data/catalogo-scripts.json').scripts || []
const processes = readJson('data/catalogo-processos.json')
const topics = processes.fastMailPriorityTopics || []

const webmailEntry = (manifest.content_scripts || []).find((entry) =>
  (entry.matches || []).includes('https://venus2.detran.rj.gov.br/owa/*')
)

expect(Boolean(webmailEntry), 'FAST MAIL V2: entrada do Webmail não encontrada no manifest')
expect((webmailEntry?.js || []).includes('cs_modules/fast_mail/index.js'), 'FAST MAIL V2: motor principal do FAST MAIL deve permanecer carregado')
expect((webmailEntry?.js || []).includes('cs_modules/fast_mail/navigation-v2.js'), 'FAST MAIL V2: navigation-v2.js não está carregado')
expect((webmailEntry?.css || []).includes('cs_modules/fast_mail/navigation-v2.css'), 'FAST MAIL V2: navigation-v2.css não está carregado')

const identificationTitles = [
  'SCRIPT DE IDENTIFICAÇÃO COMPLETO',
  'SCRIPT DE IDENTIFICAÇÃO DO SERVIÇO',
  'SCRIPT DE SIMPLES IDENTIFICAÇÃO',
  'TRIAGEM - Devolução de Taxas',
  'TRIAGEM - Perícia Médica',
  'SCRIPT DE IDENTIFICAÇÃO - INVENTÁRIO'
]

identificationTitles.forEach((title) => {
  const script = scripts.find((item) => item.phase === 'identificacao' && item.title === title)
  expect(Boolean(script), `FAST MAIL V2: atalho de identificação ausente no catálogo operacional: ${title}`)
  expect(Boolean(script?.body), `FAST MAIL V2: atalho de identificação sem conteúdo: ${title}`)
})

;[
  'devolucao-taxas',
  'pericia-medica-pcd',
  'desistencia-categoria',
  'generico-habilitacao',
  'generico-veiculos',
  'leilao-veiculos',
  'troca-clinica',
  'oficios'
].forEach((topicId) => {
  expect(topics.some((topic) => topic.id === topicId), `FAST MAIL V2: atendimento prioritário ausente: ${topicId}`)
})

const certidao = (processes.processTypes || []).find((process) => process.id === 'certidao-identificacao-civil')
expect(Boolean(certidao), 'FAST MAIL V2: Certidão de Identificação Civil não encontrada no catálogo de processos')
expect(certidao?.destinationUnit === 'DIRIC', 'FAST MAIL V2: destino da Certidão de Identificação Civil deve continuar DIRIC')
expect(certidao?.documentsStatus === 'pending-validation', 'FAST MAIL V2: checklist da Certidão deve permanecer bloqueado até validação')

const leilao = topics.find((topic) => topic.id === 'leilao-veiculos')
expect(leilao?.canOpenProcess === false, 'FAST MAIL V2: Leilão não pode abrir FAST PROC sem tipo SEI confirmado')
expect(/COMISLE/.test(leilao?.blockedReason || ''), 'FAST MAIL V2: bloqueio do Leilão deve registrar COMISLE como destino confirmado')

if (errors.length) {
  console.error('Falhas na validação da navegação FAST MAIL V2:')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log('Navegação FAST MAIL V2 validada.')
