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

async function run () {
  await testSeiAutoLogin()
  await testStartProcessNavigation()
  console.log('Fluxo FAST MAIL → SEI → FAST PROC validado.')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
