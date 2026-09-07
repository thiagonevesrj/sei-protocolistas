(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const api = typeof browser === 'undefined' ? chrome : browser
  const STORAGE_KEY = 'spOwaProtocolistaThemeV2Enabled'
  const THEME_CLASS = 'sp-owa-protocolista-v2'
  const ROOT_ID = 'sp-owa-protocolista-theme-v2-root'

  let enabled = true

  function storageGet (key) {
    return new Promise((resolve) => {
      let finished = false
      const done = (items = {}) => {
        if (finished) return
        finished = true
        resolve(items || {})
      }

      try {
        const result = api.storage.local.get(key, done)
        if (result?.then) result.then(done, () => done({}))
      } catch (_) {
        done({})
      }
    })
  }

  function storageSet (items) {
    return new Promise((resolve) => {
      let finished = false
      const done = () => {
        if (finished) return
        finished = true
        resolve()
      }

      try {
        const result = api.storage.local.set(items, done)
        if (result?.then) result.then(done, done)
      } catch (_) {
        done()
      }
    })
  }

  function visible (element) {
    if (!element || !element.isConnected) return false
    const view = element.ownerDocument?.defaultView || window
    const style = view.getComputedStyle(element)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }

  function extensionOwned (element) {
    return Boolean(element?.closest?.(
      '#sei-protocolistas-fast-mail-status, [id^="spfm-"], #sp-owa-protocolista-theme-v2-root'
    ))
  }

  function cleanText (element) {
    return String(element?.innerText || element?.textContent || element?.value || '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function candidatesByText (matcher) {
    return Array.from(document.querySelectorAll('a, button, span, div, td'))
      .filter((element) => {
        if (!visible(element) || extensionOwned(element)) return false
        const text = cleanText(element)
        return text && text.length < 80 && matcher.test(text)
      })
  }

  function firstByText (matcher, predicate = () => true) {
    return candidatesByText(matcher).find(predicate) || null
  }

  function commonAncestor (elements) {
    const valid = elements.filter(Boolean)
    if (!valid.length) return null

    let node = valid[0]
    while (node && node !== document.documentElement) {
      if (valid.every((element) => node.contains(element))) return node
      node = node.parentElement
    }
    return null
  }

  function climbForBox (element, predicate, maxSteps = 7) {
    let node = element
    let steps = 0

    while (node && node !== document.body && steps <= maxSteps) {
      if (extensionOwned(node)) return null
      const rect = node.getBoundingClientRect()
      if (predicate(rect, node)) return node
      node = node.parentElement
      steps += 1
    }

    return null
  }

  function markHeader () {
    const logout = firstByText(/^terminar sess[aã]o$/i, (element) => element.getBoundingClientRect().top < 110)
    const account = firstByText(/^Protocolista\s+\d+$/i, (element) => element.getBoundingClientRect().top < 110)
    const anchor = commonAncestor([logout, account]) || logout || account
    if (!anchor) return

    const header = climbForBox(anchor, (rect) => (
      rect.top < 90 &&
      rect.width > window.innerWidth * 0.55 &&
      rect.height >= 24 &&
      rect.height <= 100
    ), 8)

    header?.classList.add('sp-owa-v2-header-zone')
  }

  function markToolbar () {
    const novo = firstByText(/^Novo\s*$/i, (element) => element.getBoundingClientRect().top < 260)
    const eliminar = firstByText(/^Eliminar\s*$/i, (element) => element.getBoundingClientRect().top < 260)
    const mover = firstByText(/^Mover\s*$/i, (element) => element.getBoundingClientRect().top < 260)
    const anchor = commonAncestor([novo, eliminar, mover])
    if (!anchor) return

    const toolbar = climbForBox(anchor, (rect) => (
      rect.width > 260 &&
      rect.height >= 28 &&
      rect.height <= 95 &&
      rect.top < 280
    ), 5) || anchor

    toolbar.classList.add('sp-owa-v2-toolbar-zone')
  }

  function markNavigation () {
    const favoritos = firstByText(/^Favoritos$/i, (element) => {
      const rect = element.getBoundingClientRect()
      return rect.left < 320 && rect.top < window.innerHeight * 0.55
    })
    if (!favoritos) return

    const nav = climbForBox(favoritos, (rect) => (
      rect.left < 60 &&
      rect.width >= 150 &&
      rect.width <= 380 &&
      rect.height > 220
    ), 9)

    nav?.classList.add('sp-owa-v2-nav-zone')
  }

  function markSearch () {
    const fields = Array.from(document.querySelectorAll('input, textarea'))
      .filter((field) => visible(field) && !extensionOwned(field))

    const search = fields.find((field) => {
      const hint = `${field.placeholder || ''} ${field.value || ''} ${field.getAttribute('aria-label') || ''}`
      return /Procurar|Pesquisar/i.test(hint)
    })

    search?.classList.add('sp-owa-v2-search-field')
    search?.parentElement?.classList.add('sp-owa-v2-search-wrap')
  }

  function markMessageChrome () {
    const para = firstByText(/^Para:\s*$/i, (element) => element.getBoundingClientRect().left > 500)
    const anexos = firstByText(/^Anexos:\s*$/i, (element) => element.getBoundingClientRect().left > 500)
    const anchor = commonAncestor([para, anexos]) || para || anexos
    if (!anchor) return

    const chrome = climbForBox(anchor, (rect) => (
      rect.left > window.innerWidth * 0.28 &&
      rect.width > window.innerWidth * 0.35 &&
      rect.height >= 50 &&
      rect.height <= 260
    ), 7)

    chrome?.classList.add('sp-owa-v2-message-chrome')
  }

  function decorateOwa () {
    if (!document.body) return
    markHeader()
    markToolbar()
    markNavigation()
    markSearch()
    markMessageChrome()
  }

  function ensureControl () {
    if (!document.body) return null

    let root = document.getElementById(ROOT_ID)
    if (root) return root

    root = document.createElement('div')
    root.id = ROOT_ID
    root.setAttribute('role', 'group')
    root.setAttribute('aria-label', 'Tema Protocolista')
    root.innerHTML = `
      <div class="sp-owa-v2-brand">
        <strong>SEI PROTOCOLISTAS ❄</strong>
        <span>⚡ FAST MAIL</span>
      </div>
      <button id="sp-owa-protocolista-theme-v2-toggle" type="button"></button>`

    root.querySelector('button')?.addEventListener('click', async () => {
      applyTheme(!enabled)
      await storageSet({ [STORAGE_KEY]: enabled })
    })

    document.body.appendChild(root)
    return root
  }

  function updateControl () {
    const root = ensureControl()
    const button = root?.querySelector('#sp-owa-protocolista-theme-v2-toggle')
    if (!root || !button) return

    root.dataset.themeEnabled = String(enabled)
    button.setAttribute('aria-pressed', String(enabled))
    button.textContent = enabled ? 'OWA ORIGINAL' : 'ATIVAR TEMA'
    button.title = enabled
      ? 'Desligar somente a camada visual Protocolista'
      : 'Ativar novamente o Tema Protocolista'
  }

  function applyTheme (nextEnabled) {
    enabled = Boolean(nextEnabled)
    document.documentElement.classList.toggle(THEME_CLASS, enabled)
    document.documentElement.dataset.spOwaProtocolistaThemeV2 = enabled ? 'on' : 'off'
    updateControl()
    if (enabled) decorateOwa()
  }

  async function init () {
    const stored = await storageGet(STORAGE_KEY)
    const initial = typeof stored[STORAGE_KEY] === 'boolean'
      ? stored[STORAGE_KEY]
      : true

    ensureControl()
    applyTheme(initial)

    ;[250, 700, 1500, 2800].forEach((delay) => {
      window.setTimeout(() => {
        if (enabled) decorateOwa()
      }, delay)
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true })
  } else {
    init()
  }
})()
