(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  // BLINDAGEM DO COMPOSITOR OWA:
  // A janela Responder/Encaminhar usa controles nativos legados para alternar
  // Texto simples -> HTML. O FAST MAIL possui um mecanismo validado que reproduz
  // esse clique nativo; nenhuma camada visual pode disputar essa interface.
  const IS_COMPOSE_WINDOW = /[?&]ae=(?:Item|PreFormAction)(?:&|$)/i.test(location.search) &&
    /[?&]a=(?:Reply|ReplyAll|Forward|New)(?:&|$)/i.test(location.search)
  if (IS_COMPOSE_WINDOW) return

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

  function climbForBox (element, predicate, maxSteps = 8) {
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
    if (!anchor) return null

    const header = climbForBox(anchor, (rect) => (
      rect.top < 90 &&
      rect.width > window.innerWidth * 0.55 &&
      rect.height >= 24 &&
      rect.height <= 105
    ), 9)

    header?.classList.add('sp-owa-v2-header-zone')
    return header || null
  }

  function markToolbar () {
    const novo = firstByText(/^Novo\s*$/i, (element) => element.getBoundingClientRect().top < 280)
    const eliminar = firstByText(/^Eliminar\s*$/i, (element) => element.getBoundingClientRect().top < 280)
    const mover = firstByText(/^Mover\s*$/i, (element) => element.getBoundingClientRect().top < 280)
    const anchor = commonAncestor([novo, eliminar, mover])
    if (!anchor) return null

    const toolbar = climbForBox(anchor, (rect) => (
      rect.width > 260 &&
      rect.height >= 28 &&
      rect.height <= 100 &&
      rect.top < 300
    ), 5) || anchor

    toolbar.classList.add('sp-owa-v2-toolbar-zone')
    return toolbar
  }

  function markNavigation () {
    const favoritos = firstByText(/^Favoritos$/i, (element) => {
      const rect = element.getBoundingClientRect()
      return rect.left < 340 && rect.top < window.innerHeight * 0.55
    })
    if (!favoritos) return null

    let nav = climbForBox(favoritos, (rect) => (
      rect.left < 70 &&
      rect.width >= 150 &&
      rect.width <= 390 &&
      rect.top < 180 &&
      rect.height >= window.innerHeight * 0.62
    ), 11)

    if (!nav) {
      nav = climbForBox(favoritos, (rect) => (
        rect.left < 70 &&
        rect.width >= 150 &&
        rect.width <= 390 &&
        rect.height > 260
      ), 10)
    }

    nav?.classList.add('sp-owa-v2-nav-zone')
    return nav || null
  }

  function markMailList (toolbar) {
    if (!toolbar) return null

    const zone = climbForBox(toolbar, (rect) => (
      rect.left > 120 &&
      rect.left < window.innerWidth * 0.55 &&
      rect.width >= 300 &&
      rect.width <= 760 &&
      rect.height >= window.innerHeight * 0.58
    ), 9)

    zone?.classList.add('sp-owa-v3-mail-list-zone')
    return zone || null
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
    if (!anchor) return null

    const chrome = climbForBox(anchor, (rect) => (
      rect.left > window.innerWidth * 0.28 &&
      rect.width > window.innerWidth * 0.35 &&
      rect.height >= 50 &&
      rect.height <= 280
    ), 7)

    chrome?.classList.add('sp-owa-v2-message-chrome')
    return chrome || null
  }

  function nativeHighlight (element) {
    if (!visible(element) || extensionOwned(element)) return false
    const rect = element.getBoundingClientRect()
    if (rect.width < 120 || rect.height < 18 || rect.height > 95) return false

    const color = (element.ownerDocument.defaultView || window).getComputedStyle(element).backgroundColor
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
    if (!match) return false

    const red = Number(match[1])
    const green = Number(match[2])
    const blue = Number(match[3])
    const paleYellow = red > 220 && green > 190 && blue < 190
    const paleGreen = red > 170 && green > 215 && blue > 170 && blue < 235
    return paleYellow || paleGreen
  }

  function markNativeSelections (zones) {
    zones.filter(Boolean).forEach((zone) => {
      Array.from(zone.querySelectorAll('tr, td, div, a')).forEach((element) => {
        if (nativeHighlight(element)) element.classList.add('sp-owa-v3-native-selected')
      })
    })
  }

  function decorateOwa (captureSelections = false) {
    if (!document.body) return null

    const header = markHeader()
    const toolbar = markToolbar()
    const nav = markNavigation()
    const mailList = markMailList(toolbar)
    markSearch()
    const messageChrome = markMessageChrome()

    if (captureSelections) markNativeSelections([nav, mailList])
    ensureHeaderExperience(header)
    return header
  }

  function closeMenu () {
    const menu = document.querySelector('#sp-owa-v3-settings-menu')
    const trigger = document.querySelector('#sp-owa-v3-settings-trigger')
    if (!menu || !trigger) return
    menu.hidden = true
    trigger.setAttribute('aria-expanded', 'false')
  }

  function updateControl () {
    const root = document.getElementById(ROOT_ID)
    if (!root) return

    root.dataset.themeEnabled = String(enabled)
    root.querySelectorAll('[data-theme-choice]').forEach((button) => {
      const selected = button.dataset.themeChoice === (enabled ? 'protocolista' : 'owa')
      button.classList.toggle('is-selected', selected)
      button.setAttribute('aria-checked', String(selected))
      const marker = button.querySelector('.sp-owa-v3-choice-marker')
      if (marker) marker.textContent = selected ? '✓' : ''
    })
  }

  function ensureHeaderExperience (header) {
    if (!header || !header.isConnected) return null

    let root = document.getElementById(ROOT_ID)
    if (!root) {
      root = document.createElement('div')
      root.id = ROOT_ID
      root.setAttribute('aria-label', 'Opções do SEI Protocolistas')
      root.innerHTML = `
        <div class="sp-owa-v3-branding" aria-hidden="true">
          <strong>WEBMAIL PROTOCOLISTAS</strong>
          <span>⚡ FAST MAIL</span>
        </div>
        <div class="sp-owa-v3-settings">
          <button id="sp-owa-v3-settings-trigger" type="button" aria-haspopup="menu" aria-expanded="false" title="Opções do SEI Protocolistas">❄</button>
          <div id="sp-owa-v3-settings-menu" role="menu" hidden>
            <div class="sp-owa-v3-menu-title">SEI PROTOCOLISTAS</div>
            <div class="sp-owa-v3-menu-subtitle">APARÊNCIA DO WEBMAIL</div>
            <button type="button" role="menuitemradio" data-theme-choice="protocolista">
              <span class="sp-owa-v3-choice-marker"></span>
              <span><strong>Tema Protocolista</strong><small>Azul-marinho, dourado e interface integrada</small></span>
            </button>
            <button type="button" role="menuitemradio" data-theme-choice="owa">
              <span class="sp-owa-v3-choice-marker"></span>
              <span><strong>OWA Original</strong><small>Visual padrão do Webmail</small></span>
            </button>
          </div>
        </div>`

      const trigger = root.querySelector('#sp-owa-v3-settings-trigger')
      const menu = root.querySelector('#sp-owa-v3-settings-menu')

      trigger?.addEventListener('click', (event) => {
        event.stopPropagation()
        if (!menu) return
        const willOpen = menu.hidden
        menu.hidden = !willOpen
        trigger.setAttribute('aria-expanded', String(willOpen))
      })

      root.querySelectorAll('[data-theme-choice]').forEach((button) => {
        button.addEventListener('click', async () => {
          const next = button.dataset.themeChoice === 'protocolista'
          applyTheme(next)
          await storageSet({ [STORAGE_KEY]: next })
          closeMenu()
        })
      })

      document.addEventListener('click', (event) => {
        if (!root.contains(event.target)) closeMenu()
      })

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeMenu()
      })
    }

    if (root.parentElement !== header) header.appendChild(root)
    updateControl()
    return root
  }

  function applyTheme (nextEnabled) {
    enabled = Boolean(nextEnabled)
    const wasActive = document.documentElement.classList.contains(THEME_CLASS)

    if (enabled) decorateOwa(!wasActive)

    document.documentElement.classList.toggle(THEME_CLASS, enabled)
    document.documentElement.dataset.spOwaProtocolistaThemeV2 = enabled ? 'on' : 'off'

    const header = markHeader()
    ensureHeaderExperience(header)
    updateControl()
  }

  async function init () {
    const stored = await storageGet(STORAGE_KEY)
    const initial = typeof stored[STORAGE_KEY] === 'boolean'
      ? stored[STORAGE_KEY]
      : true

    decorateOwa(initial)
    applyTheme(initial)

    ;[250, 700, 1500, 2800].forEach((delay) => {
      window.setTimeout(() => {
        if (enabled) decorateOwa(false)
        else ensureHeaderExperience(markHeader())
      }, delay)
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true })
  } else {
    init()
  }
})()
