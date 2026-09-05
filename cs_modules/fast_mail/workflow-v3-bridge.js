(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const api = typeof browser === 'undefined' ? chrome : browser
  const PROCESS_CATALOG_PATH = 'data/catalogo-processos.json'
  const SCRIPT_CATALOG_PATH = 'data/catalogo-scripts.json'
  const TRANSFER_PROCESS_ID = 'transferencia-prontuario-habilitacao'
  const HOST_ID = 'spfm-workflow-v3-action-host'
  const TRANSFER_BUTTON_ID = 'spfm-workflow-v3-transferencia-prontuario'
  const IDENTIFICATION_FLOW_ID = 'spfm-workflow-v3-identification-flow'
  const PANEL_COLLAPSE_KEY = 'seiProtocolistasFastMailCollapsed'
  const CUE_DURATION = 3200

  const IDENTIFICATION_RESPONSES = {
    'identificacao completa': 'SCRIPT DE IDENTIFICAÇÃO COMPLETO',
    'identificar servico': 'SCRIPT DE IDENTIFICAÇÃO DO SERVIÇO',
    'nao e conosco': 'SCRIPT - ESTE SERVIÇO NÃO É CONOSCO',
    ouvidoria: 'E COM A OUVIDORIA',
    'simples identificacao': 'SCRIPT DE SIMPLES IDENTIFICAÇÃO'
  }

  let processCatalog = null
  let scriptCatalog = []
  let observer = null
  let reconcileTimer = null
  let cueTimer = null
  let autoPreparationTimer = null
  let emailPreparationPending = false
  let manualPreparationNeeded = false
  let selectedIdentificationTitle = ''

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

  function workflowStatus () {
    return document.querySelector('#spfm-workflow-v3-status') || document.querySelector('#spfm-priority-status')
  }

  function setWorkflowStatus (message) {
    const workflow = document.querySelector('#spfm-workflow-v3-status')
    const native = document.querySelector('#spfm-priority-status')
    if (workflow) workflow.textContent = message
    if (native) native.textContent = message
  }

  function syncManualPreparationVisibility () {
    const section = document.querySelector('#spfm-email-preparation')
    if (!section) return
    section.hidden = !manualPreparationNeeded
  }

  function checkAutomaticPreparationResult (button) {
    window.setTimeout(() => {
      if (!button) return
      const text = normalize(button.textContent)
      const failed = /erro|digite|nao localizei|operador nao identificado|abra a tela/.test(text)
      if (!failed) {
        manualPreparationNeeded = false
        syncManualPreparationVisibility()
        return
      }

      manualPreparationNeeded = true
      syncManualPreparationVisibility()
      setWorkflowStatus('A preparação automática não terminou. Use PREPARAR E-MAIL para tentar novamente.')
      window.setTimeout(() => cue(document.querySelector('#spfm-triagem')), 40)
    }, 650)
  }

  function tryAutomaticEmailPreparation () {
    if (!emailPreparationPending) return false

    const prepare = document.querySelector('#spfm-triagem')
    if (!prepare) return false

    const noData = Boolean(document.querySelector('#spfm-workflow-v3-requester-no-data')?.checked)
    if (noData) {
      emailPreparationPending = false
      manualPreparationNeeded = false
      syncManualPreparationVisibility()
      setWorkflowStatus('Resposta inserida. Assunto original mantido porque o requerente foi marcado SEM DADOS.')
      return true
    }

    const name = clean(document.querySelector('#spfm-requester-name')?.value)
    if (!name) {
      manualPreparationNeeded = false
      syncManualPreparationVisibility()
      setWorkflowStatus('Resposta inserida. Informe o nome do requerente e o e-mail será preparado automaticamente.')
      return false
    }

    emailPreparationPending = false
    manualPreparationNeeded = false
    syncManualPreparationVisibility()
    setWorkflowStatus('Resposta inserida. Preparando assunto e Bcc automaticamente…')
    prepare.click()
    checkAutomaticPreparationResult(prepare)
    return true
  }

  function scheduleAutomaticEmailPreparation (delay = 180) {
    emailPreparationPending = true
    manualPreparationNeeded = false
    syncManualPreparationVisibility()
    if (autoPreparationTimer) window.clearTimeout(autoPreparationTimer)
    autoPreparationTimer = window.setTimeout(() => {
      autoPreparationTimer = null
      tryAutomaticEmailPreparation()
    }, delay)
  }

  function bindAutomaticEmailPreparation () {
    if (document.documentElement.dataset.spfmWorkflowAutoPreparationBound === 'true') return
    document.documentElement.dataset.spfmWorkflowAutoPreparationBound = 'true'

    document.addEventListener('click', (event) => {
      const control = event.target.closest?.(
        '#spfm-insert-script, #spfm-insert-requirement, #spfm-baixa-direct-insert, #spfm-workflow-v3-identification-insert'
      )
      if (!control) return
      if (control.id === 'spfm-workflow-v3-identification-insert' && control.dataset.ready !== 'true') return
      scheduleAutomaticEmailPreparation(220)
    })

    document.addEventListener('input', (event) => {
      if (!emailPreparationPending) return
      if (!event.target.matches?.('#spfm-requester-name, #spfm-workflow-v3-requester-name')) return
      if (autoPreparationTimer) window.clearTimeout(autoPreparationTimer)
      autoPreparationTimer = window.setTimeout(() => {
        autoPreparationTimer = null
        tryAutomaticEmailPreparation()
      }, 420)
    })

    document.addEventListener('change', (event) => {
      if (!emailPreparationPending) return
      if (!event.target.matches?.('#spfm-requester-name, #spfm-workflow-v3-requester-name, #spfm-workflow-v3-requester-no-data')) return
      scheduleAutomaticEmailPreparation(80)
    })
  }

  function applyCollapsedState (panel, collapsed) {
    const body = panel?.querySelector('#spfm-panel-body')
    const button = panel?.querySelector('#spfm-collapse')
    if (!panel || !body || !button) return false

    panel.classList.toggle('spfm-collapsed', collapsed)
    body.hidden = collapsed
    button.textContent = collapsed ? '+' : '−'
    button.title = collapsed ? 'Expandir FAST MAIL' : 'Recolher FAST MAIL'
    button.setAttribute('aria-expanded', String(!collapsed))
    return true
  }

  function bindCollapseControl () {
    const panel = document.querySelector('#sei-protocolistas-fast-mail-status')
    const button = panel?.querySelector('#spfm-collapse')
    if (!panel || !button || button.dataset.spfmWorkflowCollapseBound === 'true') return

    button.dataset.spfmWorkflowCollapseBound = 'true'

    const saved = localStorage.getItem(PANEL_COLLAPSE_KEY)
    if (saved === 'true' || saved === 'false') applyCollapsedState(panel, saved === 'true')

    button.addEventListener('mousedown', (event) => {
      event.stopPropagation()
    }, true)

    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      const collapsed = !panel.classList.contains('spfm-collapsed')
      applyCollapsedState(panel, collapsed)
      localStorage.setItem(PANEL_COLLAPSE_KEY, String(collapsed))
    }, true)
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
      const target = Array.from(document.querySelectorAll(selector)).find(visible)
      if (target) return target
    }
    return null
  }

  function scheduleNextGuide () {
    ;[100, 260, 520, 900, 1400].forEach((delay) => {
      window.setTimeout(() => {
        moveOperationalControls()
        const target = nextUsefulTarget()
        if (target) cue(target)
      }, delay)
    })
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
    const hasVisibleChild = Array.from(host.children).some((child) => visible(child) || Array.from(child.querySelectorAll?.('button,select,input') || []).some(visible))
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

  function clearPreviousServiceState () {
    ;[
      '#spfm-p0-baixa-chooser',
      '#spfm-p0-presential-panel',
      '#spfm-v2-inventory-chooser',
      '#spfm-v2-oficio-chooser'
    ].forEach((selector) => document.querySelector(selector)?.remove())
    syncHostVisibility()
  }

  function clearSelectedService () {
    document.querySelectorAll('#spfm-workflow-v3-orientation-actions .spfm-workflow-v3-service-button.is-selected')
      .forEach((button) => {
        button.classList.remove('is-selected')
        button.setAttribute('aria-pressed', 'false')
      })
  }

  function selectServiceButton (button) {
    if (!button?.classList?.contains('spfm-workflow-v3-service-button')) return
    clearSelectedService()
    button.classList.add('is-selected')
    button.setAttribute('aria-pressed', 'true')
  }

  function clearSelectedIdentificationAction () {
    document.querySelectorAll(
      '#spfm-workflow-v3-identification-actions .spfm-workflow-v3-action.is-selected, #spfm-workflow-v3-simple.is-selected'
    ).forEach((button) => {
      button.classList.remove('is-selected')
      button.setAttribute('aria-pressed', 'false')
    })
  }

  function selectIdentificationAction (button) {
    if (!button) return
    clearSelectedIdentificationAction()
    button.classList.add('is-selected')
    button.setAttribute('aria-pressed', 'true')
  }

  function selectDefaultPersonFisica () {
    const select = document.querySelector('#spfm-v2-variant')
    if (!select || !visible(select)) return false

    const options = Array.from(select.options || []).filter((option) => option.value)
    const best = options.map((option) => {
      const label = normalize(option.textContent)
      let score = 0
      if (label.includes('pessoa fisica')) score += 100
      if (label.includes('duda')) score += 25
      if (label.includes('grt')) score -= 5
      if (label.includes('pessoa juridica')) score -= 100
      return { option, score }
    }).sort((a, b) => b.score - a.score)[0]

    if (!best || best.score < 100) return false
    if (select.value !== best.option.value) {
      select.value = best.option.value
      dispatch(select, 'change')
    }
    cue(select.closest('#spfm-v2-variant-field') || select)
    return true
  }

  function schedulePersonFisicaDefault () {
    ;[100, 250, 500, 850].forEach((delay) => {
      window.setTimeout(() => selectDefaultPersonFisica(), delay)
    })
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
      scheduleNextGuide()
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
    button.setAttribute('aria-pressed', 'false')
    button.textContent = 'Transferência de Prontuário'
    button.addEventListener('click', () => selectOrientationTopic(topic))
    container.appendChild(button)
  }

  function scriptByTitle (title) {
    const wanted = normalize(title)
    return scriptCatalog.find((script) => normalize(script.title) === wanted && clean(script.body)) || null
  }

  function selectNativeScriptWithoutInsert (script) {
    if (!script) return false

    const phase = document.querySelector('#spfm-script-phase')
    const search = document.querySelector('#spfm-script-search')
    const result = document.querySelector('#spfm-script-result')
    if (!phase || !search || !result) return false

    if (Array.from(phase.options || []).some((option) => option.value === script.phase)) {
      phase.value = script.phase
      dispatch(phase, 'change')
    }

    search.value = script.title
    dispatch(search, 'input')

    const option = Array.from(result.options || []).find((candidate) => candidate.value === script.id)
    if (!option) return false

    result.value = script.id
    dispatch(result, 'change')
    return true
  }

  function nativeRequesterFields () {
    return {
      name: document.querySelector('#spfm-requester-name'),
      cpf: document.querySelector('#spfm-requester-cpf')
    }
  }

  function syncRequesterToNative (nameValue, cpfValue) {
    const native = nativeRequesterFields()
    if (native.name) {
      native.name.value = clean(nameValue)
      dispatch(native.name, 'input')
      dispatch(native.name, 'change')
    }
    if (native.cpf) {
      native.cpf.value = clean(cpfValue)
      dispatch(native.cpf, 'input')
      dispatch(native.cpf, 'change')
    }
  }

  function identificationFlow () {
    return document.getElementById(IDENTIFICATION_FLOW_ID)
  }

  function clearIdentificationPendingState (flow) {
    if (!flow) return
    flow.querySelectorAll('.is-pending, .is-alternative-pending').forEach((element) => {
      element.classList.remove('is-pending', 'is-alternative-pending')
    })
  }

  function identificationReadiness (flow) {
    const name = flow?.querySelector('#spfm-workflow-v3-requester-name')
    const cpf = flow?.querySelector('#spfm-workflow-v3-requester-cpf')
    const noData = flow?.querySelector('#spfm-workflow-v3-requester-no-data')
    const hasName = Boolean(clean(name?.value))
    const hasCpf = String(cpf?.value || '').replace(/\D/g, '').length === 11
    return {
      name,
      cpf,
      noData,
      hasName,
      hasCpf,
      identified: hasName && hasCpf,
      ready: Boolean(selectedIdentificationTitle) && Boolean(noData?.checked || (hasName && hasCpf))
    }
  }

  function guideMissingIdentificationData (flow) {
    const status = flow?.querySelector('#spfm-workflow-v3-identification-status')
    const state = identificationReadiness(flow)
    if (!flow || !state.name || !state.cpf || !state.noData) return

    clearIdentificationPendingState(flow)
    const nameLabel = state.name.closest('label')
    const cpfLabel = state.cpf.closest('label')
    const noDataLabel = state.noData.closest('label')

    if (!state.hasName) nameLabel?.classList.add('is-pending')
    if (!state.hasCpf) cpfLabel?.classList.add('is-pending')
    noDataLabel?.classList.add('is-alternative-pending')

    if (status) {
      status.textContent = 'FALTA CONFIRMAR O REQUERENTE — informe nome completo + CPF ou marque REQUERENTE SEM DADOS.'
    }

    const firstMissing = !state.hasName ? (nameLabel || state.name) : !state.hasCpf ? (cpfLabel || state.cpf) : noDataLabel
    window.setTimeout(() => cue(firstMissing || flow), 20)
    window.setTimeout(() => cue(noDataLabel || flow), 650)
  }

  function updateIdentificationInsertState () {
    const flow = identificationFlow()
    if (!flow) return

    const name = flow.querySelector('#spfm-workflow-v3-requester-name')
    const cpf = flow.querySelector('#spfm-workflow-v3-requester-cpf')
    const noData = flow.querySelector('#spfm-workflow-v3-requester-no-data')
    const insert = flow.querySelector('#spfm-workflow-v3-identification-insert')
    const status = flow.querySelector('#spfm-workflow-v3-identification-status')
    if (!name || !cpf || !noData || !insert || !status) return

    name.disabled = noData.checked
    cpf.disabled = noData.checked

    const state = identificationReadiness(flow)
    const hasResponse = Boolean(selectedIdentificationTitle)

    insert.disabled = !hasResponse
    insert.dataset.ready = String(state.ready)
    insert.setAttribute('aria-disabled', String(!state.ready))
    insert.classList.toggle('is-logically-blocked', hasResponse && !state.ready)
    noData.closest('label')?.classList.toggle('is-checked', noData.checked)

    if (state.ready || noData.checked) clearIdentificationPendingState(flow)
    else {
      if (state.hasName) name.closest('label')?.classList.remove('is-pending')
      if (state.hasCpf) cpf.closest('label')?.classList.remove('is-pending')
    }

    if (!selectedIdentificationTitle) {
      status.textContent = 'Escolha primeiro a resposta de identificação.'
    } else if (noData.checked) {
      status.textContent = 'REQUERENTE SEM DADOS marcado. A resposta está pronta para inserção.'
    } else if (!state.identified) {
      status.textContent = 'Informe nome completo + CPF ou marque REQUERENTE SEM DADOS.'
    } else {
      status.textContent = 'Dados confirmados. A resposta está pronta para inserção.'
    }
  }

  function ensureIdentificationFlow () {
    let flow = identificationFlow()
    if (flow) return flow

    const section = document.querySelector('[data-spfm-workflow-section="identificacao"]')
    const simple = document.querySelector('#spfm-workflow-v3-simple')
    if (!section) return null

    flow = document.createElement('div')
    flow.id = IDENTIFICATION_FLOW_ID
    flow.hidden = true
    flow.style.display = 'grid'
    flow.style.gap = '9px'
    flow.style.padding = '10px'
    flow.style.border = '1px solid rgba(244, 200, 77, .5)'
    flow.style.borderRadius = '10px'
    flow.style.background = 'rgba(7, 24, 44, .92)'
    flow.innerHTML = `
      <div class="spfm-workflow-v3-kicker">DADOS DO REQUERENTE</div>
      <label class="spfm-workflow-v3-requester-field" style="display:grid;gap:4px;font-size:10px;color:#dce6f1">
        <span>Nome completo</span>
        <input id="spfm-workflow-v3-requester-name" type="text" autocomplete="off" placeholder="Nome completo" style="box-sizing:border-box;width:100%;padding:9px;border:1px solid #314861;border-radius:8px;background:#07182c;color:#fff">
      </label>
      <label class="spfm-workflow-v3-requester-field" style="display:grid;gap:4px;font-size:10px;color:#dce6f1">
        <span>CPF</span>
        <input id="spfm-workflow-v3-requester-cpf" type="text" inputmode="numeric" maxlength="14" autocomplete="off" placeholder="CPF do requerente" style="box-sizing:border-box;width:100%;padding:9px;border:1px solid #314861;border-radius:8px;background:#07182c;color:#fff">
      </label>
      <label class="spfm-workflow-v3-no-data" style="display:flex;align-items:center;gap:7px;padding:8px;border:1px dashed #51647a;border-radius:8px;font-size:10px;font-weight:800;color:#fff;cursor:pointer">
        <input id="spfm-workflow-v3-requester-no-data" type="checkbox">
        <span>REQUERENTE SEM DADOS</span>
      </label>
      <div style="display:grid;gap:4px;border-left:3px solid #f4c84d;padding:7px 9px;background:#0d2239;border-radius:0 8px 8px 0">
        <span style="font-size:9px;font-weight:800;color:#f4c84d">RESPOSTA SELECIONADA</span>
        <strong id="spfm-workflow-v3-identification-response" style="font-size:11px;color:#fff">Nenhuma</strong>
      </div>
      <button id="spfm-workflow-v3-identification-insert" type="button" disabled style="min-height:42px;border:1px solid #f4c84d;border-radius:9px;background:#f4c84d;color:#07182c;font-weight:900;cursor:pointer">INSERIR RESPOSTA</button>
      <div id="spfm-workflow-v3-identification-status" style="font-size:9px;color:#aab8c9;line-height:1.35">Escolha primeiro a resposta de identificação.</div>
    `

    if (simple) simple.insertAdjacentElement('afterend', flow)
    else section.appendChild(flow)

    const native = nativeRequesterFields()
    const name = flow.querySelector('#spfm-workflow-v3-requester-name')
    const cpf = flow.querySelector('#spfm-workflow-v3-requester-cpf')
    const noData = flow.querySelector('#spfm-workflow-v3-requester-no-data')
    const insert = flow.querySelector('#spfm-workflow-v3-identification-insert')

    name.value = clean(native.name?.value)
    cpf.value = clean(native.cpf?.value)

    name.addEventListener('input', () => {
      syncRequesterToNative(name.value, cpf.value)
      updateIdentificationInsertState()
    })
    cpf.addEventListener('input', () => {
      cpf.value = cpf.value.replace(/[^\d.-]/g, '').slice(0, 14)
      syncRequesterToNative(name.value, cpf.value)
      updateIdentificationInsertState()
    })
    noData.addEventListener('change', () => {
      if (noData.checked) syncRequesterToNative('', '')
      updateIdentificationInsertState()
      window.setTimeout(() => cue(insert), 60)
    })
    insert.addEventListener('click', () => {
      updateIdentificationInsertState()
      if (insert.disabled) return
      if (insert.dataset.ready !== 'true') {
        guideMissingIdentificationData(flow)
        return
      }
      if (!noData.checked) syncRequesterToNative(name.value, cpf.value)

      const nativeInsert = document.querySelector('#spfm-insert-script:not([disabled])')
      if (!nativeInsert) {
        const status = flow.querySelector('#spfm-workflow-v3-identification-status')
        if (status) status.textContent = 'A resposta ainda não ficou pronta. Selecione novamente a identificação.'
        return
      }

      nativeInsert.click()
      const status = flow.querySelector('#spfm-workflow-v3-identification-status')
      if (status) status.textContent = '✓ RESPOSTA INSERIDA. Confira o e-mail antes de enviar.'
    })

    return flow
  }

  function chooseIdentificationResponse (label) {
    const title = IDENTIFICATION_RESPONSES[normalize(label)]
    if (!title) return false

    const script = scriptByTitle(title)
    const flow = ensureIdentificationFlow()
    if (!script || !flow || !selectNativeScriptWithoutInsert(script)) return false

    selectedIdentificationTitle = title
    flow.hidden = false

    const response = flow.querySelector('#spfm-workflow-v3-identification-response')
    const name = flow.querySelector('#spfm-workflow-v3-requester-name')
    const cpf = flow.querySelector('#spfm-workflow-v3-requester-cpf')
    const noData = flow.querySelector('#spfm-workflow-v3-requester-no-data')
    const native = nativeRequesterFields()

    if (response) response.textContent = title
    if (name && !clean(name.value)) name.value = clean(native.name?.value)
    if (cpf && !clean(cpf.value)) cpf.value = clean(native.cpf?.value)
    if (noData) noData.checked = false

    clearIdentificationPendingState(flow)
    updateIdentificationInsertState()
    flow.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
    window.setTimeout(() => cue(name || flow), 70)

    const status = document.querySelector('#spfm-workflow-v3-status')
    if (status) status.textContent = 'Resposta selecionada. Confirme os dados do requerente e só então clique em INSERIR RESPOSTA.'
    return true
  }

  function bindIdentificationManualFlow () {
    const root = document.getElementById('spfm-workflow-v3')
    if (!root || root.dataset.spfmWorkflowIdentificationBound === 'true') return
    root.dataset.spfmWorkflowIdentificationBound = 'true'
    ensureIdentificationFlow()

    root.addEventListener('click', (event) => {
      const quick = event.target.closest('#spfm-workflow-v3-identification-actions .spfm-workflow-v3-action, #spfm-workflow-v3-simple')
      if (!quick) return

      const title = IDENTIFICATION_RESPONSES[normalize(quick.textContent)]
      if (!title) return

      event.preventDefault()
      event.stopImmediatePropagation()
      selectIdentificationAction(quick)
      chooseIdentificationResponse(quick.textContent)
    }, true)
  }

  function bindStageButtons () {
    document.querySelectorAll('[data-spfm-workflow-stage]').forEach((button) => {
      if (button.dataset.spfmWorkflowBridgeBound === 'true') return
      button.dataset.spfmWorkflowBridgeBound = 'true'
      button.addEventListener('click', () => {
        clearPreviousServiceState()
        clearSelectedService()
        window.setTimeout(() => {
          moveOperationalControls()
          syncHostVisibility()
        }, 30)
      })
    })
  }

  function bindServiceState () {
    const root = document.getElementById('spfm-workflow-v3')
    if (!root || root.dataset.spfmWorkflowServiceStateBound === 'true') return
    root.dataset.spfmWorkflowServiceStateBound = 'true'

    root.addEventListener('click', (event) => {
      const service = event.target.closest(
        '#spfm-workflow-v3-orientation-actions .spfm-workflow-v3-service-button, #spfm-workflow-v3-orientation-results .spfm-workflow-v3-result'
      )
      if (!service) return

      const label = normalize(service.textContent)
      clearPreviousServiceState()
      if (service.classList.contains('spfm-workflow-v3-service-button')) selectServiceButton(service)
      if (label.includes('devolucao de taxas')) schedulePersonFisicaDefault()
      scheduleNextGuide()
    }, true)
  }

  function reconcile () {
    if (!document.getElementById('spfm-workflow-v3')) return
    actionHost()
    injectTransferShortcut()
    bindCollapseControl()
    bindAutomaticEmailPreparation()
    bindStageButtons()
    bindServiceState()
    bindIdentificationManualFlow()
    moveOperationalControls()
    syncManualPreparationVisibility()
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
      const [processData, scriptData] = await Promise.all([
        fetchJson(PROCESS_CATALOG_PATH),
        fetchJson(SCRIPT_CATALOG_PATH)
      ])
      processCatalog = processData || null
      scriptCatalog = Array.isArray(scriptData?.scripts) ? scriptData.scripts : []
    } catch (error) {
      console.warn('[SEI Protocolistas] Ponte do fluxo V3 iniciou com catálogo incompleto:', error)
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
