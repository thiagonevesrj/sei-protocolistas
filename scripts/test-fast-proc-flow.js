/* eslint-env node */
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const root = path.resolve(__dirname, '..')

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const tick = () => new Promise((resolve) => setImmediate(resolve))

function testInterestedConfirmation () {
  const session = new Map()
  const listeners = new Map()
  const nativeMessages = []
  const context = {
    Date,
    document: {
      addEventListener: (eventName, callback) => {
        listeners.set(eventName, callback)
      }
    },
    sessionStorage: {
      getItem: (key) => session.get(key) || null,
      removeItem: (key) => session.delete(key)
    },
    confirm: (message) => {
      nativeMessages.push(message)
      return false
    }
  }
  context.window = context

  vm.runInNewContext(
    read('cs_modules/clique_protocolista/confirmarInclusaoInteressado.js'),
    context
  )

  session.set('spFastProcConfirmarInclusaoInteressado', String(Date.now()))
  assert.strictEqual(context.confirm('Nome inexistente. Deseja incluir?'), true)
  assert.strictEqual(session.has('spFastProcConfirmarInclusaoInteressado'), false)
  assert.deepStrictEqual(nativeMessages, [])

  listeners.get('sp-fast-proc-armar-inclusao-interessado')()
  assert.strictEqual(context.confirm('Nome inexistente. Deseja incluir?'), true)
  assert.deepStrictEqual(nativeMessages, [])

  assert.strictEqual(context.confirm('Deseja excluir o processo?'), false)
  assert.deepStrictEqual(nativeMessages, ['Deseja excluir o processo?'])

  session.set(
    'spFastProcConfirmarInclusaoInteressado',
    String(Date.now() - (11 * 60 * 1000))
  )
  assert.strictEqual(context.confirm('Nome inexistente. Deseja incluir?'), false)

  const fastProcSource = read('cs_modules/clique_protocolista/index.js')
  const armIndex = fastProcSource.indexOf(
    'sessionStorage.setItem(\n        INTERESTED_CONFIRM_KEY'
  )
  const selectIndex = fastProcSource.indexOf(
    'selectInterestedSuggestion(',
    armIndex
  )
  const clickIndex = fastProcSource.indexOf(
    'clickAddInterested(interested)',
    armIndex
  )

  assert.ok(armIndex >= 0)
  assert.ok(selectIndex > armIndex)
  assert.ok(clickIndex > armIndex)
  assert.ok(fastProcSource.includes('new CustomEvent(\n          INTERESTED_CONFIRM_EVENT'))

  const interceptorSource = read(
    'cs_modules/clique_protocolista/confirmarInclusaoInteressado.js'
  )
  assert.ok(interceptorSource.includes("const ARM_EVENT = 'sp-fast-proc-armar-inclusao-interessado'"))
  assert.ok(interceptorSource.includes('document.addEventListener(ARM_EVENT'))
}

function testFastMailOperatorFallback () {
  const source = read('cs_modules/fast_mail/index.js')

  assert.ok(source.includes('function validStoredOperator (value)'))
  assert.ok(source.includes('async function resolveOperator ()'))
  assert.ok(source.includes('const visibleOperator = findOperator()'))
  assert.ok(source.includes('const stored = await storageGet(OPERATOR_KEY)'))
  assert.ok(source.includes('const operator = await resolveOperator()'))
  assert.ok(source.includes('email !== expectedEmail'))
}

function testNativeAuthenticationAutomation () {
  const source = read('cs_modules/autenticacao_nativa/index.js')
  const manifest = read('manifest.json')

  assert.ok(source.includes("const SUCCESS_KEY = 'spAutenticacaoNativaConcluida'"))
  assert.ok(source.includes("const TOOLBAR_SELECTOR = '#divArvoreAcoes.barraBotoesSEI'"))
  assert.ok(source.includes('const handledPasswords = new WeakSet()'))
  assert.ok(source.includes("waitFor('#sp-fast-proc-rq')"))
  assert.ok(source.includes('function authenticationDialog ()'))
  assert.ok(source.includes("includes('autenticacao de documento')"))
  assert.ok(source.includes("buttonLabel(element) === 'assinar'"))
  assert.ok(source.includes('fillPassword(dialog.password, credentials.password)'))
  assert.ok(source.includes('dialog.sign.click()'))
  assert.ok(source.indexOf('dialog.sign.click()') < source.lastIndexOf('[SUCCESS_KEY]: {'))
  assert.ok(source.includes("toast.textContent = '✓ AUTENTICADO COM SUCESSO'"))
  assert.ok(source.includes('chrome.storage.onChanged.addListener'))
  assert.ok(source.includes('new MutationObserver'))
  assert.ok(source.includes('if (document.querySelector(TOOLBAR_SELECTOR))'))
  assert.ok(!source.includes("document.addEventListener('click'"))
  assert.ok(!source.includes("const PENDING_KEY = 'spAutenticacaoNativaPendente'"))
  assert.ok(!source.includes('sp-autenticacao-rapida'))
  assert.ok(!source.includes('createStampIcon'))
  assert.ok(manifest.includes('cs_modules/autenticacao_nativa/index.js'))
  assert.ok(!manifest.includes('cs_modules/autenticacao_rapida'))
  assert.ok(!fs.existsSync(path.join(root, 'cs_modules/autenticacao_rapida/index.js')))
  assert.ok(!fs.existsSync(path.join(root, 'cs_modules/autenticacao_rapida/styles.css')))
}

async function testNativeAuthenticationBehavior () {
  const storage = {
    centralProtocolistaSeiCredentials: {
      user: 'protocolista31',
      password: 'senha-teste',
      remember: true
    }
  }
  const storageListeners = []
  const mutationObservers = []
  let signClicks = 0
  let toastText = ''
  let dialogOpen = false

  class FakeInput {}
  Object.defineProperty(FakeInput.prototype, 'value', {
    configurable: true,
    get () { return this._value || '' },
    set (value) { this._value = value }
  })

  const visibleElement = (extra = {}) => ({
    ownerDocument: null,
    getBoundingClientRect: () => ({ width: 180, height: 36 }),
    getAttribute: () => '',
    ...extra
  })

  const password = Object.assign(
    Object.create(FakeInput.prototype),
    visibleElement({
      focus: () => {},
      dispatchEvent: () => {}
    })
  )
  const sign = visibleElement({
    textContent: 'Assinar',
    value: '',
    focus: () => {},
    click: () => { signClicks += 1 }
  })
  const quickRequest = {}
  const toolbar = {}

  const body = {
    innerText: '',
    appendChild: (element) => { toastText = element.textContent }
  }
  const documentMock = {
    body,
    defaultView: {
      getComputedStyle: () => ({ display: 'block', visibility: 'visible' })
    },
    documentElement: {},
    querySelector: (selector) => {
      if (selector === '#divArvoreAcoes.barraBotoesSEI') return toolbar
      if (selector === '#sp-fast-proc-rq') return quickRequest
      return null
    },
    querySelectorAll: (selector) => {
      if (!dialogOpen) return []
      if (selector.includes('#pwdSenha')) return [password]
      if (selector.startsWith('button,')) return [sign]
      return []
    },
    getElementById: () => null,
    createElement: () => ({
      classList: { add: () => {} },
      remove: () => {},
      setAttribute: () => {},
      style: { cssText: '' },
      textContent: ''
    })
  }
  password.ownerDocument = documentMock
  sign.ownerDocument = documentMock

  const notifyChanges = (changes) => {
    storageListeners.forEach((listener) => listener(changes, 'local'))
  }
  const context = {
    console,
    Date,
    Math,
    Node: { ELEMENT_NODE: 1 },
    Event: class Event {},
    HTMLInputElement: FakeInput,
    MutationObserver: class MutationObserver {
      constructor (callback) {
        this.callback = callback
        mutationObservers.push(this)
      }

      observe () {}
      disconnect () {}
    },
    document: documentMock,
    setTimeout: (callback) => { callback(); return 1 },
    clearTimeout: () => {},
    alert: () => {},
    chrome: {
      runtime: { lastError: null },
      storage: {
        local: {
          get: (keys, callback) => {
            const list = Array.isArray(keys) ? keys : [keys]
            callback(Object.fromEntries(list.map((key) => [key, storage[key]])))
          },
          set: (items, callback) => {
            const changes = Object.fromEntries(
              Object.entries(items).map(([key, value]) => [key, {
                oldValue: storage[key],
                newValue: value
              }])
            )
            Object.assign(storage, items)
            callback()
            notifyChanges(changes)
          },
          remove: (keys, callback) => {
            const list = Array.isArray(keys) ? keys : [keys]
            const changes = {}
            list.forEach((key) => {
              changes[key] = { oldValue: storage[key], newValue: undefined }
              delete storage[key]
            })
            callback()
            notifyChanges(changes)
          }
        },
        onChanged: {
          addListener: (listener) => storageListeners.push(listener)
        }
      }
    }
  }
  context.window = context

  vm.runInNewContext(
    read('cs_modules/autenticacao_nativa/index.js'),
    context
  )

  await tick()
  dialogOpen = true
  body.innerText = 'Autenticação de Documento'
  mutationObservers[0].callback()
  mutationObservers[0].callback()
  await tick()
  await tick()
  await tick()

  assert.strictEqual(password.value, 'senha-teste')
  assert.strictEqual(signClicks, 1)
  assert.strictEqual(toastText, '✓ AUTENTICADO COM SUCESSO')
}

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

function testFastMailHiddenFieldsStayHidden () {
  const styles = read('cs_modules/fast_mail/styles.css')

  assert.ok(styles.includes('#sei-protocolistas-fast-mail-status [hidden]'))
  assert.ok(styles.includes('display: none !important;'))
}

function testFastMailProgressiveNavigation () {
  const source = read('cs_modules/fast_mail/index.js')
  const styles = read('cs_modules/fast_mail/styles.css')

  assert.ok(source.includes('1. ESCOLHA A ÁREA'))
  assert.ok(source.includes('2. ESCOLHA O ASSUNTO'))
  assert.ok(source.includes('3. ESCOLHA A AÇÃO'))
  assert.ok(source.includes('id="spfm-topic-step" class="spfm-step" hidden'))
  assert.ok(source.includes('id="spfm-action-step" class="spfm-step" hidden'))
  assert.ok(source.includes('id="spfm-priority-missing"'))
  assert.ok(source.includes('DOCUMENTOS FALTANTES'))
  assert.ok(source.includes('function openPriorityMissingDocuments'))
  assert.ok(source.includes('id="spfm-process-setup" class="spfm-process-setup" hidden'))
  assert.ok(source.includes('priorityTopics.filter((topic) => topic.area === selectedPriorityAreaId)'))
  assert.ok(source.includes("if (areaId === 'taxas')"))
  assert.ok(source.includes("selectPriorityTopic('devolucao-taxas')"))
  assert.ok(read('data/catalogo-processos.json').includes('Genérico — Habilitação'))
  assert.ok(read('data/catalogo-processos.json').includes('Genérico — Veículos'))
  assert.ok(source.includes('box.hidden = !hasDocumentModel || activePriorityAction !== \'missing\''))
  assert.ok(source.indexOf('id="spfm-missing-box"') < source.indexOf('id="spfm-priority-status"'))
  assert.ok(source.indexOf('id="spfm-missing-box"') < source.indexOf('id="spfm-email-preparation"'))
  assert.ok(source.indexOf('id="spfm-email-preparation"') < source.indexOf('id="spfm-priority-status"'))
  assert.ok(source.includes("status.textContent = 'Exigência inserida. Agora prepare o e-mail.'"))
  const missingDocumentsFlow = source.slice(
    source.indexOf('function openPriorityMissingDocuments'),
    source.indexOf('function openPriorityProcess')
  )
  assert.ok(missingDocumentsFlow.includes('setEmailPreparationVisible(true)'))
  assert.ok(!missingDocumentsFlow.includes('setEmailPreparationVisible(false)'))
  const insertMissingRequirement = source.slice(
    source.indexOf('async function insertMissingDocumentsRequirement'),
    source.indexOf('function buildProcessCompletedResponseHtml')
  )
  assert.ok(!insertMissingRequirement.includes("throw new Error('Digite o nome do requerente.')"))
  assert.ok(source.includes('const greeting = safeName ? `Olá, ' + '$' + '{safeName}.` : \'Olá.\''))
  assert.ok(styles.includes('.spfm-area-grid'))
  assert.ok(styles.includes('width: min(370px, calc(100vw - 20px))'))
  assert.ok(styles.includes('.spfm-priority-workflow .spfm-check'))
  assert.ok(!source.includes('spfm-topic-button'))
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
  const completedResponse = source.slice(
    source.indexOf('function buildProcessCompletedResponseHtml'),
    source.indexOf('function insertProcessCompletedResponse')
  )
  assert.ok(completedResponse.includes('DADOS DO PROCESSO'))
  assert.ok(completedResponse.includes('Data de abertura:'))
  assert.ok(completedResponse.includes('COMO ACOMPANHAR'))
  assert.ok(completedResponse.includes('portalsei.rj.gov.br/pesquisaprocessualmunicipios'))
  assert.ok(completedResponse.includes('não representa a aprovação do pedido'))
  assert.ok(completedResponse.includes('art. 49 do Decreto SEI-RJ nº 48.209'))
  assert.ok(completedResponse.includes('Atendimento do Serviço de Protocolo<br>DETRAN-RJ'))
  assert.ok(completedResponse.includes('POR FAVOR, NÃO RESPONDA ESTE E-MAIL.'))
  assert.ok(completedResponse.includes('processModelSpecificHtml(responseModel)'))
  assert.ok(!completedResponse.includes('Protocolista nº'))
  assert.ok(completedResponse.includes(
    'const greeting = name ? `Olá, ' + '$' + "{name}.` : 'Olá.'"
  ))
  assert.ok(runtimeListener > automaticFunction)
  assert.ok(source.includes('await insertPendingProcessResponse(true)'))
  assert.ok(subjectUpdate > -1 && bodyInsertion > subjectUpdate)
  assert.ok(source.includes('await autoInsertPendingProcessResponse()'))
  assert.ok(source.includes("configuredModel === 'daf'"))
  assert.ok(source.includes("configuredModel === 'divmed'"))
  assert.ok(source.includes("areaId === 'veiculos'"))
  assert.ok(source.includes("areaId === 'taxas'"))
  assert.ok(source.includes("procedureId === 'devolucao-taxas'"))
  assert.ok(source.includes("procedureId === 'solicitacao-pericia-medica'"))
  assert.ok(source.includes('DAF.ANL@DETRAN.RJ.GOV.BR'))
  assert.ok(source.includes('atendimento.drv@detran.rj.gov.br'))
  assert.ok(source.includes('https://wa.me/552123320206'))
  const protocolSource = read('cs_modules/protocolo_cliente/index.js')
  assert.ok(protocolSource.includes("procedureId:context?.procedureId||''"))
  assert.ok(protocolSource.includes("areaId:context?.areaId||''"))
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

  const processLookup = source.indexOf(
    'const currentProcessId =\n      extractProcessId()'
  )
  const toolbarLookup = source.indexOf(
    'const target = await waitFor('
  )
  const contextGuard = source.indexOf(
    "if (!context) {\n        console.log(\n          '[FAST PROC RQ] Processo não identificado como FAST PROC.'",
    processLookup
  )

  assert.ok(processLookup > -1)
  assert.ok(contextGuard > processLookup)
  assert.ok(toolbarLookup > contextGuard)
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
  assert.ok(source.includes('const pinSaveToVisibleArea = () =>'))
  assert.ok(source.includes("'position',\n        'fixed'"))
  assert.ok(source.includes("'right',\n        '24px'"))
  assert.ok(source.includes("'z-index',\n        '1000'"))
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
  assert.ok(styles.includes("[aria-selected='true']"))
  assert.ok(styles.includes('background: #e0ae28 !important'))
  assert.ok(styles.includes('border-left: 5px solid #ffffff !important'))
  assert.ok(styles.includes('color: #071a33 !important'))
  assert.ok(styles.includes('font-weight: 800 !important'))

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
  testInterestedConfirmation()
  testFastMailOperatorFallback()
  testNativeAuthenticationAutomation()
  await testNativeAuthenticationBehavior()
  await testSeiAutoLogin()
  await testStartProcessNavigation()
  await testReturnToOriginalEmail()
  testCompactFastProcLayout()
  testFastMailHiddenFieldsStayHidden()
  testFastMailProgressiveNavigation()
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
