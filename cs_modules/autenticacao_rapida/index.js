(() => {
  'use strict'

  const api = typeof browser === 'undefined' ? chrome : browser
  const CREDENTIALS_KEY = 'centralProtocolistaSeiCredentials'
  const PENDING_KEY = 'spAutenticacaoRapidaPendente'
  const SUCCESS_KEY = 'spAutenticacaoRapidaConcluida'
  const BUTTON_ID = 'sp-autenticacao-rapida'
  const TOAST_ID = 'sp-autenticacao-rapida-toast'
  const MAX_PENDING_AGE = 20 * 1000
  const AUTHENTICATION_AVAILABILITY_WAIT = 30 * 60 * 1000
  const DIALOG_WAIT = 12 * 1000

  let quickButton = null

  const storageGet = (keys) => new Promise((resolve, reject) => {
    api.storage.local.get(keys, (items) => {
      const error = api.runtime?.lastError
      if (error) reject(error)
      else resolve(items || {})
    })
  })

  const storageSet = (items) => new Promise((resolve, reject) => {
    api.storage.local.set(items, () => {
      const error = api.runtime?.lastError
      if (error) reject(error)
      else resolve()
    })
  })

  const storageRemove = (keys) => new Promise((resolve, reject) => {
    api.storage.local.remove(keys, () => {
      const error = api.runtime?.lastError
      if (error) reject(error)
      else resolve()
    })
  })

  function normalize (value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  }

  function currentAction () {
    return new URLSearchParams(window.location.search).get('acao') || ''
  }

  function isVisible (element) {
    if (!element) return false
    const style = element.ownerDocument.defaultView?.getComputedStyle(element)
    if (!style || style.display === 'none' || style.visibility === 'hidden') return false
    const rectangle = element.getBoundingClientRect()
    return rectangle.width > 0 && rectangle.height > 0
  }

  function waitFor (test, timeout, interval = 200) {
    const startedAt = Date.now()

    return new Promise((resolve) => {
      const check = () => {
        let result = null

        try {
          result = test()
        } catch (error) {}

        if (result) {
          resolve(result)
          return
        }

        if (Date.now() - startedAt >= timeout) {
          resolve(null)
          return
        }

        window.setTimeout(check, interval)
      }

      check()
    })
  }

  function createRequestId () {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  function describeCommand (element) {
    const images = element?.matches?.('img')
      ? [element]
      : Array.from(element?.querySelectorAll?.('img') || [])

    return normalize([
      element?.textContent,
      element?.getAttribute?.('href'),
      element?.getAttribute?.('onclick'),
      element?.getAttribute?.('title'),
      element?.getAttribute?.('aria-label'),
      ...images.flatMap((image) => [
        image.getAttribute('src'),
        image.getAttribute('alt'),
        image.getAttribute('title'),
        image.getAttribute('aria-label')
      ])
    ].filter(Boolean).join(' '))
  }

  function isAuthenticationCommand (element) {
    const description = describeCommand(element)

    return description.includes('documento_autenticar') ||
      description.includes('autenticar documento') ||
      description.includes('autenticacao de documento') ||
      description.includes('autenticacao1') ||
      description.includes('autenticacao_documento') ||
      (
        description.includes('autenticar') &&
        description.includes('documento')
      )
  }

  function nativeAuthenticationTrigger () {
    const clickableSelector =
      'a, button, [role="button"], [onclick]'

    const imageTriggers = Array.from(
      document.querySelectorAll('img')
    ).map((image) =>
      image.closest(clickableSelector) || image
    )

    const candidates = Array.from(new Set([
      ...document.querySelectorAll(clickableSelector),
      ...imageTriggers
    ]))

    return candidates.find((element) =>
      element.id !== BUTTON_ID &&
      isVisible(element) &&
      !element.closest('#divArvore, [id*="Arvore"]') &&
      isAuthenticationCommand(element)
    ) || null
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

  async function validPending () {
    const stored = await storageGet(PENDING_KEY)
    const pending = stored[PENDING_KEY]

    if (
      !pending?.requestId ||
      !pending.createdAt ||
      Date.now() - pending.createdAt > MAX_PENDING_AGE
    ) {
      if (pending) await storageRemove(PENDING_KEY)
      return null
    }

    return pending
  }

  function fillPassword (field, value) {
    field.focus()
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )

    if (descriptor?.set) descriptor.set.call(field, value)
    else field.value = value

    ;['input', 'change', 'keyup'].forEach((eventName) => {
      field.dispatchEvent(new Event(eventName, { bubbles: true }))
    })
  }

  function buttonLabel (element) {
    return normalize([
      element?.textContent,
      element?.value,
      element?.getAttribute?.('title'),
      element?.getAttribute?.('aria-label')
    ].filter(Boolean).join(' '))
  }

  function authenticationDialog () {
    const password = Array.from(document.querySelectorAll(
      '#pwdSenha, input[name="pwdSenha"], input[type="password"]'
    )).find(isVisible)

    if (!password) return null

    const sign = Array.from(document.querySelectorAll(
      'button, input[type="button"], input[type="submit"], a, [role="button"]'
    )).find((element) =>
      isVisible(element) && buttonLabel(element) === 'assinar'
    )

    if (!sign) return null

    const pageText = normalize(document.body?.innerText)
    if (!pageText.includes('autenticacao de documento')) return null

    return { password, sign }
  }

  async function completeAuthentication () {
    const pending = await validPending()
    if (!pending) return false

    const dialog = await waitFor(authenticationDialog, DIALOG_WAIT, 150)
    if (!dialog) return false

    const stored = await storageGet(CREDENTIALS_KEY)
    const credentials = stored[CREDENTIALS_KEY]

    if (!credentials?.remember || !credentials.password) {
      await storageRemove(PENDING_KEY)
      return false
    }

    fillPassword(dialog.password, credentials.password)
    await storageRemove(PENDING_KEY)
    await storageSet({
      [SUCCESS_KEY]: {
        requestId: pending.requestId,
        createdAt: Date.now()
      }
    })

    window.setTimeout(() => {
      dialog.sign.focus?.()
      dialog.sign.click()
    }, 180)

    return true
  }

  async function startAuthentication () {
    try {
      const nativeTrigger = nativeAuthenticationTrigger()

      if (!nativeTrigger) {
        throw new Error(
          'O botão nativo de autenticação não está disponível neste documento.'
        )
      }

      const stored = await storageGet(CREDENTIALS_KEY)
      const credentials = stored[CREDENTIALS_KEY]

      if (!credentials?.remember || !credentials.password) {
        throw new Error(
          'Salve a senha do SEI na Central do Protocolista antes de usar o carimbo.'
        )
      }

      const requestId = createRequestId()
      await storageSet({
        [PENDING_KEY]: {
          requestId,
          createdAt: Date.now()
        }
      })

      setButtonState('loading', 'Abrindo autenticação...')
      nativeTrigger.focus?.()
      nativeTrigger.click()
      completeAuthentication().catch(() => {})

      window.setTimeout(async () => {
        const active = await validPending()
        if (!active || active.requestId !== requestId) return

        await storageRemove(PENDING_KEY)
        setButtonState('error', 'A janela de autenticação não foi localizada')
      }, DIALOG_WAIT + 1000)
    } catch (error) {
      await storageRemove(PENDING_KEY).catch(() => {})
      setButtonState('error', error.message || String(error))
      window.alert(`Autenticação rápida: ${error.message || error}`)
    }
  }

  async function insertQuickButton () {
    const available = await waitFor(
      () => {
        const quickRequest = document.querySelector('#sp-fast-proc-rq')
        const nativeTrigger = nativeAuthenticationTrigger()

        return quickRequest?.parentElement && nativeTrigger
          ? { quickRequest, nativeTrigger }
          : null
      },
      AUTHENTICATION_AVAILABILITY_WAIT,
      250
    )

    if (!available || document.getElementById(BUTTON_ID)) return

    const { quickRequest } = available

    const button = document.createElement('button')
    button.id = BUTTON_ID
    button.type = 'button'
    button.title = 'Autenticação rápida — autenticar e assinar'
    button.setAttribute('aria-label', 'Autenticação rápida — autenticar e assinar')
    button.dataset.state = 'ready'
    button.appendChild(createStampIcon())
    button.addEventListener('click', startAuthentication)

    quickRequest.insertAdjacentElement('afterend', button)
    quickButton = button
  }

  function listenForSuccess () {
    api.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !changes[SUCCESS_KEY]?.newValue) return

      showSuccessToast()
      setButtonState('success', 'Documento autenticado como original')
      storageRemove(SUCCESS_KEY).catch(() => {})

      window.setTimeout(() => {
        setButtonState('ready', 'Autenticação rápida — autenticar e assinar')
      }, 2500)
    })
  }

  const action = currentAction()

  if (action === 'arvore_visualizar') {
    listenForSuccess()
    insertQuickButton().catch((error) => {
      console.warn('[SEI Protocolistas] Carimbo não inserido:', error)
    })
  }

  validPending()
    .then((pending) => {
      if (pending) completeAuthentication().catch(() => {})
    })
    .catch(() => {})
})()
