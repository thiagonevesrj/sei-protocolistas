(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const api = typeof browser === 'undefined' ? chrome : browser
  const SCRIPT_CATALOG_PATH = 'data/catalogo-scripts.json'
  const PROCESS_CATALOG_PATH = 'data/catalogo-processos.json'
  const ROOT_ID = 'spfm-workflow-v3'
  const CUE_DURATION = 2800

  const QUICK_TRIAGE = [
    { label: 'IDENTIFICAÇÃO COMPLETA', title: 'SCRIPT DE IDENTIFICAÇÃO COMPLETO', primary: true },
    { label: 'IDENTIFICAR SERVIÇO', title: 'SCRIPT DE IDENTIFICAÇÃO DO SERVIÇO', primary: true },
    { label: 'NÃO É CONOSCO', title: 'SCRIPT - ESTE SERVIÇO NÃO É CONOSCO' },
    { label: 'OUVIDORIA', title: 'E COM A OUVIDORIA' }
  ]

  const ORIENTATION_SHORTCUTS = [
    { type: 'baixa', label: 'Baixa de Restrição' },
    { id: 'devolucao-taxas', label: 'Devolução de Taxas' },
    { id: 'pericia-medica-pcd', label: 'Perícia Médica' },
    { id: 'desistencia-categoria', label: 'Desistência de Categoria' },
    { id: 'generico-habilitacao', label: 'Genérico Habilitação' },
    { id: 'generico-veiculos', label: 'Genérico Veículos' },
    { id: 'leilao-veiculos', label: 'Leilão' },
    { id: 'troca-clinica', label: 'Troca de Clínica' },
    { id: 'oficios', label: 'Ofícios' }
  ]

  const SIMPLE_IDENTIFICATION_TITLE = 'SCRIPT DE SIMPLES IDENTIFICAÇÃO'
  const GENERIC_TRIAGE_TITLES = new Set([
    ...QUICK_TRIAGE.map((item) => item.title),
    SIMPLE_IDENTIFICATION_TITLE
  ])

  let scripts = []
  let processCatalog = null
  let activeStage = ''
  let orientationSearchTimer = null
  let requirementSearchTimer = null

  function clean (value) {
    return String(value || '').replace(/\s+/g, ' ').trim()
  }

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

  function scriptByTitle (title) {
    const wanted = normalize(title)
    return scripts.find((script) => normalize(script.title) === wanted && clean(script.body)) || null
  }

  function setStatus (message) {
    const status = document.querySelector('#spfm-workflow-v3-status')
    if (status) status.textContent = message || ''
  }

  function cue (element) {
    if (!element) return
    element.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
    element.classList.remove('spfm-workflow-v3-cue')
    void element.offsetWidth
    element.classList.add('spfm-workflow-v3-cue')
    window.setTimeout(() => element.classList.remove('spfm-workflow-v3-cue'), CUE_DURATION)
  }

  function cueLater (getter) {
    ;[80, 220, 520].forEach((delay) => {
      window.setTimeout(() => {
        const element = getter()
        if (element) cue(element)
      }, delay)
    })
  }

  function nextActionTarget () {
    const selectors = [
      '#spfm-p0-baixa-chooser button:not([disabled])',
      '#spfm-v2-special-actions button:not([disabled])',
      '#spfm-action-step button:not([disabled])',
      '#spfm-priority-actions button:not([disabled])',
      '#spfm-insert-script:not([disabled])',
      '#spfm-open-process:not([disabled])'
    ]
    for (const selector of selectors) {
      const target = Array.from(document.querySelectorAll(selector)).find((item) => {
        const style = item.ownerDocument.defaultView?.getComputedStyle(item)
        if (!style || style.display === 'none' || style.visibility === 'hidden') return false
        const rect = item.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })
      if (target) return target
    }
    return null
  }

  function showNativeStatus (show) {
    const status = document.querySelector('#spfm-priority-status')
    if (status) status.hidden = !show
  }

  function selectNativeScript (script, { insert = false } = {}) {
    if (!script) {
      setStatus('Resposta não localizada no catálogo atual.')
      return false
    }

    const phase = document.querySelector('#spfm-script-phase')
    const search = document.querySelector('#spfm-script-search')
    const result = document.querySelector('#spfm-script-result')
    const toggle = document.querySelector('#spfm-script-toggle')
    const catalog = document.querySelector('#spfm-script-catalog')

    if (!phase || !search || !result) {
      setStatus('Catálogo do FAST MAIL ainda não ficou pronto.')
      return false
    }

    if (catalog?.hidden && toggle) toggle.click()

    if (Array.from(phase.options).some((option) => option.value === script.phase)) {
      phase.value = script.phase
      dispatch(phase, 'change')
    }

    search.value = clean(script.title)
    dispatch(search, 'input')

    const option = Array.from(result.options).find((item) => item.value === script.id)
    if (!option) {
      setStatus(`Não consegui selecionar “${script.title}” automaticamente.`)
      return false
    }

    result.value = script.id
    dispatch(result, 'change')

    if (insert) {
      window.setTimeout(() => {
        const insertButton = document.querySelector('#spfm-insert-script')
        if (insertButton && !insertButton.disabled) insertButton.click()
      }, 80)
      setStatus('Resposta preparada.')
    } else {
      setStatus(`Selecionado: ${script.title}`)
      showNativeStatus(true)
      cueLater(() => document.querySelector('#spfm-insert-script:not([disabled])'))
    }
    return true
  }

  function runQuickTriage (title) {
    const existingButton = Array.from(document.querySelectorAll('#spfm-v2-identification-shortcuts button'))
      .find((button) => normalize(button.title) === normalize(title))

    if (existingButton) {
      existingButton.click()
      setStatus('Resposta preparada.')
      return
    }

    selectNativeScript(scriptByTitle(title), { insert: true })
  }

  function orientationTopics () {
    return Array.isArray(processCatalog?.fastMailPriorityTopics)
      ? processCatalog.fastMailPriorityTopics
      : []
  }

  function topicById (id) {
    return orientationTopics().find((topic) => topic.id === id) || null
  }

  function areaLabel (areaId) {
    const areas = processCatalog?.fastMailNavigation?.areas || []
    return clean(areas.find((area) => area.id === areaId)?.label || areaId)
  }

  function topicSearchText (topic) {
    return normalize(`${topic.label} ${topic.id} ${areaLabel(topic.area)} ${topic.destinationUnit || ''}`)
  }

  function scriptSearchText (script) {
    return normalize(`${script.title} ${script.group} ${script.phaseLabel || script.phase}`)
  }

  function scoreText (text, terms) {
    if (!terms.length) return 0
    let score = 0
    for (const term of terms) {
      const index = text.indexOf(term)
      if (index < 0) return -1
      score += index === 0 ? 12 : Math.max(1, 8 - Math.min(index, 7))
    }
    return score
  }

  function orientationResults (query) {
    const terms = normalize(query).split(' ').filter(Boolean)
    if (!terms.length) return []

    const results = []
    const baixaText = normalize('baixa de restricao inventario herdeiros terceiros veiculos')
    if (terms.every((term) => baixaText.includes(term))) {
      results.push({ type: 'baixa', key: 'baixa-restricao', label: 'Baixa de Restrição', meta: 'VEÍCULOS', score: 1000 })
    }

    orientationTopics().forEach((topic) => {
      const score = scoreText(topicSearchText(topic), terms)
      if (score < 0) return
      results.push({
        type: 'topic',
        key: `topic:${topic.id}`,
        label: clean(topic.label),
        meta: areaLabel(topic.area).toUpperCase(),
        topic,
        score: score + 300
      })
    })

    scripts.forEach((script) => {
      if (script.phase !== 'orientacao' || !clean(script.body) || GENERIC_TRIAGE_TITLES.has(script.title)) return
      const score = scoreText(scriptSearchText(script), terms)
      if (score < 0) return
      results.push({
        type: 'script',
        key: `script:${script.id}`,
        label: clean(script.title),
        meta: clean(script.group || script.phaseLabel || script.phase).toUpperCase(),
        script,
        score
      })
    })

    return dedupeAndLimit(results)
  }

  function requirementResults (query) {
    const terms = normalize(query).split(' ').filter(Boolean)
    if (!terms.length) return []

    const results = scripts
      .filter((script) => script.phase === 'atendimento' && clean(script.body))
      .map((script) => ({
        type: 'script',
        key: `script:${script.id}`,
        label: clean(script.title),
        meta: clean(script.group || 'EXIGÊNCIA').toUpperCase(),
        script,
        score: scoreText(scriptSearchText(script), terms)
      }))
      .filter((item) => item.score >= 0)

    return dedupeAndLimit(results)
  }

  function dedupeAndLimit (results) {
    const seen = new Set()
    return results
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'pt-BR'))
      .filter((item) => {
        const fingerprint = normalize(item.label)
        if (seen.has(fingerprint)) return false
        seen.add(fingerprint)
        return true
      })
      .slice(0, 10)
  }

  function selectOrientationTopic (topic) {
    const area = document.querySelector('#spfm-v2-orientation-area')
    const select = document.querySelector('#spfm-v2-orientation-topic')
    const open = document.querySelector('#spfm-v2-orientation-open')

    if (!area || !select || !open) {
      setStatus('Navegação de atendimento ainda não ficou pronta.')
      return false
    }

    if (topic.area && Array.from(area.options).some((option) => option.value === topic.area)) {
      area.value = topic.area
      dispatch(area, 'change')
    }

    window.setTimeout(() => {
      const exists = Array.from(select.options).some((option) => option.value === topic.id)
      if (!exists) {
        setStatus(`Atendimento “${topic.label}” não apareceu na lista operacional.`)
        return
      }
      select.value = topic.id
      dispatch(select, 'change')
      open.click()
      setSelected(topic.label, areaLabel(topic.area))
      showNativeStatus(true)
      setStatus('Atendimento aberto. Escolha RESPONDER, COBRAR DOCUMENTOS ou ABRIR PROCESSO.')
      cueLater(nextActionTarget)
    }, 30)

    return true
  }

  function openBaixaRestricao () {
    const button = document.querySelector('#spfm-p0-baixa-restricao')
    if (!button) {
      setStatus('Fluxo de Baixa de Restrição ainda não ficou pronto.')
      return
    }
    button.click()
    setSelected('Baixa de Restrição', 'VEÍCULOS')
    setStatus('Escolha o tipo de baixa de restrição.')
    cueLater(() => document.querySelector('#spfm-p0-baixa-chooser button:not([disabled])'))
  }

  function setSelected (label, meta = '') {
    const selected = document.querySelector('#spfm-workflow-v3-selected')
    if (!selected) return
    selected.hidden = false
    selected.innerHTML = `<span>${escapeHtml(meta || 'ATENDIMENTO')}</span><strong>${escapeHtml(label)}</strong>`
  }

  function escapeHtml (value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  function chooseOrientationResult (item) {
    if (item.type === 'baixa') return openBaixaRestricao()
    if (item.type === 'topic') return selectOrientationTopic(item.topic)
    if (item.type === 'script' && selectNativeScript(item.script)) {
      setSelected(item.script.title, item.script.group || item.script.phaseLabel)
      setStatus('Resposta localizada. Confira e insira.')
    }
  }

  function chooseRequirementResult (item) {
    if (item.type !== 'script') return
    if (selectNativeScript(item.script)) {
      setSelected(item.script.title, item.script.group || 'EXIGÊNCIA')
      setStatus('Exigência localizada. Confira o texto e insira a resposta.')
    }
  }

  function renderResultList (inputId, containerId, resolver, chooser) {
    const input = document.querySelector(`#${inputId}`)
    const container = document.querySelector(`#${containerId}`)
    if (!input || !container) return

    const items = resolver(input.value)
    container.innerHTML = ''
    container.hidden = !clean(input.value)

    if (!clean(input.value)) return

    if (!items.length) {
      container.innerHTML = '<div class="spfm-workflow-v3-empty">Nenhum resultado encontrado. Tente outra palavra.</div>'
      return
    }

    items.forEach((item) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'spfm-workflow-v3-result'
      button.innerHTML = `<strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.meta)}</span>`
      button.addEventListener('click', () => {
        chooser(item)
        input.value = item.label
        container.hidden = true
      })
      container.appendChild(button)
    })
  }

  function renderOrientationSearch () {
    renderResultList('spfm-workflow-v3-orientation-search', 'spfm-workflow-v3-orientation-results', orientationResults, chooseOrientationResult)
  }

  function renderRequirementSearch () {
    renderResultList('spfm-workflow-v3-requirement-search', 'spfm-workflow-v3-requirement-results', requirementResults, chooseRequirementResult)
  }

  function setStage (stage) {
    activeStage = stage
    const root = document.getElementById(ROOT_ID)
    if (!root) return

    root.querySelectorAll('[data-spfm-workflow-stage]').forEach((button) => {
      const active = button.dataset.spfmWorkflowStage === stage
      button.classList.toggle('is-active', active)
      button.setAttribute('aria-pressed', String(active))
    })

    root.querySelectorAll('[data-spfm-workflow-section]').forEach((section) => {
      section.hidden = section.dataset.spfmWorkflowSection !== stage
    })

    const selected = root.querySelector('#spfm-workflow-v3-selected')
    if (selected) selected.hidden = true
    showNativeStatus(false)

    if (stage === 'identificacao') {
      setStatus('Escolha a resposta de identificação adequada.')
      cueLater(() => root.querySelector('[data-spfm-workflow-section="identificacao"] .spfm-workflow-v3-action.is-primary'))
    } else if (stage === 'orientacao') {
      setStatus('Escolha um atendimento principal ou pesquise diretamente o serviço.')
      cueLater(() => root.querySelector('[data-spfm-workflow-section="orientacao"] .spfm-workflow-v3-service-button'))
    } else if (stage === 'exigencias') {
      setStatus('Pesquise o assunto da exigência.')
      const input = root.querySelector('#spfm-workflow-v3-requirement-search')
      input?.focus()
      cueLater(() => input)
    }
  }

  function renderQuickTriage (root) {
    const actions = root.querySelector('#spfm-workflow-v3-identification-actions')
    QUICK_TRIAGE.forEach((item) => {
      if (!scriptByTitle(item.title)) return
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = item.label
      button.className = `spfm-workflow-v3-action${item.primary ? ' is-primary' : ''}`
      button.addEventListener('click', () => runQuickTriage(item.title))
      actions.appendChild(button)
    })

    root.querySelector('#spfm-workflow-v3-simple').addEventListener('click', () => runQuickTriage(SIMPLE_IDENTIFICATION_TITLE))
  }

  function renderOrientationShortcuts (root) {
    const container = root.querySelector('#spfm-workflow-v3-orientation-actions')

    ORIENTATION_SHORTCUTS.forEach((shortcut) => {
      if (shortcut.type === 'baixa') {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'spfm-workflow-v3-service-button is-emphasis'
        button.textContent = shortcut.label
        button.addEventListener('click', openBaixaRestricao)
        container.appendChild(button)
        return
      }

      const topic = topicById(shortcut.id)
      if (!topic) return
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'spfm-workflow-v3-service-button'
      button.textContent = shortcut.label
      button.addEventListener('click', () => selectOrientationTopic(topic))
      container.appendChild(button)
    })
  }

  function bindSearch (root, inputId, resultSelector, render, timerSetter) {
    const input = root.querySelector(`#${inputId}`)
    input.addEventListener('input', () => {
      timerSetter()
    })
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return
      const first = root.querySelector(resultSelector)
      if (first) {
        event.preventDefault()
        first.click()
      }
    })
  }

  function build () {
    const navigation = document.querySelector('#spfm-navigation-v2')
    if (!navigation || document.getElementById(ROOT_ID)) return false

    navigation.classList.add('spfm-workflow-v3-ready')

    const root = document.createElement('section')
    root.id = ROOT_ID
    root.className = 'spfm-workflow-v3'
    root.innerHTML = `
      <div class="spfm-workflow-v3-stage-grid" aria-label="Etapa do atendimento">
        <button type="button" data-spfm-workflow-stage="identificacao" aria-pressed="false">IDENTIFICAÇÃO</button>
        <button type="button" data-spfm-workflow-stage="orientacao" aria-pressed="false">ORIENTAÇÃO</button>
        <button type="button" data-spfm-workflow-stage="exigencias" aria-pressed="false">EXIGÊNCIAS</button>
      </div>

      <section class="spfm-workflow-v3-stage-section" data-spfm-workflow-section="identificacao" hidden>
        <div class="spfm-workflow-v3-kicker">TRIAGEM RÁPIDA</div>
        <div id="spfm-workflow-v3-identification-actions" class="spfm-workflow-v3-actions"></div>
        <button id="spfm-workflow-v3-simple" class="spfm-workflow-v3-simple" type="button">Simples identificação</button>
      </section>

      <section class="spfm-workflow-v3-stage-section" data-spfm-workflow-section="orientacao" hidden>
        <div class="spfm-workflow-v3-kicker">ATENDIMENTOS PRINCIPAIS</div>
        <div id="spfm-workflow-v3-orientation-actions" class="spfm-workflow-v3-service-grid"></div>
        <div class="spfm-workflow-v3-search-block">
          <label for="spfm-workflow-v3-orientation-search">OUTRO SERVIÇO</label>
          <input id="spfm-workflow-v3-orientation-search" type="search" autocomplete="off" placeholder="Buscar serviço... Ex.: clonagem, certidão, transferência">
          <div id="spfm-workflow-v3-orientation-results" class="spfm-workflow-v3-results" hidden></div>
        </div>
      </section>

      <section class="spfm-workflow-v3-stage-section" data-spfm-workflow-section="exigencias" hidden>
        <div class="spfm-workflow-v3-kicker">EXIGÊNCIAS</div>
        <div class="spfm-workflow-v3-search-block">
          <label for="spfm-workflow-v3-requirement-search">PESQUISAR ASSUNTO</label>
          <input id="spfm-workflow-v3-requirement-search" type="search" autocomplete="off" placeholder="Ex.: documento, ofício, multa, habilitação">
          <div id="spfm-workflow-v3-requirement-results" class="spfm-workflow-v3-results" hidden></div>
        </div>
      </section>

      <div id="spfm-workflow-v3-selected" class="spfm-workflow-v3-selected" hidden></div>
      <div id="spfm-workflow-v3-status" class="spfm-workflow-v3-status">Escolha IDENTIFICAÇÃO, ORIENTAÇÃO ou EXIGÊNCIAS.</div>
    `

    const firstSection = navigation.querySelector('.spfm-v2-section')
    if (firstSection) navigation.insertBefore(root, firstSection)
    else navigation.appendChild(root)

    root.querySelectorAll('[data-spfm-workflow-stage]').forEach((button) => {
      button.addEventListener('click', () => setStage(button.dataset.spfmWorkflowStage))
    })

    renderQuickTriage(root)
    renderOrientationShortcuts(root)

    bindSearch(root, 'spfm-workflow-v3-orientation-search', '#spfm-workflow-v3-orientation-results .spfm-workflow-v3-result', renderOrientationSearch, () => {
      window.clearTimeout(orientationSearchTimer)
      orientationSearchTimer = window.setTimeout(renderOrientationSearch, 40)
    })

    bindSearch(root, 'spfm-workflow-v3-requirement-search', '#spfm-workflow-v3-requirement-results .spfm-workflow-v3-result', renderRequirementSearch, () => {
      window.clearTimeout(requirementSearchTimer)
      requirementSearchTimer = window.setTimeout(renderRequirementSearch, 40)
    })

    showNativeStatus(false)
    return true
  }

  async function init () {
    try {
      const [scriptData, processData] = await Promise.all([
        fetchJson(SCRIPT_CATALOG_PATH),
        fetchJson(PROCESS_CATALOG_PATH)
      ])
      scripts = Array.isArray(scriptData?.scripts) ? scriptData.scripts : []
      processCatalog = processData || null

      const started = Date.now()
      const timer = window.setInterval(() => {
        if (build() || Date.now() - started > 12000) window.clearInterval(timer)
      }, 120)
    } catch (error) {
      console.error('[SEI Protocolistas] Falha ao iniciar fluxo por etapas do FAST MAIL:', error)
    }
  }

  init()
})()
