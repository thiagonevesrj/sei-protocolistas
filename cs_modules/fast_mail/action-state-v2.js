(() => {
  'use strict'

  if (window.top !== window) return

  const api = typeof browser === 'undefined' ? chrome : browser
  const PROCESS_CATALOG_PATH = 'data/catalogo-processos.json'
  const READY_TIMEOUT = 10000
  const TRANSFER_PROCESS_ID = 'transferencia-prontuario-habilitacao'

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

  function allDocuments () {
    const documents = [document]

    const visit = (win) => {
      for (let index = 0; index < win.frames.length; index += 1) {
        try {
          const frame = win.frames[index]
          if (frame.document && !documents.includes(frame.document)) {
            documents.push(frame.document)
            visit(frame)
          }
        } catch (_) {}
      }
    }

    visit(window)
    return documents
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

  function applySyntheticActions () {
    const special = document.querySelector('#spfm-v2-special-actions')
    if (!special || special.hidden) return false

    const buttons = Array.from(special.querySelectorAll('button'))
    const reply = document.querySelector('#spfm-v2-certidao-reply')
    if (reply) reply.textContent = 'ORIENTAR'
    if (buttons[1]) buttons[1].textContent = 'CHECKLIST PENDENTE'
    if (buttons[2]) buttons[2].textContent = 'ABERTURA INDISPONÍVEL'

    renderOperationalBadge('unavailable', 'Checklist documental ainda não validado para abertura do processo.')
    renderRouteMeta({ processId: 'certidao-identificacao-civil' })
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
      helper.textContent = 'MARQUE SOMENTE OS DOCUMENTOS QUE AINDA ESTÃO FALTANDO. Não peça o reenvio do que já foi recebido.'
      options.insertAdjacentElement('beforebegin', helper)
    }

    const checked = options.querySelectorAll('.spfm-missing-doc:checked').length
    insert.disabled = checked === 0
    insert.title = checked === 0
      ? 'Marque pelo menos um documento que esteja faltando.'
      : 'Inserir exigência somente com os itens marcados.'
  }

  function fixInsertedMissingRequirement () {
    let changed = false

    allDocuments().forEach((doc) => {
      doc.querySelectorAll('[data-sei-protocolistas="missing-documents-requirement"]').forEach((box) => {
        if (box.dataset.spfmMissingOnlyFixed === 'true') return

        const paragraphs = Array.from(box.querySelectorAll('p'))
        paragraphs.forEach((paragraph) => {
          const text = normalizeText(paragraph.textContent)

          if (text.includes('todos os documentos necessarios') && text.includes('ja foram enviados anteriormente')) {
            paragraph.innerHTML = 'Para prosseguirmos com o atendimento, responda a esta mesma mensagem e encaminhe, em um único e-mail, <strong>somente os documentos indicados acima como faltantes</strong>.'
            changed = true
          }

          if (text.includes('envio apenas dos documentos indicados como faltantes nao sera suficiente')) {
            paragraph.remove()
            changed = true
          }
        })

        box.dataset.spfmMissingOnlyFixed = 'true'
      })
    })

    return changed
  }

  function scheduleMissingRequirementFix () {
    ;[0, 50, 140, 300].forEach((delay) => {
      window.setTimeout(() => fixInsertedMissingRequirement(), delay)
    })
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
    fixInsertedMissingRequirement()

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
      if (event.target.closest('.spfm-v2-quick-button, #spfm-v2-orientation-open, [data-spfm-v2-mode], #spfm-priority-missing')) {
        window.setTimeout(refresh, 0)
      }
      if (event.target.closest('#spfm-insert-requirement')) {
        scheduleMissingRequirementFix()
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
