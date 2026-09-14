/* eslint-env node */
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const read = (name) => fs.readFileSync(path.join(__dirname, '../cs_modules/fast_mail', name), 'utf8')
const repeatSource = read('script-repeat-guard-v1.js')
const composeSource = read('compose-html-guard-v1.js')
const indexSource = read('index.js')

function extract (source, name) {
  const start = source.search(new RegExp(`  (?:async )?function ${name} \\(`))
  assert.ok(start >= 0, name)
  return source.slice(start, source.indexOf('\n  }', start) + 4)
}

function toolbarElement (props = {}) {
  return {
    getBoundingClientRect: () => ({ left: 100, right: 200, top: 10, bottom: 34, width: 100, height: 24 }),
    querySelectorAll: () => [],
    contains: () => false,
    ...props
  }
}

function setup () {
  let now = 10000
  const context = { Date: { now: () => now } }
  context.window = context
  context.top = context
  context.location = { pathname: '/owa/' }
  vm.createContext(context)
  vm.runInContext(repeatSource, context)
  return { context, guard: context.spFastMailRepeatGuard, advance: (ms) => { now += ms } }
}

function testHistoryAndDoubleClick () {
  const { context, guard, advance } = setup()
  context.assertSafeMessageBodyEditor = () => {}
  vm.runInContext(extract(indexSource, 'messageBodyContainsResponse'), context)
  for (const type of ['catalog-script', 'missing-documents-requirement', 'process-completed-response', 'presential-missing-documents']) {
    const html = `<div data-sei-protocolistas="${type}">Resposta anterior com links e formatação</div>`
    const editor = { innerHTML: html, querySelector: () => ({}) }
    assert.strictEqual(context.messageBodyContainsResponse(editor, `[data-sei-protocolistas="${type}"]`, html), false)
    assert.strictEqual(guard.isDuplicate(editor, html), false)
    guard.recordInsertion(editor, html)
    assert.strictEqual(guard.isDuplicate(editor, html), true)
    assert.strictEqual(guard.isDuplicate({ innerHTML: html }, html), false, 'novo compositor')
    assert.strictEqual(guard.isDuplicate(editor, html + ' nova orientação'), false)
    advance(1500)
    assert.strictEqual(guard.isDuplicate(editor, html), false, 'novo atendimento no mesmo editor')
  }
  const plain = { tagName: 'TEXTAREA', value: 'Resposta anterior repetida no histórico' }
  assert.strictEqual(context.messageBodyContainsResponse(plain, '', plain.value), false)
  guard.recordInsertion(plain, plain.value)
  assert.strictEqual(guard.isDuplicate(plain, plain.value), true)
  const response = plain.value
  plain.value = ''
  assert.strictEqual(guard.isDuplicate(plain, response), false, 'desfazer permite tentar novamente')
}

function testOnlyTechnicalAttributesRemoved () {
  const { guard } = setup()
  const attrs = new Map([['data-sei-protocolistas', 'catalog-script'], ['data-script-id', 'old'], ['style', 'color:red']])
  const old = { innerHTML: '<b>Texto antigo</b><a href="/arquivo">Anexo</a>', removeAttribute: (key) => attrs.delete(key) }
  const original = old.innerHTML
  const editor = { innerHTML: original, querySelectorAll: () => [old] }
  assert.strictEqual(guard.isCurrentResponse(old), false)
  guard.releaseHistoricalMarkers(editor)
  assert.strictEqual(old.innerHTML, original)
  assert.strictEqual(attrs.get('style'), 'color:red')
  assert.strictEqual(attrs.has('data-sei-protocolistas'), false)
  assert.strictEqual(attrs.has('data-script-id'), false)
  const fresh = {}
  editor.querySelectorAll = () => [fresh]
  guard.recordInsertion(editor, 'nova')
  assert.strictEqual(guard.isCurrentResponse(fresh), true)
  assert.strictEqual(guard.isCurrentResponse(old), false)
  const before = editor.innerHTML
  editor.innerHTML += '<p>Apresentação HTML</p>'
  guard.recordPresentation(editor, before)
  assert.strictEqual(guard.isDuplicate(editor, 'nova'), true)
  editor.innerHTML = 'edição humana'
  guard.recordPresentation(editor, editor.innerHTML)
  assert.strictEqual(guard.isDuplicate(editor, 'nova'), false)
}

function testInsertionPaths () {
  const { context, guard } = setup()
  context.assertSafeMessageBodyEditor = () => {}
  context.isPlainTextMessageBody = (editor) => editor.tagName === 'TEXTAREA'
  context.htmlToPlainText = (html) => html
  context.setPlainTextBodyValue = (editor, text) => { editor.value = text }
  context.dispatchBodyEvent = context.dispatchFieldEvent = () => {}
  context.HISTORY_SEPARATOR = 'HISTÓRICO'
  vm.runInContext(extract(indexSource, 'messageBodyContainsResponse'), context)
  vm.runInContext(extract(indexSource, 'insertResponseBeforeHistory'), context)
  for (const name of ['insertRequirementIntoBody', 'insertProcessCompletedResponse']) {
    vm.runInContext(extract(indexSource, name), context)
    for (const editor of [{ innerHTML: '<b>histórico intacto</b>', focus () {} }, { tagName: 'TEXTAREA', value: 'histórico intacto' }]) {
      context[name](editor, 'nova resposta')
      assert.ok((editor.value || editor.innerHTML).endsWith(editor.tagName ? 'histórico intacto' : '<b>histórico intacto</b>'))
      assert.throws(() => context[name](editor, 'nova resposta'), /já foi inserida/)
    }
  }
  vm.runInContext(extract(read('operational-p0-v3.js'), 'insertResponseBeforeHistory'), context)
  const editor = { innerHTML: '<b>antiga</b>', focus () {} }
  context.insertResponseBeforeHistory(editor, 'presencial')
  assert.strictEqual(guard.isDuplicate(editor, 'presencial'), true)
  assert.throws(() => context.insertResponseBeforeHistory(editor, 'presencial'), /já foi inserida/)
}

async function testHtmlReplay () {
  for (const ready of [true, false]) {
    let resolvePreparation
    let insertions = 0
    let handler
    const context = {
      bypass: new WeakSet(),
      pendingInsertions: new WeakSet(),
      isInsertionControl: (target) => target,
      deterministicHtmlEditor: () => false,
      deterministicPlainTextEditor: () => true,
      ensureHtmlComposer: () => new Promise((resolve) => { resolvePreparation = resolve }),
      setStatus: () => {},
      document: { addEventListener: (type, callback) => { handler = callback } }
    }
    const start = composeSource.indexOf("  document.addEventListener('click', async")
    const end = composeSource.indexOf('\n  }, true)', start) + '\n  }, true)'.length
    vm.runInNewContext(composeSource.slice(start, end), context)
    const event = (target) => ({ target, preventDefault () {}, stopPropagation () {}, stopImmediatePropagation () { this.blocked = true } })
    const control = {
      click () {
        const replay = event(control)
        handler(replay)
        if (!replay.blocked) insertions++
      }
    }
    const first = handler(event(control))
    await handler(event(control))
    resolvePreparation(ready)
    await first
    assert.strictEqual(insertions, 1, 'um único replay após HTML ou fallback')
    assert.strictEqual(context.bypass.has(control), false)
    assert.strictEqual(context.pendingInsertions.has(control), false)
  }
}

function testPresentationSkipsHistory () {
  const { context, guard } = setup()
  const old = { id: 'histórico' }
  const fresh = { id: 'nova resposta' }
  const formatted = []
  const editor = { innerHTML: 'nova + histórico', querySelectorAll: () => [fresh] }
  guard.recordInsertion(editor, 'nova')
  context.deterministicHtmlEditor = () => editor
  context.allDocuments = () => [{ querySelectorAll: () => [old, fresh] }]
  context.presentCatalogScript = context.presentStructuredResponse = (node) => formatted.push(node)
  vm.runInContext(extract(composeSource, 'formatPendingResponses'), context)
  context.formatPendingResponses()
  assert.ok(formatted.length > 0)
  assert.ok(formatted.every((node) => node === fresh), 'histórico nunca é reformatado')

  context.INTERNAL_RQ_LABEL = /REQUERIMENTO RÁPIDO/g
  context.clean = (value) => value.trim()
  old.querySelector = () => { throw new Error('não acessar conteúdo histórico') }
  fresh.querySelector = () => null
  vm.runInContext(extract(read('subject-sanitizer-v1.js'), 'sanitizeProcessCompletedResponses'), context)
  context.sanitizeProcessCompletedResponses()
}

async function testBoundedHtmlPreparation () {
  let attempts = 0
  let editor = {}
  const context = {
    attemptedPlainEditors: new WeakSet(),
    fastMailPanelExists: () => true,
    deterministicHtmlEditor: () => false,
    deterministicPlainTextEditor: () => editor,
    ensureHtmlComposer: async () => { attempts++; return false },
    candidateIsSafeToolbarControl: () => true,
    formatControl: () => null,
    elementText: (element) => element.text || ''
  }
  vm.createContext(context)
  vm.runInContext(extract(composeSource, 'normalizeWhenPanelAppears'), context)
  vm.runInContext(extract(composeSource, 'labeledFormatTarget'), context)
  vm.runInContext(extract(composeSource, 'nativeControlClickTargets'), context)
  const control = toolbarElement({ text: 'Texto simp', nextElementSibling: { click () { throw new Error('fechar resposta') } } })
  const targets = context.nativeControlClickTargets(control)
  assert.strictEqual(targets.length, 1)
  assert.strictEqual(targets[0], control)
  await context.normalizeWhenPanelAppears()
  assert.strictEqual(attempts, 0, 'barra ainda não carregada não consome tentativa')
  context.formatControl = () => control
  for (let i = 0; i < 20; i++) await context.normalizeWhenPanelAppears()
  assert.strictEqual(attempts, 1)
  editor = {}
  await context.normalizeWhenPanelAppears()
  assert.strictEqual(attempts, 2, 'novo compositor tem sua própria tentativa automática')
}

async function testOwaLabelInsideControl (arrowOnly = false) {
  let opened = false
  let html = false
  const clicks = []
  const toolbar = { text: 'Enviar Opções Texto simp', tagName: 'TD' }
  const format = toolbarElement({ text: 'Texto simp', tagName: 'TD', parentElement: toolbar })
  const label = toolbarElement({ text: 'Texto simp', tagName: 'SPAN', parentElement: format })
  const arrow = toolbarElement({
    tagName: 'IMG',
    getBoundingClientRect: () => ({ left: 184, right: 200, top: 14, bottom: 30, width: 16, height: 16 })
  })
  const outside = toolbarElement({
    tagName: 'BUTTON',
    getBoundingClientRect: () => ({ left: 205, right: 221, top: 14, bottom: 30, width: 16, height: 16 })
  })
  format.querySelectorAll = () => [arrow, outside]
  const option = { text: 'HTML', tagName: 'TD' }
  const optionLabel = { text: 'HTML', tagName: 'SPAN', parentElement: option }
  const context = {
    candidateIsSafeToolbarControl: () => true,
    visible: () => true,
    clean: (value) => String(value || '').trim(),
    elementText: (element) => element.text || '',
    nativeClick: (target) => {
      clicks.push(target)
      if (target === (arrowOnly ? arrow : format)) opened = true
      if (target === option && opened) html = true
    },
    visibleHtmlMenuOption: () => opened ? optionLabel : null,
    deterministicHtmlEditor: () => html ? { editable: true } : null,
    waitFor: async (getter) => getter()
  }
  vm.createContext(context)
  for (const name of ['labeledFormatTarget', 'nativeControlClickTargets', 'triggerFormatByNativeUi']) {
    vm.runInContext(extract(composeSource, name), context)
  }
  const result = await context.triggerFormatByNativeUi(label)
  assert.ok(result?.editable, 'clique chega à célula de formato e à opção HTML')
  assert.deepStrictEqual(clicks, arrowOnly ? [format, arrow, option] : [format, option])
  assert.strictEqual(clicks.includes(outside), false, 'nenhum botão externo ao seletor')
  assert.strictEqual(clicks.includes(toolbar), false)
  const orphan = { text: 'Texto simp', tagName: 'SPAN', parentElement: toolbar }
  assert.strictEqual(context.labeledFormatTarget(orphan), orphan, 'não subir até a barra')
  assert.strictEqual(context.labeledFormatTarget({ text: 'Fechar', tagName: 'BUTTON' }), null)
}

async function run () {
  testHistoryAndDoubleClick()
  testOnlyTechnicalAttributesRemoved()
  testInsertionPaths()
  testPresentationSkipsHistory()
  await testHtmlReplay()
  await testBoundedHtmlPreparation()
  await testOwaLabelInsideControl()
  await testOwaLabelInsideControl(true)
  console.log('FAST MAIL: novas respostas, histórico preservado, anti-duplo clique e replay HTML validados.')
}

run().catch((error) => { console.error(error); process.exitCode = 1 })
