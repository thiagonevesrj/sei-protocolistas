(() => {
  'use strict'

  if (window.top !== window) return

  const api = typeof browser === 'undefined' ? chrome : browser
  const SCRIPT_CATALOG_PATH = 'data/catalogo-scripts.json'
  const PROCESS_CATALOG_PATH = 'data/catalogo-processos.json'
  const CATALOG_OPEN_LABEL = 'BUSCAR OUTRO ATENDIMENTO'
  const READY_TIMEOUT = 10000

  const IDENTIFICATION_SHORTCUTS = [
    { label: 'Identificação completa', title: 'SCRIPT DE IDENTIFICAÇÃO COMPLETO' },
    { label: 'Identificar o serviço', title: 'SCRIPT DE IDENTIFICAÇÃO DO SERVIÇO' },
    { label: 'Simples identificação', title: 'SCRIPT DE SIMPLES IDENTIFICAÇÃO' },
    { label: 'Devolução de taxas', title: 'TRIAGEM - Devolução de Taxas' },
    { label: 'Perícia médica', title: 'TRIAGEM - Perícia Médica' },
    { label: 'Inventário', title: 'SCRIPT DE IDENTIFICAÇÃO - INVENTÁRIO' }
  ]

  const ORIENTATION_SHORTCUTS = [
    { id: 'devolucao-taxas', label: 'Devolução de taxas' },
    { id: 'pericia-medica-pcd', label: 'Perícia médica' },
    { id: 'desistencia-categoria', label: 'Desistência de categoria' },
    { id: 'generico-habilitacao', label: 'Genérico de habilitação' },
    { id: 'generico-veiculos', label: 'Genérico de veículos' },
    { id: 'leilao-veiculos', label: 'Leilão de veículos' },
    { id: 'troca-clinica', label: 'Troca de clínica' },
    { id: 'certidao-identificacao-civil', label: 'Certidão de identificação civil', synthetic: true },
    { id: 'oficios', label: 'Ofícios' }
  ]

  const SYNTHETIC_CERTIDAO = {
    id: 'certidao-identificacao-civil',
    label: 'Certidão de Identificação Civil',
    area: 'outros',
    processId: 'certidao-identificacao-civil',
    canOpenProcess: false,
    blockedReason: 'Checklist documental ainda não validado. Neste momento, use somente a resposta/orientação.',
    synthetic: true
  }

  const state = {
    scripts: [],
    processCatalog: null,
    orientationTopics: [],
    mode: '',
    selectedOrientationTopic: null
  }

  function cleanText (value) {
    return String(value || '').replace(/\s+/g, ' ').trim()
  }

  function normalizeText (value) {
    return cleanText(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  }

  function sleep (ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms))
  }

  async function fetchJson (path) {
    const response = await fetch(api.runtime.getURL(path))
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  }

  function root () {
    return document.querySelector('#spfm-navigation-v2')
  }

  function setStatus (message) {
    const status = document.querySelector('#spfm-v2-status')
    if (status) status.textContent = message
  }

  function setNativeStatus (message) {
    const status = document.querySelector('#spfm-priority-status')
    if (status) status.textContent = message
  }

  function nativePhaseButton (phaseId) {
    return document.querySelector(`.spfm-phase-button[data-phase-id="${phaseId}"]`)
  }

  function nativeAreaButton (areaId) {
    return document.querySelector(`.spfm-area-button[data-area-id="${areaId}"]`)
  }

  function activateNativePhase (phaseId) {
    const button = nativePhaseButton(phaseId)
    if (!button) return false
    button.click()
    return true
  }

  function hideNativeCatalog () {
    const catalog = document.querySelector('#spfm-script-catalog')
    const toggle = document.querySelector('#spfm-script-toggle')
    if (catalog) catalog.hidden = true
    if (toggle) toggle.textContent = CATALOG_OPEN_LABEL
  }

  function setMode (mode) {
    state.mode = mode
    const navigation = root()
    if (!navigation) return

    navigation.dataset.mode = mode
    navigation.querySelectorAll('[data-spfm-v2-mode]').forEach((button) => {
      const active = button.dataset.spfmV2Mode === mode
      button.classList.toggle('is-active', active)
      button.setAttribute('aria-pressed', String(active))
    })

    const identification = document.querySelector('#spfm-v2-identification')
    const orientation = document.querySelector('#spfm-v2-orientation')
    const more = document.querySelector('#spfm-v2-more')
    if (identification) identification.hidden = mode !== 'identificacao'
    if (orientation) orientation.hidden = mode !== 'orientacao'
    if (more) more.hidden = mode !== 'outros'
  }

  function selectMainMode (phaseId) {
    if (!activateNativePhase(phaseId)) {
      setStatus('Não foi possível localizar a fase no FAST MAIL.')
      return
    }

    state.selectedOrientationTopic = null
    hideNativeCatalog()
    hideSpecialActions()
    setMode(phaseId)

    if (phaseId === 'identificacao') {
      setStatus('Escolha um atalho principal ou procure pelos demais scripts por setor.')
      setNativeStatus('Fase 1 — escolha um script de identificação.')
    } else {
      setStatus('Escolha o atendimento. Depois, selecione Responder, Exigência ou Abrir processo quando disponível.')
      setNativeStatus('Fase 2 — escolha o assunto do atendimento.')
    }
  }

  function openManualPhase (phaseId) {
    if (!activateNativePhase(phaseId)) {
      setStatus('Não foi possível abrir esta fase.')
      return
    }
    setMode('outros')
    hideSpecialActions()
    setStatus(phaseId === 'protocolos'
      ? 'Protocolos manuais ficam como fallback. O retorno automático continua sendo o caminho preferencial.'
      : 'Exigências e finalização abertas como catálogo de exceção.')
  }

  function actionableScripts (phaseId) {
    return state.scripts.filter((script) => script.phase === phaseId && cleanText(script.body))
  }

  function findIdentificationShortcut (title) {
    const normalizedTitle = normalizeText(title)
    return actionableScripts('identificacao').find((script) => normalizeText(script.title) === normalizedTitle) || null
  }

  function findCertidaoScript () {
    return actionableScripts('orientacao').find((script) => {
      const text = normalizeText(`${script.title} ${script.group}`)
      return text.includes('certidao') && text.includes('identificacao') && text.includes('civil')
    }) || null
  }

  function searchCandidatesForScript (script) {
    const normalized = normalizeText(script?.title)
    const terms = normalized.split(' ').filter((term) => term.length > 2)
    return [
      cleanText(script?.title),
      terms.slice(0, 4).join(' '),
      terms.slice(-3).join(' '),
      terms[0] || ''
    ].filter(Boolean)
  }

  function openCatalogForPhase (phaseId) {
    if (!activateNativePhase(phaseId)) return false

    const catalog = document.querySelector('#spfm-script-catalog')
    const toggle = document.querySelector('#spfm-script-toggle')
    if (!catalog) return false

    if (catalog.hidden && toggle) toggle.click()
    return !catalog.hidden
  }

  function selectScriptInNativeCatalog (script, options = {}) {
    if (!script) {
      setStatus('Script não localizado no catálogo operacional atual.')
      return false
    }

    if (!openCatalogForPhase(script.phase)) {
      setStatus('Não foi possível abrir o catálogo de respostas.')
      return false
    }

    const search = document.querySelector('#spfm-script-search')
    const result = document.querySelector('#spfm-script-result')
    if (!search || !result) return false

    let matched = false
    for (const query of searchCandidatesForScript(script)) {
      search.value = query
      search.dispatchEvent(new Event('input', { bubbles: true }))
      const exists = Array.from(result.options).some((option) => option.value === script.id)
      if (exists) {
        result.value = script.id
        result.dispatchEvent(new Event('change', { bubbles: true }))
        matched = true
        break
      }
    }

    if (!matched) {
      setStatus(`O script “${script.title}” existe no catálogo, mas não foi possível selecioná-lo automaticamente.`)
      return false
    }

    if (options.destination) {
      const destination = document.querySelector('#spfm-destination')
      if (destination) destination.value = options.destination
    }

    if (options.showEmailTools) {
      const identityFields = document.querySelector('#spfm-identity-fields')
      const emailPreparation = document.querySelector('#spfm-email-preparation')
      if (identityFields) identityFields.hidden = false
      if (emailPreparation) emailPreparation.hidden = false
    }

    setStatus(`Script selecionado: ${script.title}. Confira o texto antes de inserir.`)
    document.querySelector('#spfm-script-catalog')?.scrollIntoView?.({ block: 'nearest' })
    return true
  }

  function renderIdentificationShortcuts () {
    const container = document.querySelector('#spfm-v2-identification-shortcuts')
    if (!container) return
    container.innerHTML = ''

    IDENTIFICATION_SHORTCUTS.forEach((shortcut) => {
      const script = findIdentificationShortcut(shortcut.title)
      if (!script) return

      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'spfm-v2-quick-button'
      button.textContent = shortcut.label
      button.title = script.title
      button.addEventListener('click', () => selectScriptInNativeCatalog(script))
      container.appendChild(button)
    })
  }

  function groupPriority (group) {
    const normalized = normalizeText(group)
    const order = ['daf', 'divmed', 'drv', 'infracoes', 'aplicativos', 'script']
    const index = order.findIndex((term) => normalized.includes(term))
    return index >= 0 ? index : order.length
  }

  function identificationGroups () {
    return Array.from(new Set(actionableScripts('identificacao').map((script) => cleanText(script.group) || 'Sem grupo')))
      .sort((a, b) => groupPriority(a) - groupPriority(b) || a.localeCompare(b, 'pt-BR'))
  }

  function renderIdentificationGroups () {
    const group = document.querySelector('#spfm-v2-identification-group')
    if (!group) return

    group.innerHTML = '<option value="">Todos os setores/listas</option>'
    identificationGroups().forEach((label) => {
      const option = document.createElement('option')
      option.value = label
      option.textContent = label
      group.appendChild(option)
    })
    renderIdentificationResults()
  }

  function renderIdentificationResults () {
    const group = document.querySelector('#spfm-v2-identification-group')
    const search = document.querySelector('#spfm-v2-identification-search')
    const result = document.querySelector('#spfm-v2-identification-result')
    const count = document.querySelector('#spfm-v2-identification-count')
    const open = document.querySelector('#spfm-v2-identification-open')
    if (!group || !search || !result || !open) return

    const selectedGroup = group.value
    const terms = normalizeText(search.value).split(' ').filter(Boolean)
    const scripts = actionableScripts('identificacao').filter((script) => {
      if (selectedGroup && cleanText(script.group) !== selectedGroup) return false
      const haystack = normalizeText(`${script.title} ${script.group} ${script.body}`)
      return terms.every((term) => haystack.includes(term))
    })

    const current = result.value
    result.innerHTML = '<option value="">Selecione o script</option>'
    scripts.forEach((script) => {
      const option = document.createElement('option')
      option.value = script.id
      option.textContent = `${script.group} — ${script.title}`
      result.appendChild(option)
    })
    if (scripts.some((script) => script.id === current)) result.value = current

    open.disabled = !result.value
    if (count) count.textContent = `${scripts.length} script${scripts.length === 1 ? '' : 's'}`
  }

  function selectedIdentificationScript () {
    const scriptId = document.querySelector('#spfm-v2-identification-result')?.value || ''
    return state.scripts.find((script) => script.id === scriptId) || null
  }

  function openSelectedIdentificationScript () {
    selectScriptInNativeCatalog(selectedIdentificationScript())
  }

  function openUnknownIdentification () {
    const script = findIdentificationShortcut('SCRIPT DE IDENTIFICAÇÃO COMPLETO')
    if (!script) {
      openFullCatalog('identificacao')
      return
    }
    selectScriptInNativeCatalog(script)
    setStatus('Assunto ainda não identificado: use o script de Identificação Completo e refine o caso na resposta do cidadão.')
  }

  function orientationTopicById (topicId) {
    if (topicId === SYNTHETIC_CERTIDAO.id) return SYNTHETIC_CERTIDAO
    return state.orientationTopics.find((topic) => topic.id === topicId) || null
  }

  function areaLabel (areaId) {
    const areas = state.processCatalog?.fastMailNavigation?.areas || []
    return areas.find((area) => area.id === areaId)?.label || areaId
  }

  function orientationAreaOrder (areaId) {
    const order = ['habilitacao', 'pericia-medica', 'veiculos', 'taxas', 'oficios', 'outros']
    const index = order.indexOf(areaId)
    return index >= 0 ? index : order.length
  }

  function allOrientationTopics () {
    const topics = state.orientationTopics.slice()
    if (!topics.some((topic) => topic.id === SYNTHETIC_CERTIDAO.id)) topics.push(SYNTHETIC_CERTIDAO)
    return topics
  }

  function renderOrientationShortcuts () {
    const container = document.querySelector('#spfm-v2-orientation-shortcuts')
    if (!container) return
    container.innerHTML = ''

    ORIENTATION_SHORTCUTS.forEach((shortcut) => {
      const topic = orientationTopicById(shortcut.id)
      if (!topic) return

      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'spfm-v2-quick-button'
      button.textContent = shortcut.label
      if (topic.id === 'pericia-medica-pcd') button.classList.add('is-emphasis')
      button.addEventListener('click', () => selectOrientationTopic(topic))
      container.appendChild(button)
    })
  }

  function renderOrientationAreas () {
    const area = document.querySelector('#spfm-v2-orientation-area')
    if (!area) return

    const areaIds = Array.from(new Set(allOrientationTopics().map((topic) => topic.area).filter(Boolean)))
      .sort((a, b) => orientationAreaOrder(a) - orientationAreaOrder(b) || areaLabel(a).localeCompare(areaLabel(b), 'pt-BR'))

    area.innerHTML = '<option value="">Escolha o setor/área</option>'
    areaIds.forEach((areaId) => {
      const option = document.createElement('option')
      option.value = areaId
      option.textContent = areaLabel(areaId)
      area.appendChild(option)
    })
    renderOrientationTopicsByArea()
  }

  function renderOrientationTopicsByArea () {
    const area = document.querySelector('#spfm-v2-orientation-area')
    const topic = document.querySelector('#spfm-v2-orientation-topic')
    const open = document.querySelector('#spfm-v2-orientation-open')
    if (!area || !topic || !open) return

    const areaId = area.value
    const topics = allOrientationTopics()
      .filter((item) => areaId && item.area === areaId)
      .sort((a, b) => Number(a.corePriorityRank || Number.MAX_SAFE_INTEGER) - Number(b.corePriorityRank || Number.MAX_SAFE_INTEGER) || cleanText(a.label).localeCompare(cleanText(b.label), 'pt-BR'))

    topic.innerHTML = '<option value="">Escolha o atendimento</option>'
    topics.forEach((item) => {
      const option = document.createElement('option')
      option.value = item.id
      option.textContent = item.label
      topic.appendChild(option)
    })
    open.disabled = true
  }

  function renderOrientationVariant (topic) {
    const field = document.querySelector('#spfm-v2-variant-field')
    const select = document.querySelector('#spfm-v2-variant')
    const actionStep = document.querySelector('#spfm-action-step')
    if (!field || !select) return

    const variants = Array.isArray(topic?.variants) ? topic.variants : []
    field.hidden = variants.length === 0
    select.innerHTML = '<option value="">Escolha o caso</option>'

    variants.forEach((variant) => {
      const option = document.createElement('option')
      option.value = variant.id
      option.textContent = variant.label
      select.appendChild(option)
    })

    if (variants.length && actionStep) {
      actionStep.hidden = true
      setNativeStatus('Escolha o caso antes de selecionar a ação.')
    }
  }

  function syncNativeVariant (variantId) {
    const nativeVariant = document.querySelector('#spfm-topic-variant')
    if (!nativeVariant || !variantId) return
    nativeVariant.value = variantId
    nativeVariant.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function hideSpecialActions () {
    const special = document.querySelector('#spfm-v2-special-actions')
    if (special) special.hidden = true
  }

  function showSyntheticCertidao (topic) {
    const actionStep = document.querySelector('#spfm-action-step')
    if (actionStep) actionStep.hidden = true

    const selected = document.querySelector('#spfm-v2-selected-topic')
    const special = document.querySelector('#spfm-v2-special-actions')
    const reason = document.querySelector('#spfm-v2-special-reason')
    if (selected) selected.textContent = topic.label
    if (special) special.hidden = false
    if (reason) reason.textContent = topic.blockedReason

    setNativeStatus('Certidão de Identificação Civil: resposta disponível; abertura de processo bloqueada até validar o checklist.')
    setStatus('Certidão de Identificação Civil selecionada. Responder está liberado; Exigência e Abrir processo permanecem bloqueados por segurança.')
  }

  function selectOrientationTopic (topic) {
    if (!topic) return
    state.selectedOrientationTopic = topic
    setMode('orientacao')
    hideSpecialActions()

    if (topic.synthetic) {
      activateNativePhase('orientacao')
      hideNativeCatalog()
      renderOrientationVariant(null)
      showSyntheticCertidao(topic)
      return
    }

    if (!activateNativePhase('orientacao')) return
    const areaButton = nativeAreaButton(topic.area)
    if (!areaButton) {
      openFullCatalog('orientacao', topic.searchQuery || topic.label)
      setStatus('Este atendimento não possui rota rápida por área; o catálogo completo foi aberto já filtrado.')
      return
    }

    areaButton.click()
    const nativeTopic = document.querySelector('#spfm-priority-topic')
    const available = nativeTopic && Array.from(nativeTopic.options).some((option) => option.value === topic.id)
    if (!available) {
      openFullCatalog('orientacao', topic.searchQuery || topic.label)
      setStatus('O atendimento não apareceu na rota rápida atual; o catálogo completo foi aberto já filtrado.')
      return
    }

    nativeTopic.value = topic.id
    nativeTopic.dispatchEvent(new Event('change', { bubbles: true }))

    const selected = document.querySelector('#spfm-v2-selected-topic')
    if (selected) selected.textContent = topic.label
    renderOrientationVariant(topic)
    setStatus(`Atendimento selecionado: ${topic.label}. Escolha a ação abaixo.`)
  }

  function openSelectedOrientationTopic () {
    const topicId = document.querySelector('#spfm-v2-orientation-topic')?.value || ''
    selectOrientationTopic(orientationTopicById(topicId))
  }

  function openSyntheticCertidaoResponse () {
    const script = findCertidaoScript()
    if (!script) {
      openFullCatalog('orientacao', 'certidao identificacao civil')
      setStatus('Não localizei automaticamente o script da Certidão. O catálogo foi aberto com a busca pronta para conferência.')
      return
    }
    selectScriptInNativeCatalog(script, { destination: 'DIRIC', showEmailTools: true })
  }

  function openFullCatalog (phaseId, query = '') {
    if (!openCatalogForPhase(phaseId)) {
      setStatus('Não foi possível abrir o catálogo completo.')
      return
    }

    const search = document.querySelector('#spfm-script-search')
    if (search) {
      search.value = query
      search.dispatchEvent(new Event('input', { bubbles: true }))
      search.focus()
    }
    setStatus(query ? `Catálogo completo aberto com a busca “${query}”.` : 'Catálogo completo aberto. Pesquise pelo assunto ou palavra-chave.')
  }

  function markNativeNavigationAsLegacyUi () {
    const workflow = document.querySelector('.spfm-priority-workflow')
    if (!workflow) return

    const phaseGrid = document.querySelector('#spfm-priority-phases')
    const areaStep = document.querySelector('#spfm-area-step')
    const topicStep = document.querySelector('#spfm-topic-step')
    const firstLabel = Array.from(workflow.children).find((element) => element.classList?.contains('spfm-step-label'))

    ;[phaseGrid, areaStep, topicStep, firstLabel].filter(Boolean).forEach((element) => {
      element.classList.add('spfm-v2-native-navigation')
    })
  }

  function buildNavigation () {
    if (root()) return
    const workflow = document.querySelector('.spfm-priority-workflow')
    if (!workflow) return

    markNativeNavigationAsLegacyUi()

    const navigation = document.createElement('section')
    navigation.id = 'spfm-navigation-v2'
    navigation.className = 'spfm-v2'
    navigation.innerHTML = `
      <div class="spfm-v2-mode-grid" aria-label="Fase principal do atendimento">
        <button type="button" data-spfm-v2-mode="identificacao" aria-pressed="false">
          <strong>FASE 1</strong>
          <span>Identificação</span>
        </button>
        <button type="button" data-spfm-v2-mode="orientacao" aria-pressed="false">
          <strong>FASE 2</strong>
          <span>Orientação</span>
        </button>
        <button id="spfm-v2-more-toggle" class="spfm-v2-more-toggle" type="button" aria-expanded="false">
          <strong>OUTROS</strong>
          <span>Protocolos / extras</span>
        </button>
      </div>

      <section id="spfm-v2-identification" class="spfm-v2-section" hidden>
        <div class="spfm-v2-heading">ATALHOS PRINCIPAIS</div>
        <div id="spfm-v2-identification-shortcuts" class="spfm-v2-quick-grid"></div>
        <button id="spfm-v2-identification-unknown" class="spfm-v2-link-button" type="button">AINDA NÃO SEI O ASSUNTO</button>
        <details class="spfm-v2-browser">
          <summary>Demais scripts por setor/lista</summary>
          <label>
            <span>Setor/lista do Trellinho</span>
            <select id="spfm-v2-identification-group"></select>
          </label>
          <label>
            <span>Pesquisar nesta fase</span>
            <input id="spfm-v2-identification-search" type="search" autocomplete="off" placeholder="Ex.: multas, aplicativo, veículo">
          </label>
          <div id="spfm-v2-identification-count" class="spfm-v2-count"></div>
          <label>
            <span>Script</span>
            <select id="spfm-v2-identification-result"></select>
          </label>
          <button id="spfm-v2-identification-open" type="button" disabled>CONFERIR SCRIPT</button>
        </details>
      </section>

      <section id="spfm-v2-orientation" class="spfm-v2-section" hidden>
        <div class="spfm-v2-heading">ATENDIMENTOS PRINCIPAIS</div>
        <div id="spfm-v2-orientation-shortcuts" class="spfm-v2-quick-grid"></div>
        <div id="spfm-v2-selected" class="spfm-v2-selected">
          <span>Assunto selecionado</span>
          <strong id="spfm-v2-selected-topic">Nenhum</strong>
        </div>
        <label id="spfm-v2-variant-field" class="spfm-v2-variant" hidden>
          <span>Qual é o caso?</span>
          <select id="spfm-v2-variant"></select>
        </label>
        <div id="spfm-v2-special-actions" class="spfm-v2-special-actions" hidden>
          <div class="spfm-decision-grid">
            <button id="spfm-v2-certidao-reply" class="is-primary" type="button">RESPONDER</button>
            <button type="button" disabled>COBRAR DOCUMENTOS</button>
            <button type="button" disabled>ABRIR PROCESSO</button>
          </div>
          <div id="spfm-v2-special-reason" class="spfm-v2-note"></div>
        </div>
        <details class="spfm-v2-browser">
          <summary>Outros atendimentos por setor</summary>
          <label>
            <span>Área</span>
            <select id="spfm-v2-orientation-area"></select>
          </label>
          <label>
            <span>Atendimento</span>
            <select id="spfm-v2-orientation-topic"></select>
          </label>
          <button id="spfm-v2-orientation-open" type="button" disabled>SELECIONAR ATENDIMENTO</button>
        </details>
        <button id="spfm-v2-orientation-unknown" class="spfm-v2-link-button" type="button">AINDA NÃO SEI O ASSUNTO</button>
      </section>

      <section id="spfm-v2-more" class="spfm-v2-section spfm-v2-more" hidden>
        <div class="spfm-v2-heading">USO EXCEPCIONAL</div>
        <p>Fase 3 deve ser automática sempre que os dados do processo já forem conhecidos.</p>
        <div class="spfm-v2-more-actions">
          <button id="spfm-v2-protocols" type="button">PROTOCOLOS — MANUAL</button>
          <button id="spfm-v2-extras" type="button">EXIGÊNCIAS / FINALIZAÇÃO</button>
        </div>
      </section>

      <div id="spfm-v2-status" class="spfm-v2-status">Escolha Fase 1 ou Fase 2.</div>
    `

    workflow.insertBefore(navigation, workflow.firstChild)

    navigation.querySelector('[data-spfm-v2-mode="identificacao"]').addEventListener('click', () => selectMainMode('identificacao'))
    navigation.querySelector('[data-spfm-v2-mode="orientacao"]').addEventListener('click', () => selectMainMode('orientacao'))
    navigation.querySelector('#spfm-v2-more-toggle').addEventListener('click', (event) => {
      const opening = state.mode !== 'outros'
      setMode(opening ? 'outros' : '')
      event.currentTarget.setAttribute('aria-expanded', String(opening))
      if (opening) setStatus('Protocolos e extras ficam disponíveis somente para exceções.')
      else setStatus('Escolha Fase 1 ou Fase 2.')
    })

    navigation.querySelector('#spfm-v2-identification-unknown').addEventListener('click', openUnknownIdentification)
    navigation.querySelector('#spfm-v2-identification-group').addEventListener('change', renderIdentificationResults)
    navigation.querySelector('#spfm-v2-identification-search').addEventListener('input', renderIdentificationResults)
    navigation.querySelector('#spfm-v2-identification-result').addEventListener('change', (event) => {
      const open = document.querySelector('#spfm-v2-identification-open')
      if (open) open.disabled = !event.target.value
    })
    navigation.querySelector('#spfm-v2-identification-open').addEventListener('click', openSelectedIdentificationScript)

    navigation.querySelector('#spfm-v2-orientation-area').addEventListener('change', renderOrientationTopicsByArea)
    navigation.querySelector('#spfm-v2-orientation-topic').addEventListener('change', (event) => {
      const open = document.querySelector('#spfm-v2-orientation-open')
      if (open) open.disabled = !event.target.value
    })
    navigation.querySelector('#spfm-v2-orientation-open').addEventListener('click', openSelectedOrientationTopic)
    navigation.querySelector('#spfm-v2-variant').addEventListener('change', (event) => syncNativeVariant(event.target.value))
    navigation.querySelector('#spfm-v2-certidao-reply').addEventListener('click', openSyntheticCertidaoResponse)
    navigation.querySelector('#spfm-v2-orientation-unknown').addEventListener('click', () => openFullCatalog('orientacao'))
    navigation.querySelector('#spfm-v2-protocols').addEventListener('click', () => openManualPhase('protocolos'))
    navigation.querySelector('#spfm-v2-extras').addEventListener('click', () => openManualPhase('atendimento'))

    renderIdentificationShortcuts()
    renderIdentificationGroups()
    renderOrientationShortcuts()
    renderOrientationAreas()
  }

  async function waitForFastMail () {
    const startedAt = Date.now()
    while (Date.now() - startedAt < READY_TIMEOUT) {
      const panel = document.querySelector('#sei-protocolistas-fast-mail-status')
      const phaseButtons = document.querySelectorAll('.spfm-phase-button')
      if (panel && phaseButtons.length >= 4) return true
      await sleep(120)
    }
    return false
  }

  async function init () {
    try {
      const ready = await waitForFastMail()
      if (!ready) return

      const [scriptCatalog, processCatalog] = await Promise.all([
        fetchJson(SCRIPT_CATALOG_PATH),
        fetchJson(PROCESS_CATALOG_PATH)
      ])

      state.scripts = Array.isArray(scriptCatalog.scripts) ? scriptCatalog.scripts : []
      state.processCatalog = processCatalog
      state.orientationTopics = Array.isArray(processCatalog.fastMailPriorityTopics)
        ? processCatalog.fastMailPriorityTopics
        : []

      buildNavigation()
    } catch (error) {
      console.error('[SEI Protocolistas] Falha ao iniciar navegação V2 do FAST MAIL:', error)
    }
  }

  init()
})()
