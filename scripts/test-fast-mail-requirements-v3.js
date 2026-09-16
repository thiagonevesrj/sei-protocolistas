/* eslint-env node */
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
const workflow = read('cs_modules/fast_mail/workflow-v3.js')
const core = read('cs_modules/fast_mail/index.js')

function extract (source, name) {
  const start = source.indexOf(`  function ${name} (`)
  assert.ok(start >= 0, name)
  return source.slice(start, source.indexOf('\n  }', start) + 4)
}

function scenario (previousPhase = '') {
  const script = { id: 'exigencia-teste', phase: 'atendimento', title: 'Resposta de teste', body: 'Conteúdo de teste' }
  const catalog = { hidden: true }
  const phase = { options: [{ value: 'atendimento' }], value: previousPhase }
  const search = { value: '', focus () {} }
  const result = { value: '', options: [] }
  const insert = { disabled: true, clicks: 0, click () { this.clicks++ } }
  const preview = { textContent: '' }
  const status = { textContent: '' }
  const elements = {
    '#spfm-script-catalog': catalog,
    '#spfm-script-phase': phase,
    '#spfm-script-search': search,
    '#spfm-script-result': result,
    '#spfm-insert-script': insert,
    '#spfm-priority-status': status,
    '#spfm-script-toggle': { click () { throw new Error('Não abrir catálogo antes de sincronizar a fase') } }
  }
  const context = {
    activeStage: '',
    selectedWorkflowPhaseId: previousPhase,
    selectedPriorityAreaId: '',
    priorityResponseScriptIds: ['filtro-de-outro-servico'],
    activePriorityAction: '',
    responseScriptPhases: [{ id: 'atendimento', label: 'Exigências' }, { id: 'orientacao', label: 'Orientação' }],
    CATALOG_CLOSE_LABEL: 'Fechar catálogo',
    CATALOG_OPEN_LABEL: 'Abrir catálogo',
    ROOT_ID: 'workflow',
    document: {
      querySelector: (selector) => elements[selector] || null,
      querySelectorAll: () => [],
      getElementById: () => ({ querySelectorAll: () => [], querySelector: () => null })
    },
    window: { setTimeout: (callback) => callback() },
    hidePriorityDetails () {},
    renderPriorityTopics () {},
    clean: (value) => String(value || '').trim(),
    setStatus: (message) => { status.textContent = message },
    setSelected () {},
    showNativeStatus () {},
    cueLater () {},
    renderResponseScriptResults: () => {
      result.options = phase.value === script.phase &&
        (!search.value || search.value === script.title) && context.priorityResponseScriptIds === null
        ? [{ value: script.id }]
        : []
      result.value = ''
    },
    dispatch: (element, type) => {
      if (element === search || element === phase) context.renderResponseScriptResults()
      if (element === result && type === 'change') {
        preview.textContent = result.value === script.id ? script.body : ''
        insert.disabled = !preview.textContent
      }
    }
  }
  vm.createContext(context)
  for (const name of ['openWorkflowPhaseCatalog', 'selectWorkflowPhase']) vm.runInContext(extract(core, name), context)
  for (const name of ['selectNativeScript', 'chooseRequirementResult', 'setStage']) vm.runInContext(extract(workflow, name), context)
  elements['.spfm-phase-button[data-phase-id="atendimento"]'] = { click: () => context.selectWorkflowPhase('atendimento') }

  context.setStage('exigencias')
  context.chooseRequirementResult({ type: 'script', script })
  assert.strictEqual(context.selectedWorkflowPhaseId, 'atendimento')
  assert.strictEqual(catalog.hidden, false, 'catálogo com prévia e botão deve abrir')
  assert.strictEqual(result.value, script.id)
  assert.strictEqual(preview.textContent, script.body)
  assert.strictEqual(insert.disabled, false)
  assert.strictEqual(insert.clicks, 0, 'selecionar nunca insere automaticamente')
  assert.ok(!status.textContent.includes('Selecione primeiro a fase'))

  context.setStage('orientacao')
  assert.strictEqual(catalog.hidden, true, 'exigência anterior não vaza para outra etapa')
  context.setStage('exigencias')
  context.chooseRequirementResult({ type: 'script', script })
  assert.strictEqual(catalog.hidden, false, 'retorno permite escolher e abrir novamente')
  assert.strictEqual(insert.clicks, 0)

  delete elements['.spfm-phase-button[data-phase-id="atendimento"]']
  context.setStage('exigencias')
  context.chooseRequirementResult({ type: 'script', script })
  assert.strictEqual(catalog.hidden, true)
  assert.ok(status.textContent.includes('ainda não ficou pronto'))
}

scenario()
scenario('orientacao')
console.log('FAST MAIL EXIGÊNCIAS: fase sincronizada, prévia e inserção manual disponíveis.')
