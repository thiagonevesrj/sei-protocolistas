/* eslint-env node */
'use strict'

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(
  path.join(root, 'cs_modules/requerimento_rapido/resgate-rq.js'),
  'utf8'
)
const manifest = fs.readFileSync(
  path.join(root, 'manifest.json'),
  'utf8'
)

const errors = []
const expect = (condition, message) => {
  if (!condition) errors.push(message)
}

expect(
  source.includes('const RESCUE_DELAY = 15500'),
  'RQ: resgate deve ocorrer somente depois do timeout atual de 15 s'
)
expect(
  source.includes("if (document.querySelector('#sp-fast-proc-rq')) return"),
  'RQ: resgate não pode competir com o botão atual quando ele já existe'
)
expect(
  source.includes('/Nos\\[0\\]\\.acoes/'),
  'RQ: resgate deve usar as ações publicadas pelo próprio SEI'
)
expect(
  source.includes('acao=documento_escolher_tipo'),
  'RQ: resgate deve localizar especificamente Incluir Documento'
)
expect(
  source.includes('const liveLink = findLiveIncludeLink()'),
  'RQ: clique nativo deve continuar sendo preferido quando disponível'
)
expect(
  source.includes('if (liveLink) clickNativeElement(liveLink)'),
  'RQ: caminho nativo funcional deve ser preservado'
)
expect(
  manifest.includes('cs_modules/requerimento_rapido/index.js') &&
  manifest.includes('cs_modules/requerimento_rapido/resgate-rq.js'),
  'RQ: fluxo atual e resgate devem ser carregados juntos'
)
expect(
  manifest.indexOf('cs_modules/requerimento_rapido/index.js') <
  manifest.indexOf('cs_modules/requerimento_rapido/resgate-rq.js'),
  'RQ: resgate deve carregar depois do fluxo atual'
)

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log('Requerimento rápido resgate: OK')
