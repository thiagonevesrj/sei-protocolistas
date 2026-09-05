(() => {
  'use strict'

  if (window.top !== window) return

  const api = typeof browser === 'undefined' ? chrome : browser
  const PROCESS_CATALOG_PATH = 'data/catalogo-processos.json'
  const READY_TIMEOUT = 10000
  const TRANSFER_PROCESS_ID = 'transferencia-prontuario-habilitacao'
  const CERTIDAO_PROCESS_ID = 'certidao-identificacao-civil'

  const state = {
    topics: [],
    processTypes: []
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

  function processTypeById (processId) {
    return state.processTypes.find((item) => item.id === processId) || null
  }

  function topicByProcessId (processId) {
    return state.topics.find((item) => item.processId === processId) || null
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

  function ensureRouteMeta () {
    const selected = document.querySelector('#spfm-v2-selected')
    if (!selected) return null

    let meta = document.querySelector('#spfm-v2-route-meta')
    if (meta) return meta

    meta = document.createElement('div')
    meta.id = 'spfm-v2-route-meta'
    meta.className = 'spfm-v2-route-meta'
    meta.hidden = true
    selected.appendChild(meta)
    return meta
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

  function renderRouteMeta (route) {
    const meta = ensureRouteMeta()
    if (!meta) return

    const processType = processTypeById(route?.processId)
    if (!processType) {
      meta.hidden = true
      meta.textContent = ''
      meta.removeAttribute('title')
      return
    }

    const destination = cleanText(processType.destinationUnit)
    const seiName = cleanText(Array.isArray(processType.seiNames) ? processType.seiNames[0] : '')
      .replace(/^DETRAN:\s*/i, '')
    const parts = []

    if (destination) parts.push(destination)
    if (seiName) parts.push(`SEI: ${seiName}`)

    if (!parts.length) {
      meta.hidden = true
      meta.textContent = ''
      return
    }

    meta.hidden = false
    meta.textContent = parts.join(' · ')
    meta.title = `Atendimento: ${cleanText(processType.name)}${destination ? ` | Destino: ${destination}` : ''}${seiName ? ` | Tipo SEI: ${seiName}` : ''}`
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

  function prepareSyntheticProcess (processId) {
    const processType = processTypeById(processId)
    const procedure = document.querySelector('#spfm-procedure')
    const destination = document.querySelector('#spfm-destination')
    const destinationField = document.querySelector('#spfm-destination-field')
    const processSetup = document.querySelector('#spfm-process-setup')
    const identityFields = document.querySelector('#spfm-identity-fields')
    const status = document.querySelector('#spfm-v2-status')
    const nativeStatus = document.querySelector('#spfm-priority-status')

    if (!processType || !procedure) return false

    const hasOption = Array.from(procedure.options || []).some((option) => option.value === processId)
    if (!hasOption) return false

    procedure.value = processId
    procedure.dispatchEvent(new Event('change', { bubbles: true }))
    if (destination) destination.value = processType.destinationUnit || ''
    if (destinationField) destinationField.hidden = false
    if (processSetup) processSetup.hidden = false
    if (identityFields) identityFields.hidden = false

    if (status) status.textContent = `${processType.name}: confira nome/CPF e clique em ABRIR NO FAST PROC.`
    if (nativeStatus) nativeStatus.textContent = `${processType.name} liberada para abertura por e-mail.`
    processSetup?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
    return true
  }

  function applySyntheticActions () {
    const special = document.querySelector('#spfm-v2-special-actions')
    if (!special || special.hidden) return false

    const buttons = Array.from(special.querySelectorAll('button'))
    const reply = document.querySelector('#spfm-v2-certidao-reply')
    if (reply) reply.textContent = 'ORIENTAR'
    if (buttons[1]) {
      buttons[1].textContent = 'COBRAR DOCUMENTOS'
      buttons[1].disabled = true
      buttons[1].title = 'Checklist estruturado ainda não foi transcrito para o painel. Use ORIENTAR para conferir a lista completa do script.'
    }
    if (buttons[2]) {
      buttons[2].textContent = 'ABRIR PROCESSO'
      buttons[2].disabled = false
      buttons[2].dataset.spfmCertidaoOpen = 'true'
    }

    renderOperationalBadge('open')
    renderRouteMeta({ processId: CERTIDAO_PROCESS_ID })
    const reason = document.querySelector('#spfm-v2-special-reason')
    if (reason) reason.textContent = 'Abertura por e-mail liberada. Tipo SEI e destino DIRIC já estão definidos; confira a documentação antes de abrir.'
    return true
  }

  function ensureMissingDocumentsGuidance () {
    const list = document.querySelector('#spfm-missing-list')
    const options = document.querySelector('#spfm-missing-options')
    const insert = document.querySelector('#spfm-insert-requirement')
    if (!list || !options || !insert) return

    let helper = document.querySelector('#spfm-missing-only-helper')
    if (!helper) {
      helper = document.createElement('div')
      helper.id = 'spfm-missing-only-helper'
      helper.className = 'spfm-mini-status'
      helper.style.margin = '0 0 8px 0'
      helper.style.fontWeight = '700'
      helper.textContent = 'MARQUE SOMENTE OS DOCUMENTOS QUE ESTÃO FALTANDO. O cidadão será orientado a reenviar o conjunto completo da documentação em um único e-mail.'
      options.insertAdjacentElement('beforebegin', helper)
    }

    const checked = options.querySelectorAll('.spfm-missing-doc:checked').length
    insert.disabled = checked === 0
    insert.title = checked === 0
      ? 'Marque pelo menos um documento que esteja faltando.'
      : 'Inserir exigência destacando somente as pendências identificadas.'
  }

  function selectPriorityTopic (topic) {
    if (!topic) return false

    const phase = document.querySelector('.spfm-phase-button[data-phase-id="orientacao"]')
    const area = document.querySelector(`.spfm-area-button[data-area-id="${topic.area}"]`)
    if (!phase || !area) return false

    phase.click()
    area.click()

    const nativeTopic = document.querySelector('#spfm-priority-topic')
    const available = nativeTopic && Array.from(nativeTopic.options).some((option) => option.value === topic.id)
    if (!available) return false

    const special = document.querySelector('#spfm-v2-special-actions')
    const variantField = document.querySelector('#spfm-v2-variant-field')
    const selected = document.querySelector('#spfm-v2-selected-topic')
    const status = document.querySelector('#spfm-v2-status')
    const nativeStatus = document.querySelector('#spfm-priority-status')

    if (special) special.hidden = true
    if (variantField) variantField.hidden = true
    if (selected) selected.textContent = topic.label

    nativeTopic.value = topic.id
    nativeTopic.dispatchEvent(new Event('change', { bubbles: true }))

    if (status) status.textContent = `Atendimento selecionado: ${topic.label}. Escolha a ação abaixo.`
    if (nativeStatus) nativeStatus.textContent = `${topic.label}: escolha Orientar, Cobrar documentos ou Abrir processo.`

    window.setTimeout(refresh, 0)
    return true
  }

  function ensureTransferShortcut () {
    const container = document.querySelector('#spfm-v2-orientation-shortcuts')
    const topic = topicByProcessId(TRANSFER_PROCESS_ID)
    if (!container || !topic) return false

    const buttons = Array.from(container.querySelectorAll('button'))
    const existing = buttons.find((button) =>
      button.dataset.spfmV2ProcessId === TRANSFER_PROCESS_ID ||
      normalizeText(button.textContent).includes('transferencia de prontuario')
    )

    if (existing) {
      existing.dataset.spfmV2ProcessId = TRANSFER_PROCESS_ID
      return true
    }

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'spfm-v2-quick-button is-emphasis'
    button.dataset.spfmV2ProcessId = TRANSFER_PROCESS_ID
    button.textContent = 'Transferência de prontuário'
    button.title = 'Atendimento específico. O FAST PROC usa Solicitação Geral - Habilitação e encaminha para NUCRA.'
    button.addEventListener('click', () => selectPriorityTopic(topic))

    const target = buttons.find((item) => normalizeText(item.textContent).includes('desistencia de categoria')) ||
      buttons.find((item) => normalizeText(item.textContent).includes('generico de habilitacao'))

    if (target) container.insertBefore(button, target)
    else container.appendChild(button)
    return true
  }

  function markGenericFallbacks () {
    const container = document.querySelector('#spfm-v2-orientation-shortcuts')
    if (!container) return

    Array.from(container.querySelectorAll('.spfm-v2-quick-button')).forEach((button) => {
      const label = normalizeText(button.textContent)
      const isFallback = label.includes('generico de habilitacao') || label.includes('generico de veiculos')
      button.classList.toggle('spfm-v2-fallback-button', isFallback)
      if (isFallback) button.title = 'Use quando o serviço não possuir um atendimento específico disponível acima.'
    })
  }

  function refresh () {
    ensureTransferShortcut()
    markGenericFallbacks()
    ensureMissingDocumentsGuidance()

    if (applySyntheticActions()) return

    const route = currentRoute()
    const value = routeState(route)
    renderOperationalBadge(value, route?.blockedReason || '')
    renderRouteMeta(route)
    applyNativeActions(route)
  }

  function bind () {
    const panel = document.querySelector('#sei-protocolistas-fast-mail-status')
    const shortcuts = document.querySelector('#spfm-v2-orientation-shortcuts')
    if (!panel || !shortcuts || panel.dataset.spfmV2ActionStateBound === 'true') return false

    panel.dataset.spfmV2ActionStateBound = 'true'

    panel.addEventListener('change', (event) => {
      if (event.target.matches('#spfm-priority-topic, #spfm-topic-variant, #spfm-v2-variant, #spfm-v2-orientation-topic')) {
        window.setTimeout(refresh, 0)
      }
      if (event.target.matches('.spfm-missing-doc')) {
        window.setTimeout(ensureMissingDocumentsGuidance, 0)
      }
    })

    panel.addEventListener('click', (event) => {
      if (event.target.closest('[data-spfm-certidao-open="true"]')) {
        event.preventDefault()
        prepareSyntheticProcess(CERTIDAO_PROCESS_ID)
        return
      }
      if (event.target.closest('.spfm-v2-quick-button, #spfm-v2-orientation-open, [data-spfm-v2-mode], #spfm-priority-missing')) {
        window.setTimeout(refresh, 0)
      }
    })

    const observer = new MutationObserver(() => refresh())
    const actionStep = document.querySelector('#spfm-action-step')
    const special = document.querySelector('#spfm-v2-special-actions')
    const missingList = document.querySelector('#spfm-missing-list')
    if (actionStep) observer.observe(actionStep, { attributes: true, attributeFilter: ['hidden'] })
    if (special) observer.observe(special, { attributes: true, attributeFilter: ['hidden'] })
    if (missingList) observer.observe(missingList, { attributes: true, attributeFilter: ['hidden'] })
    observer.observe(shortcuts, { childList: true })

    refresh()
    return true
  }

  async function initialize () {
    try {
      const catalog = await fetchJson(PROCESS_CATALOG_PATH)
      state.topics = Array.isArray(catalog.fastMailPriorityTopics) ? catalog.fastMailPriorityTopics : []
      state.processTypes = Array.isArray(catalog.processTypes) ? catalog.processTypes : []
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
