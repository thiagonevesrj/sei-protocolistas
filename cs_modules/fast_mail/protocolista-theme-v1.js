(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const api = typeof browser === 'undefined' ? chrome : browser
  const STORAGE_KEY = 'spProtocolistaThemeEnabledV1'
  const THEME_CLASS = 'sp-protocolista-theme'

  let themeEnabled = true

  const storageGet = (key) => new Promise((resolve) => {
    let settled = false
    const done = (items = {}) => {
      if (settled) return
      settled = true
      resolve(items || {})
    }

    try {
      const result = api.storage.local.get(key, done)
      if (result?.then) result.then(done, () => done({}))
    } catch (_) {
      done({})
    }
  })

  const storageSet = (items) => new Promise((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      resolve()
    }

    try {
      const result = api.storage.local.set(items, done)
      if (result?.then) result.then(done, done)
    } catch (_) {
      done()
    }
  })

  function updateToggleButton () {
    const button = document.querySelector('#spfm-theme-toggle')
    if (!button) return

    button.textContent = themeEnabled ? 'USAR OWA ORIGINAL' : 'ATIVAR TEMA PROTOCOLISTA'
    button.title = themeEnabled
      ? 'Desligar somente a camada visual do Tema Protocolista'
      : 'Ativar novamente a camada visual do Tema Protocolista'
    button.setAttribute('aria-pressed', String(themeEnabled))
    button.dataset.themeEnabled = String(themeEnabled)
  }

  function applyTheme (enabled) {
    themeEnabled = Boolean(enabled)
    document.documentElement.classList.toggle(THEME_CLASS, themeEnabled)
    document.documentElement.dataset.spProtocolistaTheme = themeEnabled ? 'on' : 'off'
    updateToggleButton()
  }

  async function toggleTheme () {
    const nextValue = !themeEnabled
    applyTheme(nextValue)
    await storageSet({ [STORAGE_KEY]: nextValue })
  }

  function installToggleButton () {
    const panel = document.querySelector('#sei-protocolistas-fast-mail-status')
    const body = panel?.querySelector('#spfm-panel-body')
    if (!body) return false

    let button = body.querySelector('#spfm-theme-toggle')
    if (!button) {
      button = document.createElement('button')
      button.id = 'spfm-theme-toggle'
      button.type = 'button'
      button.className = 'spfm-experience-button'
      button.addEventListener('click', toggleTheme)
      body.appendChild(button)
    }

    updateToggleButton()
    return true
  }

  async function init () {
    const stored = await storageGet(STORAGE_KEY)
    const enabled = typeof stored[STORAGE_KEY] === 'boolean'
      ? stored[STORAGE_KEY]
      : true

    applyTheme(enabled)

    const observer = new MutationObserver(() => installToggleButton())
    observer.observe(document.documentElement, { childList: true, subtree: true })
    installToggleButton()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true })
  } else {
    init()
  }
})()
