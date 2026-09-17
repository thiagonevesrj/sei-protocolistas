(() => {
  'use strict'

  const CREDENTIALS_KEY = 'centralProtocolistaSeiCredentials'
  const SUCCESS_KEY = 'spAutenticacaoNativaConcluida'
  const LEGACY_KEYS = [
    'spAutenticacaoNativaPendente',
    'spAutenticacaoRapidaPendente'
  ]
  const TOOLBAR_SELECTOR = '#divArvoreAcoes.barraBotoesSEI'
  const handledPasswords = new WeakSet()

  function storageGet (keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => {
        resolve(chrome.runtime.lastError ? {} : result)
      })
    })
  }

  function storageSet (items) {
    return new Promise((resolve) => {
      chrome.storage.local.set(items, resolve)
    })
  }

  function storageRemove (keys) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(keys, resolve)
    })
  }

  function normalize (value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  }

  function isVisible (element) {
    if (!element) return false
    const view = element.ownerDocument?.defaultView || window
    const style = view.getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      rect.width > 0 &&
      rect.height > 0
  }

  function buttonLabel (element) {
    return normalize(
      element.textContent ||
      element.value ||
      element.getAttribute?.('title') ||
      element.getAttribute?.('aria-label')
    )
  }

  function authenticationDialog () {
    if (!document.body || !normalize(document.body.innerText).includes('autenticacao de documento')) {
      return null
    }

    const passwords = Array.from(document.querySelectorAll(
      '#pwdSenha, input[name="pwdSenha"], input[type="password"], ' +
      'input[id*="senha" i], input[name*="senha" i]'
    ))
    const password = passwords.find(isVisible)
    if (!password) return null

    const controls = Array.from(document.querySelectorAll(
      'button, input[type="button"], input[type="submit"], a'
    ))
    const sign = controls.find((element) =>
      isVisible(element) && buttonLabel(element) === 'assinar'
    )

    return sign ? { password, sign } : null
  }

  function fillPassword (field, password) {
    field.focus()
    const prototype = window.HTMLInputElement?.prototype
    const setter = prototype && Object.getOwnPropertyDescriptor(prototype, 'value')?.set
    if (setter) setter.call(field, password)
    else field.value = password

    ;['input', 'change', 'keyup'].forEach((eventName) => {
      field.dispatchEvent(new Event(eventName, { bubbles: true }))
    })
  }

  async function completeAuthentication () {
    const dialog = authenticationDialog()
    if (!dialog || handledPasswords.has(dialog.password)) return false

    handledPasswords.add(dialog.password)
    const stored = await storageGet(CREDENTIALS_KEY)
    const credentials = stored[CREDENTIALS_KEY]
    if (!credentials?.remember || !credentials.password) {
      handledPasswords.delete(dialog.password)
      return false
    }

    fillPassword(dialog.password, credentials.password)
    window.setTimeout(async () => {
      dialog.sign.focus()
      dialog.sign.click()
      await storageSet({
        [SUCCESS_KEY]: {
          at: Date.now(),
          nonce: Math.random()
        }
      })
    }, 180)

    return true
  }

  function waitFor (selector, timeout = 5000) {
    const existing = document.querySelector(selector)
    if (existing) return Promise.resolve(existing)

    return new Promise((resolve) => {
      if (!document.documentElement) return resolve(null)

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector)
        if (!element) return
        observer.disconnect()
        window.clearTimeout(timer)
        resolve(element)
      })
      observer.observe(document.documentElement, { childList: true, subtree: true })

      const timer = window.setTimeout(() => {
        observer.disconnect()
        resolve(null)
      }, timeout)
    })
  }

  async function showSuccessPopup () {
    const quickRequest = await waitFor('#sp-fast-proc-rq')
    if (!quickRequest || document.getElementById('sp-auth-native-success')) return false

    const toast = document.createElement('div')
    toast.id = 'sp-auth-native-success'
    toast.textContent = '✓ AUTENTICADO COM SUCESSO'
    toast.setAttribute('role', 'status')
    toast.style.cssText = [
      'position:fixed',
      'top:16px',
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:2147483647',
      'padding:12px 22px',
      'border:1px solid #39d98a',
      'border-radius:8px',
      'background:#087f4f',
      'color:#fff',
      'font:700 14px Roboto,Arial,sans-serif',
      'box-shadow:0 4px 18px rgba(0,0,0,.45)'
    ].join(';')
    document.body.appendChild(toast)
    await storageRemove(SUCCESS_KEY)
    window.setTimeout(() => toast.remove(), 2000)
    return true
  }

  function observeAuthenticationDialog () {
    if (!document.body) return
    const observer = new MutationObserver(() => {
      completeAuthentication()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    completeAuthentication()
  }

  async function init () {
    await storageRemove(LEGACY_KEYS)

    const stored = await storageGet(SUCCESS_KEY)
    if (stored[SUCCESS_KEY]) showSuccessPopup()

    if (document.querySelector(TOOLBAR_SELECTOR)) {
      observeAuthenticationDialog()
      return
    }

    completeAuthentication()
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[SUCCESS_KEY]?.newValue) {
      showSuccessPopup()
    }
  })

  init()
})()
