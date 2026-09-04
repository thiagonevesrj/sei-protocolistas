(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const api = typeof browser === 'undefined' ? chrome : browser
  const SCRIPT_CATALOG_PATH = 'data/catalogo-scripts.json'
  const PROCESS_CATALOG_PATH = 'data/catalogo-processos.json'
  const ROOT_ID = 'spfm-workflow-v3'

  const QUICK_TRIAGE = [
    { label: 'IDENTIFICAÇÃO COMPLETA', title: 'SCRIPT DE IDENTIFICAÇÃO COMPLETO', primary: true },
    { label: 'IDENTIFICAR SERVIÇO', title: 'SCRIPT DE IDENTIFICAÇÃO DO SERVIÇO', primary: true },
    { label: 'NÃO É CONOSCO', title: 'SCRIPT - ESTE SERVIÇO NÃO É CONOSCO' },
    { label: 'OUVIDORIA', title: 'E COM A OUVIDORIA' }
  ]

  const SIMPLE_IDENTIFICATION_TITLE = 'SCRIPT DE SIMPLES IDENTIFICAÇÃO'
  const GENERIC_TRIAGE_TITLES = new Set([
    ...QUICK_TRIAGE.map((item) => item.title),
    SIMPLE_IDENTIFICATION_TITLE
  ])

  let scripts = []
  let processCatalog = null
  let searchTimer = null

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
    }

    setStatus(insert ? 'Resposta preparada.' : `Selecionado: ${script.title}`)
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

  function serviceResults (query) {
    const terms = normalize(query).split(' ').filter(Boolean)
    if (!terms.length) return []

    const results = []

    if (terms.every((term) => normalize('baixa de restricao inventario herdeiros terceiros veiculos').includes(term))) {
      results.push({
        type: 'baixa',
        key: 'baixa-restricao',
        label: 'Baixa de Restrição',
        meta: 'VEÍCULOS',
        score: 1000
      })
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
      if (!clean(script.body) || GENERIC_TRIAGE_TITLES.has(script.title)) return
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

    const seen = new Set()
    return results
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'pt-BR'))
      .filter((item) => {
        const fingerprint = normalize(item.label)
        if (seen.has(fingerprint)) return false
        seen.add(fingerprint)
        return true
      })
      .slice(0, 8)
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
      setStatus('Atendimento aberto. Escolha a ação necessária.')
    }, 30)

    return true
  }

  function setSelected(label, meta = '') {
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

  function chooseServiceResult (item) {
    if (item.type === 'baixa') {
      const button = document.querySelector('#spfm-p0-baixa-restricao')
      if (button) {
        button.click()
        setSelected('Baixa de Restrição', 'VEÍCULOS')
        setStatus('Escolha o tipo de baixa de restrição.')
      } else {
        setStatus('Fluxo de Baixa de Restrição ainda não ficou pronto.')
      }
      return
    }

    if (item.type === 'topic') {
      selectOrientationTopic(item.topic)
      return
    }

    if (item.type === 'script') {
      if (selectNativeScript(item.script)) {
        setSelected(item.script.title, item.script.group || item.script.phaseLabel)
        setStatus('Resposta localizada. Confira e insira.')
      }
    }
  }

  function renderSearchResults () {
    const input = document.querySelector('#spfm-workflow-v3-search')
    const container = document.querySelector('#spfm-workflow-v3-results')
    if (!input || !container) return

    const items = serviceResults(input.value)
    container.innerHTML = ''
    container.hidden = !clean(input.value)

    if (!clean(input.value)) return

    if (!items.length) {
      container.innerHTML = '<div class="spfm-workflow-v3-empty">Nenhum atendimento encontrado. Tente outra palavra.</div>'
      return
    }

    items.forEach((item) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'spfm-workflow-v3-result'
      button.innerHTML = `<strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.meta)}</span>`
      button.addEventListener('click', () => {
        chooseServiceResult(item)
        input.value = item.label
        container.hidden = true
      })
      container.appendChild(button)
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
      <div class="spfm-workflow-v3-kicker">TRIAGEM RÁPIDA</div>
      <div class="spfm-workflow-v3-actions"></div>
      <button id="spfm-workflow-v3-simple" class="spfm-workflow-v3-simple" type="button">Simples identificação</button>

      <div class="spfm-workflow-v3-search-block">
        <label for="spfm-workflow-v3-search">JÁ SEI QUAL É O SERVIÇO</label>
        <input id="spfm-workflow-v3-search" type="search" autocomplete="off" placeholder="Buscar serviço... Ex.: inventário, ofício, clonagem">
        <div id="spfm-workflow-v3-results" class="spfm-workflow-v3-results" hidden></div>
      </div>

      <div id="spfm-workflow-v3-selected" class="spfm-workflow-v3-selected" hidden></div>
      <div id="spfm-workflow-v3-status" class="spfm-workflow-v3-status">Abra o e-mail, escolha uma resposta rápida ou busque diretamente o serviço.</div>
    `

    const firstSection = navigation.querySelector('.spfm-v2-section')
    if (firstSection) navigation.insertBefore(root, firstSection)
    else navigation.appendChild(root)

    const actions = root.querySelector('.spfm-workflow-v3-actions')
    QUICK_TRIAGE.forEach((item) => {
      if (!scriptByTitle(item.title)) return
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = item.label
      button.className = `spfm-workflow-v3-action${item.primary ? ' is-primary' : ''}`
      button.addEventListener('click', () => runQuickTriage(item.title))
      actions.appendChild(button)
    })

    root.querySelector('#spfm-workflow-v3-simple').addEventListener('click', () => {
      runQuickTriage(SIMPLE_IDENTIFICATION_TITLE)
    })

    const search = root.querySelector('#spfm-workflow-v3-search')
    search.addEventListener('input', () => {
      window.clearTimeout(searchTimer)
      searchTimer = window.setTimeout(renderSearchResults, 40)
    })
    search.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return
      const first = root.querySelector('.spfm-workflow-v3-result')
      if (first) {
        event.preventDefault()
        first.click()
      }
    })

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
      console.error('[SEI Protocolistas] Falha ao iniciar fluxo direto do FAST MAIL:', error)
    }
  }

  init()
})()
