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

async function runScenario (options) {
  const lookupKey = 'spFastProcConsultaProcessosAnteriores'
  const state = {
    lookup: {
      cpf: '123.456.789-00',
      applicantName: 'Maria da Silva',
      createdAt: Date.now()
    },
    notice: null,
    submitted: false,
    removed: false
  }

  function element (tagName) {
    const attributes = {}
    const children = []
    return {
      tagName,
      id: '',
      className: '',
      textContent: '',
      value: '',
      style: {},
      hidden: false,
      children,
      setAttribute (name, value) { attributes[name] = value },
      getAttribute (name) { return attributes[name] || '' },
      append (...items) { children.push(...items) },
      addEventListener () {},
      insertAdjacentElement () {},
      querySelector (selector) {
        return children.find((child) => {
          if (selector.startsWith('.')) return child.className === selector.slice(1)
          if (selector.startsWith('[')) return child.getAttribute('aria-hidden') === 'true'
          if (selector === 'button') return child.tagName === 'button'
          return false
        }) || null
      },
      querySelectorAll () { return [] }
    }
  }

  const form = {
    hidden: false,
    querySelector (selector) {
      return selector === '#sbmPesquisar' ? searchButton : null
    },
    querySelectorAll () { return [] }
  }
  const specification = { value: '', dispatchEvent () {} }
  const processCheckbox = { checked: false, dispatchEvent () {} }
  const generatedDocuments = { checked: true, dispatchEvent () {} }
  const externalDocuments = { checked: true, dispatchEvent () {} }
  const unitHistory = { checked: false, dispatchEvent () {} }
  const agency = {
    value: '',
    multiple: false,
    options: [{ value: '4', textContent: options.agencyText, selected: false }],
    dispatchEvent () {}
  }
  const searchButton = {
    value: 'Pesquisar',
    classList: { add (name) { state.searchButtonClass = name } },
    click () { state.submitted = true }
  }
  const resultRow = {}
  const results = {
    textContent: 'Processo encontrado',
    querySelector (selector) {
      if (selector === '.ajax-loading') return { style: { display: 'none' } }
      return null
    },
    querySelectorAll (selector) {
      return selector === 'table tbody tr' && state.submitted ? [resultRow] : []
    }
  }
  const summary = { textContent: 'Exibindo 1 - 1 de 1' }
  const historyLabel = {
    htmlFor: '',
    textContent: 'Com Tramitação na Unidade',
    querySelector: () => unitHistory,
    parentElement: null,
    getAttribute: () => ''
  }
  const document = {
    body: { append (item) { state.notice = item } },
    head: { append () {} },
    querySelector (selector) {
      const fields = {
        '#seiSearch': form,
        form,
        '#txtDescricaoPesquisa': specification,
        '[name="txtDescricaoPesquisa"]': specification,
        '#chkSinProcessos': processCheckbox,
        '[name="chkSinProcessos"]': processCheckbox,
        '#selOrgaoPesquisa': agency,
        '[name="selOrgaoPesquisa"], [name="selOrgaoPesquisa[]"]': agency,
        '#chkSinDocumentosGerados': generatedDocuments,
        '[name="chkSinDocumentosGerados"]': generatedDocuments,
        '#chkSinDocumentosRecebidos': externalDocuments,
        '[name="chkSinDocumentosRecebidos"]': externalDocuments,
        '.retorno-ajax': results,
        '.total-registros-infinite': summary
      }
      return fields[selector] || null
    },
    querySelectorAll (selector) {
      return selector === 'label' && !options.missingUnitHistory ? [historyLabel] : []
    },
    getElementById (id) {
      return id === 'sp-fast-proc-process-lookup-notice' ? state.notice : null
    },
    createElement: element
  }
  const context = {
    Date,
    URL,
    Event: class {
      constructor (type, eventOptions) {
        this.type = type
        this.options = eventOptions
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
            get: async (key) => ({ [key]: state.lookup }),
            set: async (items) => { state.lookup = items[lookupKey] },
            remove: async () => { state.lookup = null; state.removed = true }
          }
        }
      },
      getComputedStyle: item => item.style,
      setTimeout
    },
    console
  }

  vm.runInNewContext(source, context)
  for (let attempt = 0; attempt < 30 && !state.removed; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  return { state, specification, processCheckbox, generatedDocuments, externalDocuments, unitHistory, agency, form }
}

async function run () {
  const matched = await runScenario({ agencyText: 'DETRAN' })
  assert.strictEqual(matched.specification.value, '12345678900')
  assert.strictEqual(matched.processCheckbox.checked, true)
  assert.strictEqual(matched.generatedDocuments.checked, false)
  assert.strictEqual(matched.externalDocuments.checked, false)
  assert.strictEqual(matched.unitHistory.checked, true)
  assert.strictEqual(matched.agency.value, '4')
  assert.strictEqual(matched.state.submitted, true)
  assert.strictEqual(matched.state.searchButtonClass, 'sp-fast-proc-search-button-highlight')
  assert.strictEqual(matched.form.hidden, true)
  assert.ok(matched.state.notice.children[1].textContent.includes('Pesquisa concluída'))
  assert.ok(matched.state.notice.children[1].textContent.includes('1 processo'))

  const missingAgency = await runScenario({ agencyText: 'OUTRO ÓRGÃO' })
  assert.strictEqual(missingAgency.specification.value, '')
  assert.strictEqual(missingAgency.state.submitted, false)
  assert.strictEqual(missingAgency.state.searchButtonClass, 'sp-fast-proc-search-button-highlight')
  assert.ok(missingAgency.state.notice.children[1].textContent.includes('não encontrou o órgão DETRAN'))

  const missingUnitHistory = await runScenario({ agencyText: 'DETRAN', missingUnitHistory: true })
  assert.strictEqual(missingUnitHistory.state.submitted, false)
  assert.strictEqual(missingUnitHistory.state.searchButtonClass, 'sp-fast-proc-search-button-highlight')
  assert.ok(missingUnitHistory.state.notice.children[1].textContent.includes('Com Tramitação na Unidade'))

  console.log('FAST PROC: consulta anterior por CPF, seleção, aviso de falha e destaque da pesquisa validados.')
}

run().catch((error) => { console.error(error); process.exitCode = 1 })

