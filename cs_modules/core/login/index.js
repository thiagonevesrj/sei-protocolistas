(() => {
  'use strict'

  const api = typeof browser === 'undefined' ? chrome : browser
  const CREDENTIALS_KEY = 'centralProtocolistaSeiCredentials'
  const ATTEMPT_KEY = 'seiProtocolistasSeiLoginAttempt'

  const storageGet = (key) => new Promise((resolve, reject) => {
    const result = api.storage.local.get(key, (items) => {
      const error = api.runtime?.lastError
      if (error) reject(error)
      else resolve(items || {})
    })
    if (result?.then) result.then(resolve, reject)
  })

  function findFirst (selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector)
      if (element) return element
    }
    return null
  }

  function fill (field, value) {
    field.focus()
    field.value = value
    ;['input', 'change', 'keyup', 'blur'].forEach((eventName) => {
      field.dispatchEvent(new Event(eventName, { bubbles: true }))
    })
  }

  async function autoLogin () {
    const user = findFirst([
      '#txtUsuario',
      'input[name="txtUsuario"]',
      'input[autocomplete="username"]',
      'input[name*="usuario" i]'
    ])
    const password = findFirst([
      '#pwdSenha',
      'input[name="pwdSenha"]',
      'input[type="password"]'
    ])

    if (!user || !password) return

    const credentials = (await storageGet(CREDENTIALS_KEY))[CREDENTIALS_KEY]
    if (!credentials?.remember || !credentials.user || !credentials.password) return

    const previousAttempt = Number(sessionStorage.getItem(ATTEMPT_KEY) || 0)
    if (Date.now() - previousAttempt < 30000) return
    sessionStorage.setItem(ATTEMPT_KEY, String(Date.now()))

    fill(user, credentials.user)
    fill(password, credentials.password)

    const form = password.closest('form') || user.closest('form')
    const submit = findFirst([
      '#sbmLogin',
      'button[type="submit"]',
      'input[type="submit"]'
    ])

    window.setTimeout(() => {
      if (submit) submit.click()
      else if (form?.requestSubmit) form.requestSubmit()
      else form?.submit?.()
    }, 150)
  }

  autoLogin().catch((error) => {
    console.error('[SEI Protocolistas] Falha no login automático do SEI:', error)
  })
})()
