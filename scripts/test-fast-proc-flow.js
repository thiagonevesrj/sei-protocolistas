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

async function run () {
  await testSeiAutoLogin()
  await testStartProcessNavigation()
  await testReturnToOriginalEmail()
  testCompactFastProcLayout()
  testUnusedSeiFieldsAreHidden()
  testAutomaticEmailCompletion()
  console.log('Fluxo FAST MAIL → SEI → FAST PROC → e-mail original validado.')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
