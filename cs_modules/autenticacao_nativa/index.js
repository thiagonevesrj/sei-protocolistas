(() => {
  'use strict'

  const api = typeof browser === 'undefined' ? chrome : browser
  const CREDENTIALS_KEY = 'centralProtocolistaSeiCredentials'
  const PENDING_KEY = 'spAutenticacaoNativaPendente'
  const SUCCESS_KEY = 'spAutenticacaoNativaConcluida'
  const TOAST_ID = 'sp-autenticacao-nativa-toast'
  const MAX_PENDING_AGE = 20 * 1000
  const DIALOG_WAIT = 12 * 1000

  let completing = false

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

  function isVisible (element) {
    if (!element) return false
    const style = element.ownerDocument.defaultView?.getComputedStyle(element)
    if (!style || style.display === 'none' || style.visibility === 'hidden') return false
    const rectangle = element.getBoundingClientRect()
    return rectangle.width > 0 && rectangle.height > 0
  }

  function waitFor (test, timeout, interval = 150) {
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

  function processCommandToolbar () {
    const quickRequest = document.querySelector('#sp-fast-proc-rq')
    return quickRequest?.parentElement || null
  }

  function requestId () {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  async function activePending () {
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

  async function completeAuthentication () {
    if (completing) return false
    completing = true

    try {
      const pending = await activePending()
      if (!pending) return false

      const dialog = await waitFor(authenticationDialog, DIALOG_WAIT)
      if (!dialog) return false

      const stored = await storageGet(CREDENTIALS_KEY)
      const credentials = stored[CREDENTIALS_KEY]

      if (!credentials?.remember || !credentials.password) {
        await storageRemove(PENDING_KEY)
        window.alert(
          'Autenticação automática: salve a senha do SEI na Central do Protocolista.'
        )
        return false
      }

      fillPassword(dialog.password, credentials.password)
      await storageRemove(PENDING_KEY)

      window.setTimeout(() => {
        dialog.sign.focus?.()
        dialog.sign.click()

        storageSet({
          [SUCCESS_KEY]: {
            requestId: pending.requestId,
            createdAt: Date.now()
          }
        }).catch(() => {})
      }, 180)

      return true
    } finally {
      completing = false
    }
  }

  async function showSuccessToast () {
    const quickRequest = await waitFor(
      () => document.querySelector('#sp-fast-proc-rq'),
      5000,
      150
    )

    if (!quickRequest) return false

    document.getElementById(TOAST_ID)?.remove()

    const toast = document.createElement('div')
    toast.id = TOAST_ID
    toast.setAttribute('role', 'status')
    toast.textContent = '✓ AUTENTICADO COM SUCESSO'
    toast.style.cssText = [
      'align-items:center',
      'background:#137a48',
      'border:1px solid #6ee7a8',
      'border-radius:10px',
      'box-shadow:0 12px 32px rgb(0 0 0 / 38%)',
      'color:#fff',
      'display:flex',
      'font:800 14px Arial,Helvetica,sans-serif',
      'left:50%',
      'letter-spacing:.5px',
      'min-height:48px',
      'padding:0 22px',
      'position:fixed',
      'top:24px',
      'transform:translateX(-50%)',
      'z-index:2147483647'
    ].join(';')

    document.body.appendChild(toast)
    window.setTimeout(() => toast.remove(), 1000)
    return true
  }

  function armFromToolbarClick (event) {
    const toolbar = processCommandToolbar()
    const target = event.target?.nodeType === Node.ELEMENT_NODE
      ? event.target
      : event.target?.parentElement

    if (!toolbar || !target || !toolbar.contains(target)) return
    if (target.closest?.('#sp-fast-proc-rq')) return

    storageSet({
      [PENDING_KEY]: {
        requestId: requestId(),
        createdAt: Date.now()
      }
    }).then(() => {
      completeAuthentication().catch(() => {})
    }).catch((error) => {
      console.error(
        '[SEI Protocolistas] Não foi possível iniciar a autenticação automática:',
        error
      )
    })
  }

  document.addEventListener('click', armFromToolbarClick, true)

  api.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return

    if (changes[PENDING_KEY]?.newValue) {
      completeAuthentication().catch(() => {})
    }

    if (changes[SUCCESS_KEY]?.newValue) {
      showSuccessToast()
        .then((shown) => {
          if (shown) {
            storageRemove(SUCCESS_KEY)
              .catch(() => {})
          }
        })
        .catch(() => {})
    }
  })

  storageGet([PENDING_KEY, SUCCESS_KEY])
    .then((stored) => {
      const pending = stored[PENDING_KEY]
      if (pending) completeAuthentication().catch(() => {})

      if (stored[SUCCESS_KEY]) {
        showSuccessToast()
          .then((shown) => {
            if (shown) return storageRemove(SUCCESS_KEY)
            return undefined
          })
          .catch(() => {})
      }
    })
    .catch(() => {})
})()
