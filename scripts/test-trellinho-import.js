/* eslint-env node */
'use strict'

const assert = require('assert')
const {
  buildImport,
  parseTrellinhoHtml,
  stableKey
} = require('./import-trellinho-html')

const incomingRaw = [
  {
    fase: 'FASE 02 - Orientação',
    lista: 'Veículos',
    nome: 'Atendimento existente',
    texto: 'Resposta atualizada pelo Trellinho.',
    presencial: false,
    nao_abre: false,
    destino_processo: 'DESTINO-NOVO',
    tipologia_processual: '[Tipo SEI confirmado](https://example.invalid/sei)'
  },
  {
    fase: 'FASE 02 - Orientação',
    lista: 'Veículos',
    nome: 'Novo atendimento',
    texto: 'Resposta nova.',
    presencial: false,
    nao_abre: false,
    destino_processo: null,
    tipologia_processual: null
  },
  {
    fase: 'FASE 02 - Orientação',
    lista: 'Veículos',
    nome: 'Novo atendimento',
    texto: 'Resposta nova.',
    presencial: false,
    nao_abre: false,
    destino_processo: null,
    tipologia_processual: null
  },
  {
    fase: 'FASE 01 - Identificação',
    lista: 'Triagem',
    nome: 'Duplicidade conflitante',
    texto: 'Versão A.',
    presencial: false,
    nao_abre: false,
    destino_processo: null,
    tipologia_processual: null
  },
  {
    fase: 'FASE 01 - Identificação',
    lista: 'Triagem',
    nome: 'Duplicidade conflitante',
    texto: 'Versão B.',
    presencial: false,
    nao_abre: false,
    destino_processo: null,
    tipologia_processual: null
  }
]

const html = `<script>
const SCRIPTS = ${JSON.stringify(incomingRaw)};
const PDF_FORMS = [];
</script>`

assert.deepStrictEqual(parseTrellinhoHtml(html), incomingRaw)

const existingId = 'trello-existing'
const missingId = 'trello-missing'
const currentCatalog = {
  retiredDuplicateCards: [],
  scripts: [
    {
      id: existingId,
      title: 'Atendimento existente',
      phase: 'orientacao',
      phaseLabel: 'Orientação',
      group: 'Veículos',
      body: 'Resposta anterior.',
      status: 'legado-vigente',
      source: { cardId: 'card-existing', destinationUnit: 'DESTINO-CONFIRMADO' }
    },
    {
      id: missingId,
      title: 'Atendimento ausente',
      phase: 'atendimento',
      phaseLabel: 'Exigências e finalização',
      group: 'Crítica',
      body: 'Resposta preservada.',
      status: 'legado-vigente',
      source: { cardId: 'card-missing' }
    }
  ]
}
const processCatalog = {
  processTypes: [
    {
      id: 'processo-existente',
      name: 'Processo existente',
      destinationUnit: 'DESTINO-CONFIRMADO',
      source: { cardId: 'card-existing' }
    }
  ],
  fastMailPriorityTopics: [{ scriptId: existingId }]
}
const curatedResponses = {
  scripts: [
    {
      id: existingId,
      title: 'Atendimento existente',
      validation: 'operator-confirmed',
      bodyLines: ['Resposta curada protegida.']
    }
  ]
}

const first = buildImport({
  incomingRaw,
  currentCatalog,
  processCatalog,
  curatedResponses,
  rules: { aliases: {}, duplicateChoices: {} },
  inputName: 'fixture.html'
})

assert.strictEqual(first.report.safeToApply, false)
assert.strictEqual(first.report.summary.collapsedDuplicates, 1)
assert.strictEqual(first.report.summary.conflictingDuplicates, 1)
assert.strictEqual(first.report.summary.protectedCurations, 1)
assert.strictEqual(first.report.summary.destinationConflicts, 1)
assert.ok(first.catalog.scripts.some((script) => script.id === existingId))
assert.strictEqual(
  first.catalog.scripts.find((script) => script.id === missingId)?.status,
  'fonte-ausente-pendente-revisao'
)

const conflict = first.report.conflictingDuplicates[0]
const selectedHash = conflict.candidates[1].bodyHash
const rules = {
  aliases: {},
  duplicateChoices: {
    [stableKey('identificacao', 'Triagem', 'Duplicidade conflitante')]: {
      bodyHash: selectedHash
    }
  }
}
const resolved = buildImport({
  incomingRaw,
  currentCatalog,
  processCatalog,
  curatedResponses,
  rules,
  inputName: 'fixture.html'
})

assert.strictEqual(resolved.report.safeToApply, true)
assert.strictEqual(resolved.report.summary.conflictingDuplicates, 0)
assert.ok(resolved.catalog.scripts.some((script) => script.body === 'Versão B.'))
assert.ok(resolved.catalog.scripts.some((script) => script.id === existingId))
assert.ok(resolved.catalog.scripts.some((script) => script.id === missingId))

console.log('Importação segura do Trellinho validada.')
