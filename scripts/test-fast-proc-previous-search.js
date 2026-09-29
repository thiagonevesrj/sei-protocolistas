/* eslint-env node */
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const source = fs.readFileSync(
  path.join(__dirname, '../cs_modules/clique_protocolista/buscarProcessosAnteriores.js'),
  'utf8'
)

async function runScenario (processTypeOptions) {
  const lookupKey = 'spFastProcConsultaProcessosAnteriores'
  const state = {
    removed: false,
    notice: '',
    submitted: false
  }
  const form = {
    querySelectorAll: () => [searchButton],
    insertAdjacentElement: (position, notice) => { state.notice = notice },
    requestSubmit: () => { state.submitted = true }
  }
  const specification = {
    value: '',
    form,
    dispatchEvent () {}
  }
  const processType = {
    value: '',
    options: processTypeOptions.map(({ value, textContent }) => ({ value, textContent })),
    dispatchEvent () {}
  }
  const processCheckbox = { checked: false, dispatchEvent () {} }
  const generatedDocuments = { checked: true, dispatchEvent () {} }
  const externalDocuments = { checked: true, dispatchEvent () {} }
  const searchButton = { textContent: 'Pesquisar', click: () => { state.submitted = true } }
  const noticeTarget = { insertAdjacentElement: (position, notice) => { state.notice = notice } }
  const document = {
    querySelector (selector) {
      const fields = {
        '#txtDescricaoPesquisa': specification,
        '[name="txtDescricaoPesquisa"]': specification,
        '#selTipoProcedimentoPesquisa': processType,
        '[name="selTipoProcedimentoPesquisa"]': processType,
        '#chkSinProcessos': processCheckbox,
        '[name="chkSinProcessos"]': processCheckbox,
        '#chkSinDocumentosGerados': generatedDocuments,
        '[name="chkSinDocumentosGerados"]': generatedDocuments,
        '#chkSinDocumentosRecebidos': externalDocuments,
        '[name="chkSinDocumentosRecebidos"]': externalDocuments,
        form
      }
      return fields[selector] || null
    },
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => ({
      style: {},
      setAttribute () {},
      textContent: ''
    }),
    body: noticeTarget
  }
  const context = {
    Date,
    URL,
    Event: class {
      constructor (type, options) {
        this.type = type
        this.options = options
      }
    },
    document,
    window: {
      location: {
        href: 'https://sei.rj.gov.br/sei/controlador.php?acao=protocolo_pesquisar'
      },
      currentBrowser: {
        storage: {
          local: {
            get: async () => ({
              [lookupKey]: {
                cpf: '123.456.789-00',
                processType: 'Detran: Devolução de Taxas',
                createdAt: Date.now()
              }
            }),
            remove: async () => { state.removed = true }
          }
        }
      },
      setTimeout
    },
    console
  }

  vm.runInNewContext(source, context)
  for (let attempt = 0; attempt < 20 && !state.removed; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  return { state, specification, processType, processCheckbox, generatedDocuments, externalDocuments }
}

async function run () {
  const matched = await runScenario([
    { value: '', textContent: 'Selecione' },
    { value: '17', textContent: 'Detran: Devolução de Taxas' }
  ])
  assert.strictEqual(matched.specification.value, '12345678900')
  assert.strictEqual(matched.processType.value, '17')
  assert.strictEqual(matched.processCheckbox.checked, true)
  assert.strictEqual(matched.generatedDocuments.checked, false)
  assert.strictEqual(matched.externalDocuments.checked, false)
  assert.strictEqual(matched.state.submitted, true)

  const missingType = await runScenario([
    { value: '', textContent: 'Selecione' },
    { value: '22', textContent: 'Detran: Solicitação de Perícia Médica' }
  ])
  assert.strictEqual(missingType.specification.value, '')
  assert.strictEqual(missingType.state.submitted, false)
  assert.ok(missingType.state.notice.textContent.includes('não localizou o tipo'))

  const ambiguousType = await runScenario([
    { value: '', textContent: 'Selecione' },
    { value: '17', textContent: 'Devolução de Taxas' },
    { value: '18', textContent: 'Detran: Devolução de Taxas Especial' }
  ])
  assert.strictEqual(ambiguousType.processType.value, '')
  assert.strictEqual(ambiguousType.state.submitted, false)
  assert.ok(ambiguousType.state.notice.textContent.includes('não localizou o tipo'))

  console.log('FAST PROC: pesquisa de processos anteriores por CPF e tipo validada.')
}

run().catch((error) => { console.error(error); process.exitCode = 1 })

