(() => {
  'use strict'

  const api = typeof browser === 'undefined' ? chrome : browser
  const CREDENTIALS_KEY = 'centralProtocolistaSeiCredentials'
  const PENDING_KEY = 'spAutenticacaoRapidaPendente'
  const BUTTON_ID = 'sp-autenticacao-rapida'
  const SUCCESS_MESSAGE = 'sp-autenticacao-rapida-concluida'
  const TOAST_ID = 'sp-autenticacao-rapida-toast'
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

  const storageSet = (items) => new Promise((resolve, reject) => {
    const result = api.storage.local.set(items, () => {
      const error = api.runtime?.lastError
      if (error) reject(error)
      else resolve()
    })
    if (result?.then) result.then(resolve, reject)
  })

  const storageRemove = (key) => new Promise((resolve, reject) => {
    const result = api.storage.local.remove(key, () => {
      const error = api.runtime?.lastError
      if (error) reject(error)
      else resolve()
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

  function findCommandToolbar (element) {
    let container = element?.parentElement

    while (
      container &&
      container !== document.body &&
      container !== document.documentElement
    ) {
      const iconCommands = container.querySelectorAll('img, svg')

      if (iconCommands.length >= 5) return container
      container = container.parentElement
    }

    return null
  }

  function findNativeAuthentication () {
    const actionCandidates = Array.from(document.querySelectorAll(
      'a, button, input[type="button"], [role="button"], [onclick]'
    ))

    const imageCandidates = Array.from(document.querySelectorAll('img'))
      .filter((image) => {
        const description = normalize([
          image.getAttribute('src'),
          image.getAttribute('alt'),
          image.getAttribute('title')
        ].filter(Boolean).join(' '))

        return description.includes('autenticacao1') ||
          description.includes('selo autenticacao1')
      })
      .map((image) => image.closest(
        'a, button, input[type="button"], [role="button"], [onclick]'
      ) || image.parentElement)
      .filter(Boolean)

    const candidates = Array.from(new Set([
      ...imageCandidates,
      ...actionCandidates
    ]))

    return candidates.find((element) => {
      if (element.id === BUTTON_ID || !isVisible(element)) return false
      if (element.closest('#divArvore, [id*="Arvore"]')) return false

      const description = describe(element)
      const action = normalize([
        element.getAttribute?.('href'),
        element.getAttribute?.('onclick')
      ].filter(Boolean).join(' '))

      const toolbar = findCommandToolbar(element)
      if (!toolbar) return false

      return action.includes('documento_autenticar') ||
        description.includes('autenticar documento') ||
        description.includes('autenticacao de documento') ||
        description.includes('autenticacao1') ||
        description.includes('selo autenticacao1')
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

  function showSuccessToast () {
    if (window.top !== window) return

    document.getElementById(TOAST_ID)?.remove()

    const toast = document.createElement('div')
    toast.id = TOAST_ID
    toast.setAttribute('role', 'status')
    toast.textContent = '✓ AUTENTICADO ORIGINAL'
    document.body.appendChild(toast)

    window.setTimeout(() => {
      toast.classList.add('sp-auth-toast--leaving')
      window.setTimeout(() => toast.remove(), 180)
    }, 1000)
  }

  async function activePending () {
    const stored = await storageGet(PENDING_KEY)
    const createdAt = Number(stored[PENDING_KEY]?.createdAt)

    if (!createdAt || Date.now() - createdAt > MAX_PENDING_AGE) {
      if (stored[PENDING_KEY]) await storageRemove(PENDING_KEY)
      return false
    }

    return true
  }

  async function clearPending () {
    await storageRemove(PENDING_KEY)
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
    if (processing) return

    const dialog = findAuthenticationDialog()
    if (!dialog) return
    if (!await activePending()) return

    processing = true

    try {
      const stored = await storageGet(CREDENTIALS_KEY)
      const credentials = stored[CREDENTIALS_KEY]

      if (!credentials?.remember || !credentials.password) {
        await clearPending()
        throw new Error('Salve a senha do SEI na Central do Protocolista.')
      }

      fillField(dialog.password, credentials.password)
      await clearPending()

      window.setTimeout(() => {
        dialog.sign.focus?.()
        dialog.sign.click()
        window.top.postMessage(
          { type: SUCCESS_MESSAGE },
          window.location.origin
        )
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

      await storageSet({
        [PENDING_KEY]: {
          createdAt: Date.now(),
          expiresAt: Date.now() + MAX_PENDING_AGE
        }
      })
      setButtonState('loading', 'Abrindo autenticação...')
      nativeAuthentication.focus?.()
      nativeAuthentication.click()

      window.setTimeout(async () => {
        if (!await activePending()) return
        await clearPending()
        setButtonState(
          'error',
          'A janela de autenticação não foi localizada'
        )
      }, MAX_PENDING_AGE)
    } catch (error) {
      await clearPending().catch(() => {})
      setButtonState('error', error.message || String(error))
      window.alert(`Autenticação rápida: ${error.message || error}`)
    }
  }

  function insertQuickButton () {
    const existingButtons = Array.from(
      document.querySelectorAll(`#${BUTTON_ID}`)
    )

    existingButtons
      .filter((button) =>
        button.closest('#divArvore, [id*="Arvore"]')
      )
      .forEach((button) => button.remove())

    const validExistingButtons = existingButtons.filter(
      (button) => button.isConnected
    )

    validExistingButtons.slice(1).forEach((button) => button.remove())
    if (validExistingButtons.length) return

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

    const toolbar = findCommandToolbar(
      nativeAuthentication
    )

    if (!toolbar) return

    toolbar.appendChild(button)
    quickButton = button
  }

  const observer = new MutationObserver(() => {
    insertQuickButton()
    completeAuthentication().catch((error) => {
      console.error('[SEI Protocolistas] Falha ao acompanhar autenticação:', error)
    })
  })

  window.addEventListener('message', (event) => {
    if (
      event.origin !== window.location.origin ||
      event.data?.type !== SUCCESS_MESSAGE
    ) return

    showSuccessToast()
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  })

  insertQuickButton()
  completeAuthentication().catch(() => {})
})()
