(() => {
  'use strict'

  if (window.top !== window) return

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

  function dispatch (element, type) {
    if (!element) return
    element.dispatchEvent(new Event(type, { bubbles: true }))
  }

  function setFieldValue (field, value) {
    field.focus?.()
    const prototype = Object.getPrototypeOf(field)
    const descriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, 'value') : null
    if (descriptor?.set) descriptor.set.call(field, value)
    else field.value = value
    dispatch(field, 'input')
    dispatch(field, 'change')
    field.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', code: 'KeyA', bubbles: true }))
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
      box.style.margin = '10px 0 14px'
      box.style.padding = '11px 13px'
      box.style.borderRadius = '7px'
      box.style.fontSize = '12px'
      box.style.fontWeight = '800'
      box.style.letterSpacing = '.02em'

      const reference = anchor || findSendProcessHeading()
      if (reference?.parentElement) reference.insertAdjacentElement('afterend', box)
      else document.body?.prepend(box)
    }

    box.dataset.state = state
    box.style.border = state === 'ready'
      ? '2px solid #d2a92f'
      : state === 'error'
        ? '2px solid #d27a2f'
        : '1px solid #d2a92f'
    box.style.background = state === 'ready' ? '#0b2940' : '#07182c'
    box.style.color = state === 'error' ? '#ffd9bd' : '#fff'
    box.textContent = message
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

  function findUnitsSelect (input) {
    const scopes = [
      input?.parentElement,
      input?.parentElement?.nextElementSibling,
      input?.closest('tr')?.nextElementSibling,
      input?.closest('form')
    ].filter(Boolean)

    for (const scope of scopes) {
      const selects = Array.from(scope.querySelectorAll?.('select') || [])
      const select = selects.find((candidate) => candidate !== document.querySelector('select') && (visible(candidate) || candidate.multiple))
      if (select) return select
    }
    return null
  }

  function selectDestinationOption (destination, input) {
    const wanted = normalize(destination)
    const select = findUnitsSelect(input)

    if (select) {
      const option = Array.from(select.options || []).find((candidate) => {
        const text = normalize(candidate.textContent)
        return text === wanted || text.startsWith(`${wanted} `) || text.includes(` ${wanted} `)
      })

      if (option) {
        Array.from(select.options || []).forEach((candidate) => { candidate.selected = false })
        option.selected = true
        if (!select.multiple) select.value = option.value
        dispatch(select, 'input')
        dispatch(select, 'change')
        return select
      }
    }

    const candidate = Array.from(document.querySelectorAll('a,li,td,div,span'))
      .filter(visible)
      .filter((element) => {
        const text = normalize(element.textContent)
        return text === wanted || text.startsWith(`${wanted} `)
      })
      .sort((a, b) => clean(a.textContent).length - clean(b.textContent).length)[0]

    if (!candidate) return null
    const clickable = candidate.closest('a,button,li') || candidate
    clickable.click?.()
    return clickable
  }

  function findSendButton () {
    return Array.from(document.querySelectorAll('button,input[type="button"],input[type="submit"],a'))
      .filter(visible)
      .find((element) => /enviar/i.test(clean(element.value || element.textContent || element.title))) || null
  }

  async function autoSelectDestination () {
    if (action() !== 'procedimento_trabalhar') return false

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

    showDestinationProgress(`FAST PROC — CARREGANDO SETOR DE DESTINO: ${destination}…`, 'loading')

    const startedAt = Date.now()
    let announcedInput = false
    return new Promise((resolve) => {
      const timer = window.setInterval(() => {
        const input = findUnitsInput()
        if (!input) {
          if (Date.now() - startedAt > 12000) {
            window.clearInterval(timer)
            showDestinationProgress(`FAST PROC — NÃO FOI POSSÍVEL LOCALIZAR O CAMPO DE DESTINO (${destination}). Selecione manualmente.`, 'error')
            resolve(false)
          }
          return
        }

        if (!announcedInput) {
          announcedInput = true
          showDestinationProgress(`FAST PROC — LOCALIZANDO ${destination} NA LISTA DE UNIDADES…`, 'loading', input)
        }

        if (normalize(input.value) !== normalize(destination)) setFieldValue(input, destination)

        const selected = selectDestinationOption(destination, input)
        if (!selected) {
          if (Date.now() - startedAt > 12000) {
            window.clearInterval(timer)
            showDestinationProgress(`FAST PROC — SETOR ${destination} NÃO FOI SELECIONADO AUTOMATICAMENTE. CONFIRA O CAMPO DE UNIDADES.`, 'error', input)
            pulse(input)
            resolve(false)
          }
          return
        }

        window.clearInterval(timer)
        const status = showDestinationProgress(`✓ SETOR CARREGADO: ${destination} — CONFIRA E CLIQUE EM ENVIAR.`, 'ready', input)
        pulse(status)
        pulse(selected)

        ;[350, 800, 1400].forEach((delay) => {
          window.setTimeout(() => {
            const send = findSendButton()
            if (send) pulse(send)
          }, delay)
        })
        resolve(true)
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

  if (action() === 'procedimento_trabalhar') {
    autoSelectDestination().catch((error) => {
      console.error('[SEI Protocolistas] Falha ao selecionar destino automaticamente:', error)
    })
  } else {
    continueHandoff().catch((error) => {
      console.error('[SEI Protocolistas] Falha ao localizar Iniciar Processo:', error)
    })
  }
})()
