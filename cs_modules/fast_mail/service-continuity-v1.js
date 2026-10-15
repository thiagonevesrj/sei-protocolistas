(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const CUE_DURATION = 3200
  let cueTimer = null

  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim()
  const normalize = (value) => clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

  function visible (element) {
    if (!element || element.hidden || element.closest?.('[hidden]')) return false
    const style = element.ownerDocument.defaultView?.getComputedStyle(element)
    if (!style || style.display === 'none' || style.visibility === 'hidden') return false
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }

  function dispatch (element, type) {
    if (!element) return
    element.dispatchEvent(new Event(type, { bubbles: true }))
  }

  function cue (element) {
    if (!visible(element)) return false
    element.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
    element.classList.remove('spfm-workflow-v3-cue', 'spfm-v2-action-cue')
    void element.offsetWidth
    element.classList.add('spfm-workflow-v3-cue')
    if (cueTimer) window.clearTimeout(cueTimer)
    cueTimer = window.setTimeout(() => element.classList.remove('spfm-workflow-v3-cue'), CUE_DURATION)
    return true
  }

  function actionHost () {
    return document.querySelector('#spfm-workflow-v3-action-host') ||
      document.querySelector('[data-spfm-workflow-section="orientacao"]')
  }

  function exposeVariantField () {
    const field = document.querySelector('#spfm-v2-variant-field')
    const select = document.querySelector('#spfm-v2-variant')
    if (!field || !select) return null

    const options = Array.from(select.options || []).filter((option) => option.value)
    if (!options.length) return null

    field.hidden = false
    const host = actionHost()
    if (host && field.parentElement !== host) host.appendChild(field)
    if (host?.id === 'spfm-workflow-v3-action-host') host.hidden = false
    return { field, select, options }
  }

  function firstActionButton () {
    const selectors = [
      '#spfm-action-step button:not([disabled])',
      '#spfm-priority-actions button:not([disabled])',
      '#spfm-v2-special-actions button:not([disabled])'
    ]
    for (const selector of selectors) {
      const button = Array.from(document.querySelectorAll(selector)).find(visible)
      if (button) return button
    }
    return null
  }

  function setStatus (message) {
    const v2 = document.querySelector('#spfm-v2-status')
    const native = document.querySelector('#spfm-priority-status')
    if (v2) v2.textContent = message
    if (native) native.textContent = message
  }

  function selectPersonFisicaDefault () {
    const variant = exposeVariantField()
    if (!variant) return false

    const ranked = variant.options.map((option) => {
      const label = normalize(option.textContent)
      let score = 0
      if (option.value === 'pessoa-fisica') score += 200
      if (label.includes('pessoa fisica')) score += 100
      if (label.includes('duda')) score += 25
      if (label.includes('grt')) score -= 10
      if (label.includes('pessoa juridica')) score -= 200
      return { option, score }
    }).sort((a, b) => b.score - a.score)

    const best = ranked[0]
    if (!best || best.score < 100) return false

    if (variant.select.value !== best.option.value) {
      variant.select.value = best.option.value
      dispatch(variant.select, 'change')
    }

    setStatus('DEVOLUÇÃO DE TAXAS — Pessoa Física selecionada como padrão. Troque o caso somente se necessário.')
    cue(variant.field)
    window.setTimeout(() => {
      const action = firstActionButton()
      if (action) cue(action)
    }, 140)
    return true
  }

  function exposePericiaCase () {
    const variant = exposeVariantField()
    if (!variant) return false
    setStatus('PERÍCIA MÉDICA — escolha o caso para liberar a próxima ação.')
    cue(variant.field)
    return true
  }

  function schedule (handler) {
    ;[80, 180, 360, 650, 1000, 1500].forEach((delay) => {
      window.setTimeout(() => handler(), delay)
    })
  }

  function serviceButtonFromEvent (event) {
    const button = event.target?.closest?.('#spfm-workflow-v3-orientation-actions .spfm-workflow-v3-service-button')
    return button || null
  }

  document.addEventListener('click', (event) => {
    const button = serviceButtonFromEvent(event)
    if (!button) return

    const label = normalize(button.textContent)
    if (label === 'devolucao de taxas') {
      schedule(selectPersonFisicaDefault)
      return
    }

    if (label === 'pericia medica') {
      schedule(exposePericiaCase)
    }
  })

  document.addEventListener('change', (event) => {
    if (event.target?.id !== 'spfm-v2-variant') return
    window.setTimeout(() => {
      const action = firstActionButton()
      if (action) cue(action)
    }, 100)
  })
})()
