(() => {
  'use strict'

  const api = typeof browser === 'undefined' ? chrome : browser
  const HANDOFF_KEY = 'fastMailFastProcHandoff'
  const CONTEXT_KEY = 'cliqueProtocolistaContexto'
  const MAX_AGE = 15 * 60 * 1000
  const CONTEXT_MAX_AGE = 60 * 60 * 1000

  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim()
  const normalize = (value) => clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

  const storageGet = (key) => new Promise((resolve, reject) => {
    try {
      const result = api.storage.local.get(key, (items) => {
        const error = api.runtime?.lastError
        if (error) reject(error)
        else resolve(items || {})
      })
      if (result?.then) result.then(resolve, reject)
    } catch (error) {
      reject(error)
    }
  })

  function action () {
    return new URLSearchParams(location.search).get('acao') || ''
  }

  function visible (element) {
    if (!element || element.hidden || element.closest('[hidden]')) return false
    const style = element.ownerDocument.defaultView?.getComputedStyle(element)
    if (!style || style.display === 'none' || style.visibility === 'hidden') return false
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }

  function pulse (element) {
    if (!element || !visible(element)) return
    element.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
    element.animate?.([
      { boxShadow: '0 0 0 0 rgba(244,200,77,0)' },
      { boxShadow: '0 0 0 5px rgba(244,200,77,.9)' },
      { boxShadow: '0 0 0 0 rgba(244,200,77,0)' },
      { boxShadow: '0 0 0 5px rgba(244,200,77,.9)' },
      { boxShadow: '0 0 0 0 rgba(244,200,77,0)' }
    ], { duration: 3200, easing: 'ease-out' })
  }

  function findStartProcessLink () {
    const exact = document.querySelector(
      'a[href*="acao=procedimento_escolher_tipo"],a[href*="acao=procedimento_iniciar"]'
    )
    if (exact) return exact

    return Array.from(document.querySelectorAll('a,button,[role="button"]')).find((element) =>
      /iniciar\s+processo/i.test(String(element.textContent || element.title || ''))
    ) || null
  }

  function findSendProcessHeading () {
    return Array.from(document.querySelectorAll('h1,h2,h3,legend,strong,div,span'))
      .filter(visible)
      .filter((element) => normalize(element.textContent).includes('enviar processo'))
      .sort((a, b) => clean(a.textContent).length - clean(b.textContent).length)[0] || null
  }

  function showDestinationProgress (message, state = 'loading', anchor = null) {
    let box = document.getElementById('sp-fast-proc-destination-status')
    if (!box) {
      box = document.createElement('div')
      box.id = 'sp-fast-proc-destination-status'
      box.setAttribute('role', 'status')
      box.setAttribute('aria-live', 'polite')
      box.style.margin = '0 0 12px'
      box.style.padding = '6px 10px'
      box.style.borderRadius = '7px'
      box.style.fontSize = '11px'
      box.style.fontWeight = '800'
      box.style.letterSpacing = '.02em'
      box.style.display = 'inline-block'

      const reference = anchor || findSendProcessHeading()
      if (reference?.parentElement) reference.insertAdjacentElement('afterend', box)
      else document.body?.prepend(box)
    }

    const recommendation = state === 'recommendation'
    box.dataset.state = state
    box.style.border = recommendation || state === 'ready'
      ? '2px solid #d2a92f'
      : state === 'error'
        ? '2px solid #d27a2f'
        : '1px solid #d2a92f'
    box.style.background = recommendation || state === 'ready' ? '#0b2940' : '#07182c'
    box.style.color = state === 'error' ? '#ffd9bd' : '#fff'
    box.textContent = message
    box.getAnimations?.().forEach((animation) => animation.cancel())
    if (recommendation) {
      box.animate([
        { opacity: 1, boxShadow: '0 0 0 0 rgba(244,200,77,0)' },
        { opacity: 0.45, boxShadow: '0 0 0 7px rgba(244,200,77,.95)' },
        { opacity: 1, boxShadow: '0 0 0 0 rgba(244,200,77,0)' }
      ], { duration: 1100, iterations: Infinity, easing: 'ease-in-out' })
    }
    return box
  }

  function findUnitsLabel () {
    return Array.from(document.querySelectorAll('label,td,th,div,span'))
      .filter(visible)
      .filter((element) => /^unidades?$/.test(normalize(element.textContent)))
      .sort((a, b) => clean(a.textContent).length - clean(b.textContent).length)[0] || null
  }

  function findUnitsInput () {
    const label = findUnitsLabel()
    if (label) {
      const forId = label.getAttribute?.('for')
      if (forId) {
        const linked = document.getElementById(forId)
        if (linked && visible(linked)) return linked
      }

      const scopes = [
        label.parentElement,
        label.closest('tr'),
        label.nextElementSibling,
        label.parentElement?.nextElementSibling
      ].filter(Boolean)

      for (const scope of scopes) {
        const input = Array.from(scope.querySelectorAll?.('input[type="text"],input:not([type]),textarea') || []).find(visible)
        if (input) return input
      }
    }

    return Array.from(document.querySelectorAll('input[type="text"],input:not([type])'))
      .filter(visible)
      .find((input) => {
        const context = normalize(`${input.parentElement?.textContent || ''} ${input.parentElement?.previousElementSibling?.textContent || ''}`)
        return context.includes('unidades') && !context.includes('orgao das unidades')
      }) || null
  }

  async function showDestinationRecommendation () {
    if (action() !== 'procedimento_enviar') return false

    let stored
    try {
      stored = await storageGet(CONTEXT_KEY)
    } catch (error) {
      console.warn('[SEI Protocolistas] Não foi possível ler o destino do FAST PROC:', error)
      return false
    }

    const context = stored[CONTEXT_KEY]
    if (!context) return false
    if (!context.createdAt || Date.now() - context.createdAt > CONTEXT_MAX_AGE) return false

    const destination = clean(context.destino || context.destination).toUpperCase()
    if (!destination) return false

    const startedAt = Date.now()
    return new Promise((resolve) => {
      const timer = window.setInterval(() => {
        const input = findUnitsInput()
        if (input || Date.now() - startedAt > 12000) {
          window.clearInterval(timer)
          const status = showDestinationProgress(
            `SETOR DE DESTINO: ${destination}`,
            'recommendation',
            null
          )
          pulse(status)
          pulse(input)
          resolve(Boolean(input))
        }
      }, 180)
    })
  }

  async function continueHandoff () {
    const handoff = (await storageGet(HANDOFF_KEY))[HANDOFF_KEY]
    if (!handoff || handoff.source !== 'fast-mail') return

    const expired = !handoff.createdAt || Date.now() - handoff.createdAt > MAX_AGE ||
      (handoff.expiresAt && Date.now() > handoff.expiresAt)
    if (expired) return

    if (/\/sip\/login\.php/i.test(location.pathname)) return
    if (['procedimento_escolher_tipo', 'procedimento_gerar'].includes(action())) return

    const start = findStartProcessLink()
    if (start) {
      start.click()
      return
    }

    const observer = new MutationObserver(() => {
      const link = findStartProcessLink()
      if (!link) return
      observer.disconnect()
      link.click()
    })

    observer.observe(document.documentElement, { childList: true, subtree: true })
    window.setTimeout(() => observer.disconnect(), 15000)
  }

  if (action() === 'procedimento_enviar') {
    showDestinationRecommendation().catch((error) => {
      console.error('[SEI Protocolistas] Falha ao mostrar recomendação de destino:', error)
    })
  } else if (window.top === window) {
    continueHandoff().catch((error) => {
      console.error('[SEI Protocolistas] Falha ao localizar Iniciar Processo:', error)
    })
  }
})()
