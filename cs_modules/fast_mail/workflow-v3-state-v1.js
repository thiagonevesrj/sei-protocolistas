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
    if (!element || element.hidden || element.closest('[hidden]')) return false
    const style = element.ownerDocument.defaultView?.getComputedStyle(element)
    if (!style || style.display === 'none' || style.visibility === 'hidden') return false
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
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

  function nextUsefulTarget () {
    const selectors = [
      '#spfm-p0-baixa-chooser button:not([disabled])',
      '#spfm-v2-variant-field',
      '#spfm-v2-special-actions button:not([disabled])',
      '#spfm-p0-presential-panel input:not([disabled]), #spfm-p0-presential-panel button:not([disabled])',
      '#spfm-action-step button:not([disabled])',
      '#spfm-priority-actions button:not([disabled])',
      '#spfm-insert-script:not([disabled])',
      '#spfm-open-process:not([disabled])'
    ]

    for (const selector of selectors) {
      const found = Array.from(document.querySelectorAll(selector)).find(visible)
      if (found) return found
    }
    return null
  }

  function guideNext () {
    const target = nextUsefulTarget()
    return target ? cue(target) : false
  }

  function scheduleGuide () {
    ;[100, 260, 520, 900, 1400].forEach((delay) => {
      window.setTimeout(() => guideNext(), delay)
    })
  }

  function clearPreviousServiceState () {
    ;[
      '#spfm-p0-baixa-chooser',
      '#spfm-p0-presential-panel',
      '#spfm-v2-inventory-chooser',
      '#spfm-v2-oficio-chooser'
    ].forEach((selector) => document.querySelector(selector)?.remove())

    const host = document.querySelector('#spfm-workflow-v3-action-host')
    if (host && !Array.from(host.children).some((child) => visible(child))) host.hidden = true
  }

  function selectDefaultPersonFisica () {
    const select = document.querySelector('#spfm-v2-variant')
    if (!select || !visible(select)) return false

    const options = Array.from(select.options || []).filter((option) => option.value)
    const best = options
      .map((option) => {
        const label = normalize(option.textContent)
        let score = 0
        if (label.includes('pessoa fisica')) score += 100
        if (label.includes('duda')) score += 25
        if (label.includes('grt')) score -= 5
        if (label.includes('pessoa juridica')) score -= 100
        return { option, score }
      })
      .sort((a, b) => b.score - a.score)[0]

    if (!best || best.score < 100) return false
    if (select.value !== best.option.value) {
      select.value = best.option.value
      select.dispatchEvent(new Event('change', { bubbles: true }))
    }
    cue(select.closest('#spfm-v2-variant-field') || select)
    return true
  }

  function schedulePersonFisicaDefault () {
    ;[100, 250, 500, 850].forEach((delay) => {
      window.setTimeout(() => selectDefaultPersonFisica(), delay)
    })
  }

  function serviceButtonFromEvent (event) {
    return event.target.closest?.(
      '#spfm-workflow-v3-orientation-actions .spfm-workflow-v3-service-button, #spfm-workflow-v3-orientation-results .spfm-workflow-v3-result'
    ) || null
  }

  document.addEventListener('click', (event) => {
    const serviceButton = serviceButtonFromEvent(event)
    if (!serviceButton) return

    const label = normalize(serviceButton.textContent)
    clearPreviousServiceState()

    if (label.includes('devolucao de taxas')) schedulePersonFisicaDefault()
    scheduleGuide()
  }, true)

  document.addEventListener('click', (event) => {
    const stageButton = event.target.closest?.('[data-spfm-workflow-stage]')
    if (!stageButton) return
    clearPreviousServiceState()
  }, true)
})()
