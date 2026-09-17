/* eslint-env node */
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(
  path.join(root, 'cs_modules/clique_protocolista/index.js'),
  'utf8'
)

const start = source.indexOf('  function visibleInterestedSuggestions()')
const end = source.indexOf('  function clickAddInterested(', start)
assert.ok(start > -1 && end > start)

let visible = []
let armed = 0
const context = {
  cleanValue: value => String(value || '').replace(/\s+/g, ' ').trim(),
  normalize: value => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
  document: {
    querySelectorAll: () => visible,
    dispatchEvent: () => { armed++ }
  },
  sessionStorage: { setItem: () => {} },
  Date,
  CustomEvent: class {},
  MouseEvent: class {},
  KeyboardEvent: class {},
  window: {},
  dispatchFieldEvents: () => {},
  wait: async () => {},
  waitUntil: async test => {
    const result = test()
    if (result) return result
    throw new Error('timeout')
  },
  INTERESTED_CONFIRM_KEY: 'confirmation',
  INTERESTED_CONFIRM_EVENT: 'arm'
}

vm.runInNewContext(
  `${source.slice(start, end)}\nthis.api = { interestedSuggestionName, selectInterestedSuggestion }`,
  context
)

const suggestion = text => ({
  textContent: text,
  offsetParent: {},
  dispatchEvent () {},
  click () { this.clicked = true }
})

assert.strictEqual(
  context.api.interestedSuggestionName(suggestion('"Raquel Thiengo"')),
  'Raquel Thiengo'
)
assert.strictEqual(
  context.api.interestedSuggestionName(suggestion('"Thiago Rangel" <thiagorangel@alerj.rj.gov.br>;')),
  'Thiago Rangel'
)
assert.strictEqual(
  context.api.interestedSuggestionName(suggestion('$Thiago Rodrigues Miglavacca (p_madvogados@hotmail.com)')),
  'Thiago Rodrigues Miglavacca'
)

async function run () {
  const exact = suggestion('"Thiago Rangel" <thiagorangel@alerj.rj.gov.br>;')
  visible = [exact, suggestion('1º TEN THIAGO GONÇALVES FONSECA JAUHAR')]
  assert.strictEqual(
    await context.api.selectInterestedSuggestion('Thiago Rangel', '', {}),
    true
  )
  assert.strictEqual(exact.clicked, true)
  assert.strictEqual(armed, 0, 'Cadastro existente não deve armar criação de interessado')

  const first = suggestion('"NOME IGUAL" <primeiro@example.org>;')
  const second = suggestion('"NOME IGUAL" <segundo@example.org>;')
  visible = [first, second]
  assert.strictEqual(
    await context.api.selectInterestedSuggestion('Nome Igual', 'segundo@example.org', {}),
    true
  )
  assert.strictEqual(second.clicked, true, 'E-mail deve desempatar nomes idênticos')

  await assert.rejects(
    context.api.selectInterestedSuggestion('Nome Igual', '', {}),
    /mais de um cadastro/
  )
  assert.strictEqual(armed, 0)

  visible = [suggestion('THIAGO PARECIDO')]
  await assert.rejects(
    context.api.selectInterestedSuggestion('Thiago Procurado', '', {}),
    /possíveis cadastros/
  )
  assert.strictEqual(armed, 0, 'Lista inconclusiva não deve criar interessado automaticamente')

  visible = []
  const field = {
    focus () {},
    dispatchEvent () {}
  }
  assert.strictEqual(
    await context.api.selectInterestedSuggestion('Pessoa Nova', '', field),
    true
  )
  assert.strictEqual(armed, 1, 'Somente ausência da lista autoriza o fluxo de novo interessado')
  console.log('FAST PROC: consulta nativa e proteção contra interessado duplicado verificadas.')
}

run().catch(error => { console.error(error); process.exitCode = 1 })
