/* eslint-env node */
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
const workflow = read('cs_modules/fast_mail/workflow-v3.js')
const core = read('cs_modules/fast_mail/index.js')
const processCatalog = JSON.parse(read('data/catalogo-processos.json'))

function extract (source, name) {
  const start = source.indexOf(`  function ${name} (`)
  assert.ok(start >= 0, name)
  return source.slice(start, source.indexOf('\n  }', start) + 4)
}

function scenario (previousPhase = '') {
  const script = { id: 'trello-65aa7153e4f4827271549671', phase: 'atendimento', title: 'Resposta de teste', body: 'Conteúdo de teste' }
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
    scripts: [script],
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
  for (const name of ['scriptByTitle', 'scriptById', 'selectNativeScript', 'chooseRequirementResult', 'runRequirementShortcut', 'setStage']) vm.runInContext(extract(workflow, name), context)
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

  context.runRequirementShortcut({ id: script.id, title: script.title, label: 'JÁ EXISTE PROCESSO ABERTO' })
  assert.strictEqual(insert.clicks, 1, 'atalho frequente deve inserir no corpo com um clique')
  assert.ok(status.textContent.includes('Inserindo'))

  context.setStage('orientacao')
  assert.strictEqual(catalog.hidden, true, 'exigência anterior não vaza para outra etapa')
  context.setStage('exigencias')
  context.chooseRequirementResult({ type: 'script', script })
  assert.strictEqual(catalog.hidden, false, 'retorno permite escolher e abrir novamente')
  assert.strictEqual(insert.clicks, 1, 'pesquisa continua apenas selecionando, sem nova inserção')

  delete elements['.spfm-phase-button[data-phase-id="atendimento"]']
  context.setStage('exigencias')
  context.chooseRequirementResult({ type: 'script', script })
  assert.strictEqual(catalog.hidden, true)
  assert.ok(status.textContent.includes('ainda não ficou pronto'))
}

scenario()
scenario('orientacao')
assert.ok(workflow.includes('data-spfm-requirement-shortcut="trello-65aa7153e4f4827271549671"'))
assert.ok(workflow.includes('data-spfm-requirement-shortcut="trello-651313630a420501b4752ebb"'))
assert.ok(workflow.includes('JÁ EXISTE PROCESSO ABERTO'))
assert.ok(workflow.includes('SOBRE ANDAMENTO'))
const baixaProcess = processCatalog.processTypes.find((item) => item.id === 'baixa-restricao')
const baixaTopic = processCatalog.fastMailPriorityTopics.find((item) => item.id === 'baixa-restricao')
const periciaProcess = processCatalog.processTypes.find((item) => item.id === 'solicitacao-pericia-medica')
assert.ok(baixaProcess, 'Baixa de Restrição deve ter checklist documental próprio')
assert.ok(baixaProcess.missingDocuments.length >= 6, 'Baixa de Restrição deve oferecer documentos para marcar')
assert.strictEqual(baixaTopic?.processId, 'baixa-restricao', 'Baixa de Restrição deve usar o fluxo padrão de ações')
assert.strictEqual(baixaTopic?.requireVariantSelection, true, 'Baixa de Restrição deve pedir o caso antes das ações')
assert.deepStrictEqual(baixaTopic?.variants?.map((item) => item.id), ['geral', 'herdeiros', 'terceiros'], 'Baixa de Restrição deve preservar os três casos')
assert.ok(workflow.includes("{ id: 'baixa-restricao', label: 'Baixa de Restrição' }"), 'Baixa de Restrição deve abrir como atendimento principal')
assert.ok(!workflow.includes("'sei-protocolistas:select-priority-topic'"), 'Baixa de Restrição não deve desviar da navegação padrão que exibe o seletor')
const laudoPericia = periciaProcess?.missingDocuments?.find((item) => item.id === 'medical-report')?.text || ''
assert.ok(laudoPericia.includes('menos de seis meses'), 'Perícia Médica: laudo deve informar validade de seis meses')
assert.ok(laudoPericia.includes('CID-10') && laudoPericia.includes('CIF'), 'Perícia Médica: exceção de deficiência irreversível deve manter CID-10 e CIF')
console.log('FAST MAIL EXIGÊNCIAS: pesquisa manual e atalhos de inserção direta disponíveis.')
