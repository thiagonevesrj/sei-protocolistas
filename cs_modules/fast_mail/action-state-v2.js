(() => {
  'use strict'

  if (window.top !== window) return

  const api = typeof browser === 'undefined' ? chrome : browser
  const PROCESS_CATALOG_PATH = 'data/catalogo-processos.json'
  const READY_TIMEOUT = 10000

  const state = {
    topics: []
  }

  function cleanText (value) {
    return String(value || '').replace(/\s+/g, ' ').trim()
  }

  function normalizeText (value) {
    return cleanText(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  }

  async function fetchJson (path) {
    const response = await fetch(api.runtime.getURL(path))
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  }

  function currentRoute () {
    const topicId = document.querySelector('#spfm-priority-topic')?.value || ''
    const topic = state.topics.find((item) => item.id === topicId)
    if (!topic) return null

    const variantId = document.querySelector('#spfm-topic-variant')?.value || ''
    const variant = Array.isArray(topic.variants)
      ? topic.variants.find((item) => item.id === variantId)
      : null

    return {
      ...topic,
      ...(variant || {})
    }
  }

  function routeState (route) {
    if (!route) return ''
    if (route.canOpenProcess && route.processId) return 'open'

    const reason = normalizeText(route.blockedReason)
    if (reason.includes('somente presencial')) return 'presential'
    if (reason.includes('sem abertura de processo administrativo') || reason.includes('nao abre processo')) return 'no-process'
    return 'unavailable'
  }

  function stateLabel (value) {
    const labels = {
      open: 'ABRE POR E-MAIL',
      presential: 'SOMENTE PRESENCIAL',
      'no-process': 'NÃO ABRE PROCESSO',
      unavailable: 'ABERTURA INDISPONÍVEL'
    }
    return labels[value] || ''
  }

  function ensureOperationalBadge () {
    const selected = document.querySelector('#spfm-v2-selected')
    if (!selected) return null

    let badge = document.querySelector('#spfm-v2-operational-state')
    if (badge) return badge

    badge = document.createElement('div')
    badge.id = 'spfm-v2-operational-state'
    badge.className = 'spfm-v2-operational-state'
    badge.hidden = true
    selected.appendChild(badge)
    return badge
  }

  function renderOperationalBadge (value, reason = '') {
    const badge = ensureOperationalBadge()
    if (!badge) return

    if (!value) {
      badge.hidden = true
      badge.textContent = ''
      badge.removeAttribute('data-state')
      badge.removeAttribute('title')
      return
    }

    badge.hidden = false
    badge.dataset.state = value
    badge.textContent = stateLabel(value)
    badge.title = cleanText(reason)
  }

  function applyNativeActions (route) {
    const actionStep = document.querySelector('#spfm-action-step')
    const reply = document.querySelector('#spfm-priority-reply')
    const missing = document.querySelector('#spfm-priority-missing')
    const open = document.querySelector('#spfm-priority-open')
    if (!actionStep || !reply || !missing || !open) return

    const value = routeState(route)
    actionStep.dataset.spfmV2State = value

    reply.textContent = 'ORIENTAR'
    missing.textContent = 'COBRAR DOCUMENTOS'

    if (value === 'open') {
      open.textContent = 'ABRIR PROCESSO'
      return
    }

    if (value === 'presential') {
      open.textContent = 'SOMENTE PRESENCIAL'
      open.disabled = true
      return
    }

    if (value === 'no-process') {
      open.textContent = 'NÃO ABRE PROCESSO'
      open.disabled = true
      return
    }

    if (value === 'unavailable') {
      open.textContent = 'ABERTURA INDISPONÍVEL'
      open.disabled = true
      return
    }

    open.textContent = 'ABRIR PROCESSO'
  }

  function applySyntheticActions () {
    const special = document.querySelector('#spfm-v2-special-actions')
    if (!special || special.hidden) return false

    const buttons = Array.from(special.querySelectorAll('button'))
    const reply = document.querySelector('#spfm-v2-certidao-reply')
    if (reply) reply.textContent = 'ORIENTAR'
    if (buttons[1]) buttons[1].textContent = 'CHECKLIST PENDENTE'
    if (buttons[2]) buttons[2].textContent = 'ABERTURA INDISPONÍVEL'

    renderOperationalBadge('unavailable', 'Checklist documental ainda não validado para abertura do processo.')
    return true
  }

  function refresh () {
    if (applySyntheticActions()) return

    const route = currentRoute()
    const value = routeState(route)
    renderOperationalBadge(value, route?.blockedReason || '')
    applyNativeActions(route)
  }

  function bind () {
    const panel = document.querySelector('#sei-protocolistas-fast-mail-status')
    if (!panel || panel.dataset.spfmV2ActionStateBound === 'true') return false

    panel.dataset.spfmV2ActionStateBound = 'true'

    panel.addEventListener('change', (event) => {
      if (event.target.matches('#spfm-priority-topic, #spfm-topic-variant, #spfm-v2-variant, #spfm-v2-orientation-topic')) {
        window.setTimeout(refresh, 0)
      }
    })

    panel.addEventListener('click', (event) => {
      if (event.target.closest('.spfm-v2-quick-button, #spfm-v2-orientation-open, [data-spfm-v2-mode]')) {
        window.setTimeout(refresh, 0)
      }
    })

    const observer = new MutationObserver(() => refresh())
    const actionStep = document.querySelector('#spfm-action-step')
    const special = document.querySelector('#spfm-v2-special-actions')
    if (actionStep) observer.observe(actionStep, { attributes: true, attributeFilter: ['hidden'] })
    if (special) observer.observe(special, { attributes: true, attributeFilter: ['hidden'] })

    refresh()
    return true
  }

  async function initialize () {
    try {
      const catalog = await fetchJson(PROCESS_CATALOG_PATH)
      state.topics = Array.isArray(catalog.fastMailPriorityTopics) ? catalog.fastMailPriorityTopics : []
    } catch (error) {
      console.error('[SEI Protocolistas] Falha ao carregar estados operacionais do FAST MAIL V2:', error)
      return
    }

    const startedAt = Date.now()
    while (Date.now() - startedAt < READY_TIMEOUT) {
      if (bind()) return
      await new Promise((resolve) => window.setTimeout(resolve, 100))
    }
  }

  initialize()
})()
