(() => {
  'use strict'

  if (window.top !== window) return

  const api = window.currentBrowser || (typeof chrome !== 'undefined' ? chrome : browser)
  const CONTEXT_KEY = 'cliqueProtocolistaContexto'
  const MAX_AGE = 60 * 60 * 1000

  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim()
  const normalize = (value) => clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

  function action () {
    return new URLSearchParams(location.search).get('acao') || ''
  }

  function storageGet (key) {
    return new Promise((resolve, reject) => {
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

  function labelText (element) {
    return normalize(element?.textContent || element?.innerText || element?.value || '')
  }

  function findUnitsLabel () {
    return Array.from(document.querySelectorAll('label, td, th, div, span'))
      .filter(visible)
      .filter((element) => /^unidades?$/.test(labelText(element)))
      .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0] || null
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
        label.closest('fieldset'),
        label.nextElementSibling,
        label.parentElement?.nextElementSibling
      ].filter(Boolean)

      for (const scope of scopes) {
        const input = Array.from(scope.querySelectorAll?.('input[type="text"], input:not([type]), textarea') || []).find(visible)
        if (input) return input
      }
    }

    const candidates = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'))
      .filter(visible)
      .filter((input) => !/pesquis|search/i.test(`${input.id} ${input.name} ${input.placeholder}`))

    return candidates.find((input) => {
      const context = normalize(`${input.parentElement?.textContent || ''} ${input.parentElement?.previousElementSibling?.textContent || ''}`)
      return context.includes('unidades')
    }) || null
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

  function nearbySelect (input) {
    const scopes = [
      input?.parentElement,
      input?.closest('tr')?.nextElementSibling,
      input?.parentElement?.nextElementSibling,
      input?.closest('fieldset')
    ].filter(Boolean)

    for (const scope of scopes) {
      const select = Array.from(scope.querySelectorAll?.('select') || []).find((item) => visible(item) || item.multiple)
      if (select) return select
    }

    return Array.from(document.querySelectorAll('select')).find((select) => {
      const optionsText = normalize(Array.from(select.options || []).map((option) => option.textContent).join(' '))
      return optionsText && !normalize(select.parentElement?.textContent || '').includes('orgao das unidades')
    }) || null
  }

  function selectDestinationOption (destination, input) {
    const wanted = normalize(destination)
    const select = nearbySelect(input)

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

    const candidates = Array.from(document.querySelectorAll('a, li, td, div, span, option'))
      .filter((element) => element !== input && visible(element))
      .filter((element) => {
        const text = labelText(element)
        return text === wanted || text.startsWith(`${wanted} `)
      })
      .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)

    const candidate = candidates[0]
    if (!candidate) return null
    const clickable = candidate.closest('a, button, li, option') || candidate
    clickable.click?.()
    return clickable
  }

  function findSendButton () {
    return Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a'))
      .filter(visible)
      .find((element) => /enviar/i.test(clean(element.value || element.textContent || element.title))) || null
  }

  function showStatus (destination, anchor) {
    let box = document.getElementById('sp-fast-proc-destination-status')
    if (!box) {
      box = document.createElement('div')
      box.id = 'sp-fast-proc-destination-status'
      box.style.margin = '8px 0'
      box.style.padding = '9px 11px'
      box.style.border = '1px solid #d2a92f'
      box.style.borderRadius = '6px'
      box.style.background = '#07182c'
      box.style.color = '#fff'
      box.style.fontWeight = '700'
      box.style.fontSize = '12px'
      anchor?.parentElement?.insertBefore(box, anchor.nextSibling)
    }
    box.textContent = `Destino selecionado automaticamente: ${destination} — confirme o destino antes de enviar.`
  }

  function pulse (element) {
    if (!element?.animate) return
    element.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
    element.animate([
      { boxShadow: '0 0 0 0 rgba(244,200,77,0)' },
      { boxShadow: '0 0 0 5px rgba(244,200,77,.9)' },
      { boxShadow: '0 0 0 0 rgba(244,200,77,0)' },
      { boxShadow: '0 0 0 5px rgba(244,200,77,.9)' },
      { boxShadow: '0 0 0 0 rgba(244,200,77,0)' }
    ], { duration: 3000, easing: 'ease-out' })
  }

  async function applyDestination () {
    if (action() !== 'procedimento_trabalhar') return

    let stored
    try {
      stored = await storageGet(CONTEXT_KEY)
    } catch (error) {
      console.warn('[SEI Protocolistas] Não foi possível ler o destino do FAST PROC:', error)
      return
    }

    const context = stored[CONTEXT_KEY]
    if (!context || context.source !== 'fast-mail') return
    if (!context.createdAt || Date.now() - context.createdAt > MAX_AGE) return

    const destination = clean(context.destino || context.destination).toUpperCase()
    if (!destination) return

    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      const input = findUnitsInput()
      if (!input) {
        if (Date.now() - startedAt > 12000) window.clearInterval(timer)
        return
      }

      if (normalize(input.value) !== normalize(destination)) setFieldValue(input, destination)

      const selected = selectDestinationOption(destination, input)
      if (!selected) return

      window.clearInterval(timer)
      showStatus(destination, input)
      pulse(selected)

      window.setTimeout(() => {
        const send = findSendButton()
        if (send) pulse(send)
      }, 900)
    }, 180)
  }

  applyDestination()
})()
