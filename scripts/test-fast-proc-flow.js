/* eslint-env node */
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const root = path.resolve(__dirname, '..')

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const tick = () => new Promise((resolve) => setImmediate(resolve))

async function testSeiAutoLogin () {
  const values = { user: '', password: '' }
  let submitted = 0
  const form = { requestSubmit: () => { submitted += 1 } }
  const user = {
    focus: () => {},
    closest: () => form,
    dispatchEvent: () => {},
    get value () { return values.user },
    set value (value) { values.user = value }
  }
  const password = {
    focus: () => {},
    closest: () => form,
    dispatchEvent: () => {},
    get value () { return values.password },
    set value (value) { values.password = value }
  }
  const selectors = {
    '#txtUsuario': user,
    '#pwdSenha': password
  }
  const session = new Map()
  const context = {
    console,
    Event: class Event {},
    document: { querySelector: (selector) => selectors[selector] || null },
    sessionStorage: {
      getItem: (key) => session.get(key) || null,
      setItem: (key, value) => session.set(key, value)
    },
    chrome: {
      runtime: { lastError: null },
      storage: {
        local: {
          get: (key, respond) => respond({
            [key]: { user: 'protocolista31', password: 'senha-teste', remember: true }
          })
        }
      }
    },
    setTimeout: (callback) => callback()
  }
  context.window = context

  vm.runInNewContext(read('cs_modules/core/login/index.js'), context)
  await tick()

  assert.strictEqual(values.user, 'protocolista31')
  assert.strictEqual(values.password, 'senha-teste')
  assert.strictEqual(submitted, 1)
}

async function testStartProcessNavigation () {
  let clicked = 0
  const startLink = { click: () => { clicked += 1 } }
  const context = {
    console,
    URLSearchParams,
    location: {
      pathname: '/sei/controlador.php',
      search: '?acao=procedimento_controlar'
    },
    document: {
      documentElement: {},
      querySelector: (selector) => selector.includes('procedimento_escolher_tipo') ? startLink : null,
      querySelectorAll: () => []
    },
    MutationObserver: class MutationObserver {
      observe () {}
      disconnect () {}
    },
    chrome: {
      runtime: { lastError: null },
      storage: {
        local: {
          get: (key, respond) => respond({
            [key]: {
              source: 'fast-mail',
              createdAt: Date.now(),
              expiresAt: Date.now() + 60000
            }
          })
        }
      }
    },
    setTimeout: () => {}
  }
  context.window = context
  context.top = context

  vm.runInNewContext(read('cs_modules/fast_proc_handoff/index.js'), context)
  await tick()

  assert.strictEqual(clicked, 1)
}

async function testReturnToOriginalEmail () {
  let listener
  let activeTabId = null
  let focusedWindowId = null
  let notifiedMessage = null
  const stored = {}
  const tabs = new Map([[31, { id: 31, windowId: 7, url: 'https://venus2.detran.rj.gov.br/owa/email-original' }]])
  const chrome = {
    runtime: {
      lastError: null,
      onMessage: {
        addListener: (callback) => { listener = callback }
      }
    },
    storage: {
      local: {
        get: (key, respond) => respond({ [key]: stored[key] }),
        set: (items, respond) => {
          Object.assign(stored, items)
          respond()
        }
      }
    },
    tabs: {
      get: (tabId, respond) => respond(tabs.get(tabId)),
      create: (options, respond) => respond({ id: 32, windowId: 7, url: options.url }),
      update: (tabId, options, respond) => {
        if (options.active) activeTabId = tabId
        respond(tabs.get(tabId))
      },
      sendMessage: (tabId, message, respond) => {
        notifiedMessage = { tabId, message }
        respond({ ok: true })
      }
    },
    windows: {
      update: (windowId, options, respond) => {
        if (options.focused) focusedWindowId = windowId
        respond({ id: windowId })
      }
    }
  }

  vm.runInNewContext(read('background/service-worker.js'), { chrome, console, Date, Promise })

  const send = (message, sender = {}) => new Promise((resolve) => {
    const asyncResponse = listener(message, sender, resolve)
    assert.strictEqual(asyncResponse, true)
  })

  const attendanceId = 'atendimento-31'
  const registered = await send({
    type: 'sei-protocolistas:register-fast-mail-origin',
    attendanceId,
    email: 'cliente@example.com',
    url: 'https://venus2.detran.rj.gov.br/owa/email-original',
    createdAt: Date.now(),
    expiresAt: Date.now() + 60000
  }, { tab: tabs.get(31) })

  assert.strictEqual(registered.ok, true)
  assert.strictEqual(stored.fastMailAttendanceRoutes[attendanceId].tabId, 31)

  const returned = await send({
    type: 'sei-protocolistas:return-fast-mail',
    attendanceId
  })

  assert.strictEqual(returned.ok, true)
  assert.strictEqual(activeTabId, 31)
  assert.strictEqual(focusedWindowId, 7)
  assert.strictEqual(notifiedMessage.tabId, 31)
  assert.strictEqual(notifiedMessage.message.type, 'sei-protocolistas:process-result-ready')
  assert.strictEqual(notifiedMessage.message.attendanceId, attendanceId)
}

function testCompactFastProcLayout () {
  const source = read('cs_modules/clique_protocolista/index.js')
  const styles = read('cs_modules/clique_protocolista/styles.css')
  const emailPosition = source.indexOf('name: \'email\'')
  const destinationPosition = source.indexOf('name: \'destino\'')
  const phonePosition = source.indexOf('name: \'telefone\'')
  const optionalPosition = source.indexOf('const optionalDetails')

  assert.ok(emailPosition > -1 && emailPosition < destinationPosition)
  assert.ok(destinationPosition < phonePosition && phonePosition < optionalPosition)
  assert.ok(source.includes('createElement(\'details\''))
  assert.ok(source.includes('Mais informações — DUDA, placa, processo, ofício e outros'))
  assert.ok(!/open: 'open'/.test(source))
  assert.ok(styles.includes('.sp-clique-actions'))
  assert.ok(styles.includes('position: sticky'))
}

function testUnusedSeiFieldsAreHidden () {
  const source = read('cs_modules/clique_protocolista/index.js')
  const hideFunction = source.indexOf('function hideUnusedProcessFields')
  const fillFunction = source.indexOf('async function fillProcessForm')
  const hideCall = source.indexOf('hideUnusedProcessFields()', fillFunction)

  assert.ok(hideFunction > -1 && hideFunction < fillFunction)
  assert.ok(hideCall > fillFunction)
  assert.ok(source.includes('#optProtocoloAutomatico'))
  assert.ok(source.includes('#selGrauPrioridade'))
  assert.ok(source.includes("'display',\n          'none',\n          'important'"))
}

function testAutomaticEmailCompletion () {
  const source = read('cs_modules/fast_mail/index.js')
  const automaticFunction = source.indexOf('async function autoInsertPendingProcessResponse')
  const runtimeListener = source.indexOf('api.runtime.onMessage.addListener')
  const subjectUpdate = source.indexOf('if (!finalizeSubjectWithProcessResult(payload))')
  const bodyInsertion = source.indexOf('insertProcessCompletedResponse(', subjectUpdate)

  assert.ok(automaticFunction > -1)
  assert.ok(runtimeListener > automaticFunction)
  assert.ok(source.includes('await insertPendingProcessResponse(true)'))
  assert.ok(subjectUpdate > -1 && bodyInsertion > subjectUpdate)
  assert.ok(source.includes('await autoInsertPendingProcessResponse()'))
}

function testHighlightedQuickRequestButton () {
  const source = read('cs_modules/requerimento_rapido/index.js')
  const styles = read('cs_modules/requerimento_rapido/styles.css')

  assert.ok(source.includes("QUICK_REQUEST_LABEL = 'REQUERIMENTO RÁPIDO'"))
  assert.ok(source.includes("QUICK_REQUEST_LOADING_LABEL = 'ABRINDO...'"))
  assert.ok(source.includes("button.id = 'sp-fast-proc-rq'"))
  assert.ok(styles.includes('min-width: 222px'))
  assert.ok(styles.includes('border: 2px solid #e0ae28'))
  assert.ok(source.includes('function resetRqButton (button)'))
  assert.ok(source.includes('browserApi.storage?.onChanged'))
  assert.ok(source.includes('!changes[PENDING_KEY].newValue'))
}

function testExternalDocumentFieldsAreCollapsed () {
  const source = read(
    'cs_modules/documento_receber/autopreencherDocumentoExterno.js'
  )

  assert.ok(source.includes('\'[id*="Remetente"]\''))
  assert.ok(source.includes('\'[id*="Assunto"]\''))
  assert.ok(source.includes('\'input:not([type="hidden"]), \''))
  assert.ok(source.includes('section.style.setProperty('))
  assert.ok(source.includes('\'display\','))
  assert.ok(source.includes('\'none\','))
  assert.ok(source.includes('\'important\''))
  assert.ok(source.includes('function clearForArchiving'))
  assert.ok(source.includes('function hideAutomaticDocumentFields'))
  assert.ok(source.includes('function hideDocumentFieldGroup'))
  assert.ok(source.includes('function hideAccessLevelFieldset'))
  assert.ok(source.includes("accessControl?.closest('fieldset')"))
  assert.ok(source.includes("accessLegend?.closest('fieldset')"))
  assert.ok(source.includes("'Hipótese Legal'"))
  assert.ok(source.includes("'height',"))
  assert.ok(source.includes("'margin',"))
  assert.ok(source.includes("'padding',"))
  assert.ok(source.includes(
    'function collapseEmptyAutomaticFieldAncestors'
  ))
  assert.ok(source.includes(
    "'data-sei-protocolistas-collapsed'"
  ))
  assert.ok(source.includes(
    "'campos-automaticos-vazios'"
  ))
  assert.ok(source.includes('\'Para arquivamento\''))
  assert.ok(source.includes('\'Tipo de Conferência\''))
  assert.ok(source.includes('\'Nível de Acesso\''))
  assert.ok(source.includes('digitalizado,'))
  assert.ok(source.includes('documentoOriginal,'))
  assert.ok(source.includes('restrito,'))
  assert.ok(source.includes('informacaoPessoal'))
}

function testQuickRequestToolbarIsHiddenAfterFill () {
  const source = read(
    'cs_modules/documento_receber/autopreencherDocumentoExterno.js'
  )

  const hideFunction = source.indexOf(
    'function hideQuickRequestToolbar'
  )
  const automaticFieldsCall = source.lastIndexOf(
    'hideAutomaticDocumentFields('
  )
  const toolbarCall = source.lastIndexOf(
    'hideQuickRequestToolbar()'
  )

  assert.ok(hideFunction > -1)
  assert.ok(source.includes("'#sp-fast-proc-rq'"))
  assert.ok(source.includes('targetWindow.frames.length'))
  assert.ok(source.includes('iconLinks.length >= 8'))
  assert.ok(source.includes(
    "'barra-processo-apos-requerimento-rapido'"
  ))
  assert.ok(toolbarCall > automaticFieldsCall)
}

function testExternalDocumentHeaderIsCompact () {
  const source = read(
    'cs_modules/documento_receber/autopreencherDocumentoExterno.js'
  )

  assert.ok(source.includes('function compactDocumentHeader'))
  assert.ok(source.includes('row.id = \'sp-documento-header-row\''))
  assert.ok(source.includes('\'display:flex\''))
  assert.ok(source.includes('\'flex-wrap:nowrap\''))
  assert.ok(source.includes('\'justify-content:space-between\''))
  assert.ok(source.includes("'white-space',"))
  assert.ok(source.includes("'nowrap',"))
  assert.ok(source.includes(
    'function compactDocumentHeader'
  ))
  assert.ok(source.includes(
    'const fitHeaderToVisibleArea = () =>'
  ))
  assert.ok(source.includes(
    'document.documentElement.clientWidth'
  ))
  assert.ok(source.includes(
    'row.getBoundingClientRect().left'
  ))
  assert.ok(source.includes(
    'const safeRightGap = 24'
  ))
  assert.ok(source.includes(
    "window.addEventListener(\n      'resize',"
  ))
  assert.ok(!source.includes('calc(100vw - 24px)'))
  assert.ok(source.includes(
    "'0 0 0 auto'"
  ))
  assert.ok(source.includes('compactDocumentHeader()'))
}

function testExternalDocumentSaveIsHighlighted () {
  const source = read(
    'cs_modules/documento_receber/autopreencherDocumentoExterno.js'
  )

  assert.ok(source.includes('function highlightExternalDocumentSave'))
  assert.ok(source.includes("saveButton.value = '⚡ SALVAR'"))
  assert.ok(source.includes("saveButton.textContent = '⚡ SALVAR'"))
  assert.ok(source.includes("['background', '#061a39']"))
  assert.ok(source.includes("['border', '2px solid #e0ae28']"))
  assert.ok(source.includes('highlightExternalDocumentSave()'))
}

function testPrimarySaveLabelIsUnified () {
  const source = read('cs_modules/clique_protocolista/index.js')
  const styles = read('cs_modules/clique_protocolista/styles.css')

  assert.ok(source.includes("saveButton.textContent = 'SALVAR'"))
  assert.ok(source.includes("saveButton.value = '⚡ SALVAR'"))
  assert.ok(styles.includes('white-space: nowrap !important'))
}

function testProcessTypeUsesOneSearchableField () {
  const source = read('cs_modules/clique_protocolista/index.js')
  const styles = read('cs_modules/clique_protocolista/styles.css')

  assert.ok(source.includes('function matchesProcessTypeQuery'))
  assert.ok(source.includes('optionTerm.includes(queryTerm)'))
  assert.ok(source.includes("className: 'sp-clique-type-options'"))
  assert.ok(source.includes("role: 'listbox'"))
  assert.ok(source.includes('renderTypeSuggestions'))
  assert.ok(source.includes('visibleTypeOptions[activeTypeOptionIndex]'))
  assert.ok(source.includes('function processTypeNavigationKey'))
  assert.ok(source.includes('function nextProcessTypeOptionIndex'))
  assert.ok(source.includes("'aria-activedescendant'"))
  assert.ok(source.includes('event.stopPropagation()'))
  assert.ok(source.includes('    }, true)'))
  assert.ok(source.includes('typeSelect.hidden = true'))
  assert.ok(source.includes('matchingTypeOptions'))
  assert.ok(source.includes(".querySelector('#sp-tipo-processo-pesquisa')"))
  assert.ok(styles.includes('#sp-tipo-processo[hidden]'))
  assert.ok(styles.includes('.sp-clique-type-option--active'))

  const normalizeStart = source.indexOf('  function normalize(value)')
  const matcherEnd = source.indexOf('\n  function getAction()', normalizeStart)
  const matcherSource = source.slice(normalizeStart, matcherEnd)
  const context = { result: null }

  vm.runInNewContext(
    `${matcherSource}\nresult = matchesProcessTypeQuery`,
    context
  )

  assert.strictEqual(
    context.result('Devolução de Taxas', 'dev taxas'),
    true
  )
  assert.strictEqual(
    context.result('Solicitação Geral - Habilitação', 'sol hab'),
    true
  )
  assert.strictEqual(
    context.result('Devolução de Taxas', 'tax dev'),
    false
  )

  const navigationStart = source.indexOf(
    '  function processTypeNavigationKey'
  )
  const navigationEnd = source.indexOf(
    '\n  function getAction()',
    navigationStart
  )
  const navigationSource = source.slice(
    navigationStart,
    navigationEnd
  )
  const navigationContext = {
    navigationKey: null,
    nextIndex: null
  }

  vm.runInNewContext(
    `${navigationSource}\n` +
      'navigationKey = processTypeNavigationKey;\n' +
      'nextIndex = nextProcessTypeOptionIndex;',
    navigationContext
  )

  assert.strictEqual(
    navigationContext.navigationKey({ key: 'ArrowDown' }),
    'ArrowDown'
  )
  assert.strictEqual(
    navigationContext.navigationKey({ keyCode: 40 }),
    'ArrowDown'
  )
  assert.strictEqual(
    navigationContext.navigationKey({ which: 13 }),
    'Enter'
  )
  assert.strictEqual(navigationContext.nextIndex(-1, 2, 1), 0)
  assert.strictEqual(navigationContext.nextIndex(0, 2, 1), 1)
  assert.strictEqual(navigationContext.nextIndex(1, 2, -1), 0)
}

function testInterestedAutocompleteIsReleased () {
  const source = read('cs_modules/clique_protocolista/index.js')

  assert.ok(source.includes('function closeInterestedSuggestions'))
  assert.ok(source.includes("key: 'Escape'"))
  assert.ok(source.includes("autocomplete('close')"))
  assert.ok(source.includes('interestedField.blur()'))
  assert.ok(source.includes('saveButton.focus({ preventScroll: true })'))
}

async function run () {
  await testSeiAutoLogin()
  await testStartProcessNavigation()
  await testReturnToOriginalEmail()
  testCompactFastProcLayout()
  testUnusedSeiFieldsAreHidden()
  testAutomaticEmailCompletion()
  testHighlightedQuickRequestButton()
  testExternalDocumentFieldsAreCollapsed()
  testQuickRequestToolbarIsHiddenAfterFill()
  testExternalDocumentHeaderIsCompact()
  testExternalDocumentSaveIsHighlighted()
  testPrimarySaveLabelIsUnified()
  testProcessTypeUsesOneSearchableField()
  testInterestedAutocompleteIsReleased()
  console.log('Fluxo FAST MAIL → SEI → FAST PROC → e-mail original validado.')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
