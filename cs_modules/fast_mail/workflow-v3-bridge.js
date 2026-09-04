(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const api = typeof browser === 'undefined' ? chrome : browser
  const PROCESS_CATALOG_PATH = 'data/catalogo-processos.json'
  const TRANSFER_PROCESS_ID = 'transferencia-prontuario-habilitacao'
  const HOST_ID = 'spfm-workflow-v3-action-host'
  const TRANSFER_BUTTON_ID = 'spfm-workflow-v3-transferencia-prontuario'
  const CUE_DURATION = 2800

  let processCatalog = null
  let observer = null
  let reconcileTimer = null

  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim()

  function normalize (value) {
    return clean(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  }

  async function fetchJson (path) {
    const response = await fetch(api.runtime.getURL(path))
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  }

  function dispatch (element, type) {
    if (!element) return
    element.dispatchEvent(new Event(type, { bubbles: true }))
  }

  function visible (element) {
    if (!element) return false
    const style = element.ownerDocument.defaultView?.getComputedStyle(element)
    if (!style || style.display === 'none' || style.visibility === 'hidden') return false
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }

  function cue (element) {
    if (!element) return
    element.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
    element.classList.remove('spfm-workflow-v3-cue')
    void element.offsetWidth
    element.classList.add('spfm-workflow-v3-cue')
    window.setTimeout(() => element.classList.remove('spfm-workflow-v3-cue'), CUE_DURATION)
  }

  function actionHost () {
    let host = document.getElementById(HOST_ID)
    if (host) return host

    const orientation = document.querySelector('[data-spfm-workflow-section="orientacao"]')
    const shortcuts = document.querySelector('#spfm-workflow-v3-orientation-actions')
    if (!orientation || !shortcuts) return null

    host = document.createElement('div')
    host.id = HOST_ID
    host.style.display = 'grid'
    host.style.gap = '8px'
    host.style.margin = '8px 0 2px'
    host.hidden = true
    shortcuts.insertAdjacentElement('afterend', host)
    return host
  }

  function activeStage () {
    return document.querySelector('[data-spfm-workflow-stage].is-active')?.dataset.spfmWorkflowStage || ''
  }

  function syncHostVisibility () {
    const host = actionHost()
    if (!host) return
    const hasVisibleChild = Array.from(host.children).some((child) => !child.hidden)
    host.hidden = activeStage() !== 'orientacao' || !hasVisibleChild
  }

  function operationalControls () {
    return [
      document.querySelector('#spfm-p0-baixa-chooser'),
      document.querySelector('#spfm-v2-variant-field'),
      document.querySelector('#spfm-v2-special-actions'),
      document.querySelector('#spfm-p0-presential-panel')
    ].filter(Boolean)
  }

  function moveOperationalControls () {
    const host = actionHost()
    if (!host) return false

    let moved = false
    operationalControls().forEach((element) => {
      if (element.parentElement === host) return
      host.appendChild(element)
      moved = true
    })

    syncHostVisibility()

    if (moved && !host.hidden) {
      const next = Array.from(host.querySelectorAll('button:not([disabled]), select:not([disabled]), input:not([disabled])')).find(visible)
      if (next) window.setTimeout(() => cue(next), 40)
    }

    return moved
  }

  function orientationTopics () {
    return Array.isArray(processCatalog?.fastMailPriorityTopics)
      ? processCatalog.fastMailPriorityTopics
      : []
  }

  function transferTopic () {
    const wanted = normalize('transferencia de prontuario')
    return orientationTopics().find((topic) =>
      topic.processId === TRANSFER_PROCESS_ID ||
      topic.id === TRANSFER_PROCESS_ID ||
      normalize(topic.label).includes(wanted)
    ) || null
  }

  function selectOrientationTopic (topic) {
    if (!topic) return false

    const area = document.querySelector('#spfm-v2-orientation-area')
    const select = document.querySelector('#spfm-v2-orientation-topic')
    const open = document.querySelector('#spfm-v2-orientation-open')
    if (!area || !select || !open) return false

    if (topic.area && Array.from(area.options).some((option) => option.value === topic.area)) {
      area.value = topic.area
      dispatch(area, 'change')
    }

    window.setTimeout(() => {
      const exists = Array.from(select.options).some((option) => option.value === topic.id)
      if (!exists) return
      select.value = topic.id
      dispatch(select, 'change')
      open.click()
      window.setTimeout(() => {
        moveOperationalControls()
        const next = document.querySelector('#spfm-action-step button:not([disabled]), #spfm-priority-actions button:not([disabled])')
        if (visible(next)) cue(next)
      }, 80)
    }, 40)

    return true
  }

  function injectTransferShortcut () {
    if (document.getElementById(TRANSFER_BUTTON_ID)) return
    const container = document.querySelector('#spfm-workflow-v3-orientation-actions')
    const topic = transferTopic()
    if (!container || !topic) return

    const button = document.createElement('button')
    button.id = TRANSFER_BUTTON_ID
    button.type = 'button'
    button.className = 'spfm-workflow-v3-service-button is-emphasis'
    button.textContent = 'Transferência de Prontuário'
    button.addEventListener('click', () => selectOrientationTopic(topic))
    container.appendChild(button)
  }

  function bindStageButtons () {
    document.querySelectorAll('[data-spfm-workflow-stage]').forEach((button) => {
      if (button.dataset.spfmWorkflowBridgeBound === 'true') return
      button.dataset.spfmWorkflowBridgeBound = 'true'
      button.addEventListener('click', () => {
        window.setTimeout(() => {
          moveOperationalControls()
          syncHostVisibility()
        }, 30)
      })
    })
  }

  function reconcile () {
    if (!document.getElementById('spfm-workflow-v3')) return
    actionHost()
    injectTransferShortcut()
    bindStageButtons()
    moveOperationalControls()
  }

  function scheduleReconcile () {
    if (reconcileTimer) return
    reconcileTimer = window.setTimeout(() => {
      reconcileTimer = null
      reconcile()
    }, 35)
  }

  async function init () {
    try {
      processCatalog = await fetchJson(PROCESS_CATALOG_PATH)
    } catch (error) {
      console.warn('[SEI Protocolistas] Ponte do fluxo V3 iniciou sem catálogo completo:', error)
    }

    observer = new MutationObserver(scheduleReconcile)
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] })

    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      reconcile()
      if (document.getElementById('spfm-workflow-v3') || Date.now() - startedAt > 12000) window.clearInterval(timer)
    }, 120)
  }

  init()
})()
