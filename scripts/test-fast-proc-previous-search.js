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
      ...(options.searching ? { state: 'searching' } : {}),
      createdAt: Date.now()
    },
    notice: null,
    pageText: options.pageText || '',
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
      return options.searchButtonOutsideForm
        ? null
        : selector === '#sbmPesquisar' ? searchButton : null
    },
    querySelectorAll () { return [] }
  }
  const specification = { value: '', dispatchEvent () {} }
  const processCheckbox = { checked: false, dispatchEvent () {} }
  const generatedDocuments = { checked: true, dispatchEvent () {} }
  const externalDocuments = { checked: true, dispatchEvent () {} }
  const unitHistory = { checked: false, dispatchEvent () {} }
  const agency = {
    value: 'Todos selecionados',
    multiple: true,
    options: [
      { value: '4', textContent: 'DETRAN', selected: true },
      { value: '2', textContent: 'OUTRO ÓRGÃO', selected: true }
    ],
    dispatchEvent () {}
  }
  const searchButton = {
    id: 'sbmPesquisar',
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
    body: {
      textContent: options.pageText || '',
      append (item) { state.notice = item }
    },
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
        '.retorno-ajax': options.detachedResults ? null : results,
        '.total-registros-infinite': options.detachedResults ? null : summary
      }
      return fields[selector] || null
    },
    querySelectorAll (selector) {
      return selector === 'label' && !options.missingUnitHistory ? [historyLabel] : []
    },
    getElementById (id) {
      if (id === 'sp-fast-proc-process-lookup-notice') return state.notice
      return id === 'sbmPesquisar' ? searchButton : null
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
  assert.strictEqual(matched.agency.value, 'Todos selecionados')
  assert.deepStrictEqual(matched.agency.options.map(option => option.selected), [true, true])
  assert.strictEqual(matched.state.submitted, true)
  assert.strictEqual(matched.state.searchButtonClass, 'sp-fast-proc-search-button-highlight')
  assert.strictEqual(matched.form.hidden, true)
  assert.ok(matched.state.notice.children[1].textContent.includes('Pesquisa concluída'))
  assert.ok(matched.state.notice.children[1].textContent.includes('1 processo'))

  const missingUnitHistory = await runScenario({ missingUnitHistory: true })
  assert.strictEqual(missingUnitHistory.state.submitted, false)
  assert.strictEqual(missingUnitHistory.state.searchButtonClass, 'sp-fast-proc-search-button-highlight')
  assert.ok(missingUnitHistory.state.notice.children[1].textContent.includes('Com Tramitação na Unidade'))

  const pageResults = await runScenario({
    searching: true,
    detachedResults: true,
    pageText: 'Resultado da Pesquisa Exibindo 1 - 10 de 13 processos'
  })
  assert.ok(pageResults.state.notice.children[1].textContent.includes('Pesquisa concluída'))
  assert.ok(pageResults.state.notice.children[1].textContent.includes('13 processo(s) listado(s)'))
  assert.strictEqual(pageResults.state.notice.style.background, '#103b2a')

  const outsideButton = await runScenario({ searchButtonOutsideForm: true })
  assert.strictEqual(outsideButton.state.submitted, true, 'O botão Pesquisar fora do formulário também deve ser acionado')

  console.log('FAST PROC: consulta por CPF, botão de pesquisa e conclusão dos resultados validados.')
}

run().catch((error) => { console.error(error); process.exitCode = 1 })

