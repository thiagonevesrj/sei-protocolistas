(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const BAIXA_BUTTON_ID = 'spfm-p0-baixa-restricao'
  const CERTIDAO_TOPIC_ID = 'certidao-identificacao-civil'
  const HIDDEN_IDENTIFICATION_SHORTCUTS = new Set([
    'identificar o servico',
    'identificar servico',
    'simples identificacao',
    'devolucao de taxas',
    'pericia medica',
    'inventario'
  ])

  const ORIENTATION_PRIORITY = [
    'devolucao de taxas',
    'desistencia de categoria',
    'generico habilitacao',
    'generico veiculos',
    'baixa de restricao',
    'pericia medica',
    'transferencia de prontuario',
    'troca de clinica',
    'leilao',
    'certidao de identificacao civil',
    'oficios'
  ]

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

  function reconcileIdentificationShortcuts () {
    const container = document.querySelector('#spfm-v2-identification-shortcuts')
    if (!container) return

    const buttons = Array.from(container.querySelectorAll('.spfm-v2-quick-button'))

    buttons.forEach((button) => {
      const text = normalize(button.textContent)
      const isComplete = text === 'solicitar identificacao' || text === 'identificacao completa'
      const isBaixa = button.id === BAIXA_BUTTON_ID

      if (isComplete) {
        if (button.textContent !== 'IDENTIFICAÇÃO COMPLETA') {
          button.textContent = 'IDENTIFICAÇÃO COMPLETA'
        }
        button.hidden = false
        button.style.removeProperty('display')
        button.removeAttribute('aria-hidden')
        button.title = 'Inserir o Script de Identificação Completo'
        return
      }

      if (isBaixa) {
        button.hidden = false
        button.style.removeProperty('display')
        button.removeAttribute('aria-hidden')
        return
      }

      if (HIDDEN_IDENTIFICATION_SHORTCUTS.has(text)) {
        button.hidden = true
        button.style.display = 'none'
        button.setAttribute('aria-hidden', 'true')
      }
    })

    const state = document.querySelector('#spfm-p0-identity-state')
    if (state && /use identificar servi[cç]o/i.test(state.textContent || '')) {
      state.innerHTML = '<strong style="color:#f1c44f;">IDENTIDADE CONFIRMADA</strong><br><span>Serviço/destino ainda não identificado. Use a busca do FAST MAIL ou IDENTIFICAÇÃO COMPLETA se precisar solicitar esclarecimentos ao requerente.</span>'
    }
  }

  function legacyCertidaoButton () {
    return Array.from(document.querySelectorAll('#spfm-v2-orientation-shortcuts .spfm-v2-quick-button'))
      .find((button) => normalize(button.textContent) === 'certidao de identificacao civil') || null
  }

  function markCertidaoSelected (button) {
    const container = document.querySelector('#spfm-workflow-v3-orientation-actions')
    if (!container) return

    container.querySelectorAll('.spfm-workflow-v3-service-button').forEach((item) => {
      const selected = item === button || normalize(item.textContent) === 'certidao de identificacao civil'
      item.classList.toggle('is-selected', selected)
      item.setAttribute('aria-pressed', String(selected))
    })
  }

  function activateNativeCertidao (button) {
    const phase = document.querySelector('.spfm-phase-button[data-phase-id="orientacao"]')
    const topic = document.querySelector('#spfm-priority-topic')
    if (!phase || !topic) return false

    phase.click()

    let option = Array.from(topic.options || []).find((item) => item.value === CERTIDAO_TOPIC_ID)
    if (!option) {
      option = document.createElement('option')
      option.value = CERTIDAO_TOPIC_ID
      option.textContent = 'Certidão de Identificação Civil'
      topic.appendChild(option)
    }

    topic.value = CERTIDAO_TOPIC_ID
    topic.dispatchEvent(new Event('change', { bubbles: true }))

    const selected = document.querySelector('#spfm-v2-selected-topic')
    if (selected) selected.textContent = 'Certidão de Identificação Civil'

    const special = document.querySelector('#spfm-v2-special-actions')
    if (special) special.hidden = true

    markCertidaoSelected(button)

    const workflowStatus = document.querySelector('#spfm-workflow-v3-status')
    if (workflowStatus) {
      workflowStatus.textContent = 'Certidão de Identificação Civil selecionada. Escolha ORIENTAR, COBRAR DOCUMENTOS ou ABRIR PROCESSO.'
    }

    return true
  }

  function ensureCertidaoShortcut (container) {
    const existing = Array.from(container.querySelectorAll('.spfm-workflow-v3-service-button'))
      .find((button) => normalize(button.textContent) === 'certidao de identificacao civil')
    if (existing) return existing

    const legacy = legacyCertidaoButton()
    if (!legacy) return null

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'spfm-workflow-v3-service-button'
    button.setAttribute('aria-pressed', 'false')
    button.textContent = 'Certidão de Identificação Civil'
    button.title = 'Certidão de Identificação Civil — atendimento com checklist documental validado pelo card atual'
    button.addEventListener('click', () => {
      if (!activateNativeCertidao(button)) legacy.click()
    })
    container.appendChild(button)
    return button
  }

  function setOficiosAttentionStyle (button) {
    if (!button) return
    button.style.gridColumn = '1 / -1'
    button.style.minHeight = '50px'
    button.style.background = '#7d3218'
    button.style.color = '#ffffff'
    button.style.border = '2px solid #f4c84d'
    button.style.boxShadow = '0 0 0 2px rgba(244, 200, 77, .14)'
    button.style.letterSpacing = '.02em'
    if (button.textContent !== '⚠ OFÍCIOS — ATENÇÃO') button.textContent = '⚠ OFÍCIOS — ATENÇÃO'
    button.title = 'OFÍCIOS — atendimento de atenção especial. Confira o cenário antes de prosseguir.'
  }

  function reconcileOrientationShortcuts () {
    const container = document.querySelector('#spfm-workflow-v3-orientation-actions')
    if (!container) return

    ensureCertidaoShortcut(container)

    const buttons = Array.from(container.querySelectorAll('.spfm-workflow-v3-service-button'))
    if (!buttons.length) return

    const buttonFor = (wanted) => buttons.find((button) => {
      const text = normalize(button.textContent)
      if (wanted === 'oficios') return text.includes('oficios')
      return text === wanted
    })

    const ordered = ORIENTATION_PRIORITY.map(buttonFor).filter(Boolean)
    const leftovers = buttons.filter((button) => !ordered.includes(button))
    const desired = [...ordered, ...leftovers]
    const current = Array.from(container.querySelectorAll('.spfm-workflow-v3-service-button'))

    const orderChanged = desired.length === current.length && desired.some((button, index) => current[index] !== button)
    if (orderChanged) desired.forEach((button) => container.appendChild(button))

    const oficios = desired.find((button) => normalize(button.textContent).includes('oficios'))
    setOficiosAttentionStyle(oficios)
  }

  let scheduled = false
  function scheduleReconcile () {
    if (scheduled) return
    scheduled = true
    window.setTimeout(() => {
      scheduled = false
      reconcileIdentificationShortcuts()
      reconcileOrientationShortcuts()
    }, 40)
  }

  reconcileIdentificationShortcuts()
  reconcileOrientationShortcuts()
  window.setTimeout(() => {
    reconcileIdentificationShortcuts()
    reconcileOrientationShortcuts()
  }, 250)
  window.setTimeout(() => {
    reconcileIdentificationShortcuts()
    reconcileOrientationShortcuts()
  }, 900)

  const observer = new MutationObserver(scheduleReconcile)
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  })
})()
