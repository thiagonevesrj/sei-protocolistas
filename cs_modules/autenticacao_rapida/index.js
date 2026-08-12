(() => {
  'use strict'

  const api = typeof browser === 'undefined' ? chrome : browser
  const CREDENTIALS_KEY = 'centralProtocolistaSeiCredentials'
  const PENDING_KEY = 'spAutenticacaoRapidaPendente'
  const BUTTON_ID = 'sp-autenticacao-rapida'
  const MAX_PENDING_AGE = 30 * 1000

  let quickButton = null
  let processing = false

  const storageGet = (key) => new Promise((resolve, reject) => {
    const result = api.storage.local.get(key, (items) => {
      const error = api.runtime?.lastError
      if (error) reject(error)
      else resolve(items || {})
    })
    if (result?.then) result.then(resolve, reject)
  })

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
    const style = element.ownerDocument.defaultView?.getComputedStyle(element)
    if (!style || style.display === 'none' || style.visibility === 'hidden') return false
    const rectangle = element.getBoundingClientRect()
    return rectangle.width > 0 && rectangle.height > 0
  }

  function describe (element) {
    const image = element.querySelector?.('img')
    return normalize([
      element.textContent,
      element.getAttribute?.('title'),
      element.getAttribute?.('aria-label'),
      element.getAttribute?.('href'),
      element.getAttribute?.('onclick'),
      image?.getAttribute('alt'),
      image?.getAttribute('title'),
      image?.getAttribute('src')
    ].filter(Boolean).join(' '))
  }

  function findNativeAuthentication () {
    const candidates = Array.from(document.querySelectorAll(
      'a, button, input[type="button"], [role="button"], [onclick]'
    ))

    return candidates.find((element) => {
      if (element.id === BUTTON_ID || !isVisible(element)) return false
      const description = describe(element)
      return description.includes('documento autenticar') ||
        description.includes('documento_autenticar') ||
        description.includes('autenticacao1') ||
        description.includes('selo autenticacao1') ||
        description.includes('autenticar documento')
    }) || null
  }

  function createStampIcon () {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    icon.setAttribute('viewBox', '0 0 36 36')
    icon.setAttribute('aria-hidden', 'true')
    icon.innerHTML = `
      <circle cx="18" cy="18" r="15" fill="currentColor"/>
      <circle cx="18" cy="18" r="12" fill="none" stroke="white" stroke-width="1.5" opacity=".72"/>
      <path d="M10.5 18.5l4.5 4.4L25.8 12.7" fill="none" stroke="white" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M11 29h14" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" opacity=".85"/>
    `
    return icon
  }

  function setButtonState (state, title) {
    if (!quickButton?.isConnected) return
    quickButton.dataset.state = state
    quickButton.title = title
    quickButton.disabled = state === 'loading'
  }

  function activePending () {
    try {
      const createdAt = Number(sessionStorage.getItem(PENDING_KEY))
      if (!createdAt || Date.now() - createdAt > MAX_PENDING_AGE) {
        sessionStorage.removeItem(PENDING_KEY)
        return false
      }
      return true
    } catch (_) {
      return false
    }
  }

  function clearPending () {
    try {
      sessionStorage.removeItem(PENDING_KEY)
    } catch (_) {}
  }

  function fillField (field, value) {
    field.focus()
    field.value = value
    ;['input', 'change', 'keyup', 'blur'].forEach((eventName) => {
      field.dispatchEvent(new Event(eventName, { bubbles: true }))
    })
  }

  function buttonLabel (element) {
    return normalize([
      element.textContent,
      element.value,
      element.getAttribute?.('title'),
      element.getAttribute?.('aria-label')
    ].filter(Boolean).join(' '))
  }

  function findAuthenticationDialog () {
    const title = Array.from(document.querySelectorAll('h1, h2, h3, div, span'))
      .find((element) => isVisible(element) &&
        normalize(element.textContent) === 'autenticacao de documento')

    if (!title) return null

    const password = Array.from(document.querySelectorAll(
      '#pwdSenha, input[name="pwdSenha"], input[type="password"]'
    )).find(isVisible)

    const sign = Array.from(document.querySelectorAll(
      'button, input[type="button"], input[type="submit"], a, [role="button"]'
    )).find((element) =>
      isVisible(element) &&
      buttonLabel(element) === 'assinar'
    )

    return password && sign
      ? { container: document.body, password, sign }
      : null
  }

  async function completeAuthentication () {
    if (processing || !activePending()) return

    const dialog = findAuthenticationDialog()
    if (!dialog) return

    processing = true

    try {
      const stored = await storageGet(CREDENTIALS_KEY)
      const credentials = stored[CREDENTIALS_KEY]

      if (!credentials?.remember || !credentials.password) {
        clearPending()
        throw new Error('Salve a senha do SEI na Central do Protocolista.')
      }

      fillField(dialog.password, credentials.password)
      clearPending()

      window.setTimeout(() => {
        dialog.sign.focus?.()
        dialog.sign.click()
        setButtonState('success', 'Autenticação enviada ao SEI')
        window.setTimeout(() => {
          setButtonState('ready', 'Autenticação rápida — autenticar e assinar')
        }, 3500)
      }, 180)
    } catch (error) {
      console.error('[SEI Protocolistas] Falha na autenticação rápida:', error)
      setButtonState('error', error.message || String(error))
      window.alert(`Autenticação rápida: ${error.message || error}`)
    } finally {
      processing = false
    }
  }

  async function startAuthentication (nativeAuthentication) {
    try {
      const stored = await storageGet(CREDENTIALS_KEY)
      const credentials = stored[CREDENTIALS_KEY]

      if (!credentials?.remember || !credentials.password) {
        throw new Error('Salve a senha do SEI na Central do Protocolista antes de usar o carimbo.')
      }

      sessionStorage.setItem(PENDING_KEY, String(Date.now()))
      setButtonState('loading', 'Abrindo autenticação...')
      nativeAuthentication.focus?.()
      nativeAuthentication.click()

      window.setTimeout(() => {
        if (!activePending()) return
        clearPending()
        setButtonState('error', 'A janela de autenticação não foi localizada')
      }, MAX_PENDING_AGE)
    } catch (error) {
      clearPending()
      setButtonState('error', error.message || String(error))
      window.alert(`Autenticação rápida: ${error.message || error}`)
    }
  }

  function insertQuickButton () {
    const existingButtons = Array.from(
      document.querySelectorAll(`#${BUTTON_ID}`)
    )

    existingButtons.slice(1).forEach((button) => button.remove())
    if (existingButtons.length) return

    const nativeAuthentication = findNativeAuthentication()
    if (!nativeAuthentication?.parentElement) return

    const button = document.createElement('button')
    button.id = BUTTON_ID
    button.type = 'button'
    button.title = 'Autenticação rápida — autenticar e assinar'
    button.setAttribute('aria-label', 'Autenticação rápida — autenticar e assinar')
    button.dataset.state = 'ready'
    button.appendChild(createStampIcon())
    button.addEventListener('click', () => startAuthentication(nativeAuthentication))

    if (document.getElementById(BUTTON_ID)) return

    const toolbar = nativeAuthentication.closest(
      'div, td, li, nav'
    ) || nativeAuthentication.parentElement

    toolbar.appendChild(button)
    quickButton = button
  }

  const observer = new MutationObserver(() => {
    insertQuickButton()
    completeAuthentication().catch((error) => {
      console.error('[SEI Protocolistas] Falha ao acompanhar autenticação:', error)
    })
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  })

  insertQuickButton()
  completeAuthentication().catch(() => {})
})()
