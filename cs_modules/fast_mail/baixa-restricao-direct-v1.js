(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const api = typeof browser === 'undefined' ? chrome : browser
  const SCRIPT_CATALOG_PATH = 'data/catalogo-scripts.json'
  const TRELLO_STATE_PATH = 'data/trello-fase02-estado-atual.json'
  const PANEL_ID = 'spfm-baixa-direct-panel'
  const MAIN_BUTTON_ID = 'spfm-p0-baixa-restricao'

  const TITLES = {
    general: 'Baixa de restrição',
    heirs: 'Baixa de restrição referente a inventário (PARA HERDEIROS)',
    third: 'Transferência de propriedade com baixa de restrição de inventário (PARA TERCEIROS)'
  }

  let scripts = []
  let trelloState = null

  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim()
  const normalize = (value) => clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

  function dispatch (element, type) {
    element?.dispatchEvent(new Event(type, { bubbles: true }))
  }

  async function fetchJson (path) {
    const response = await fetch(api.runtime.getURL(path))
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  }

  function sleep (ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms))
  }

  function scriptByTitle (title) {
    const wanted = normalize(title)
    return scripts.find((script) => normalize(script.title) === wanted && clean(script.body)) || null
  }

  function trelloRecord (script) {
    return (trelloState?.records || []).find((record) => record.scriptId === script?.id) || null
  }

  function isPresential (script) {
    return Boolean(trelloRecord(script)?.labels?.includes('PRESENCIAL SOMENTE'))
  }

  function setStatus (message) {
    const workflowStatus = document.querySelector('#spfm-workflow-v3-status')
    const v2Status = document.querySelector('#spfm-v2-status')
    const nativeStatus = document.querySelector('#spfm-priority-status')
    if (workflowStatus) workflowStatus.textContent = message
    if (v2Status) v2Status.textContent = message
    if (nativeStatus) nativeStatus.textContent = message
  }

  function cue (element) {
    if (!element) return
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    element.classList.remove('spfm-v2-action-cue')
    void element.offsetWidth
    element.classList.add('spfm-v2-action-cue')
    window.setTimeout(() => element.classList.remove('spfm-v2-action-cue'), 2900)
  }

  function selectNativeScript (script) {
    if (!script) return false

    const phase = document.querySelector('#spfm-script-phase')
    const search = document.querySelector('#spfm-script-search')
    const result = document.querySelector('#spfm-script-result')
    const toggle = document.querySelector('#spfm-script-toggle')
    const catalog = document.querySelector('#spfm-script-catalog')

    if (!phase || !search || !result) return false

    if (catalog?.hidden && toggle) toggle.click()

    if (Array.from(phase.options).some((option) => option.value === script.phase)) {
      phase.value = script.phase
      dispatch(phase, 'change')
    }

    search.value = script.title
    dispatch(search, 'input')

    const option = Array.from(result.options).find((item) => item.value === script.id)
    if (!option) return false

    result.value = script.id
    dispatch(result, 'change')
    return true
  }

  function findFormatSelect () {
    return Array.from(document.querySelectorAll('select')).find((select) => {
      const options = Array.from(select.options || []).map((option) => normalize(option.textContent))
      return options.includes('html') && options.some((label) => label.includes('texto simp') || label.includes('plain text'))
    }) || null
  }

  function hasHtmlEditor () {
    const editable = Array.from(document.querySelectorAll('[contenteditable="true"]')).find((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 250 && rect.height > 80
    })
    if (editable) return true

    return Array.from(document.querySelectorAll('iframe')).some((frame) => {
      try {
        const doc = frame.contentDocument
        return Boolean(doc?.body && (doc.designMode?.toLowerCase() === 'on' || doc.body.isContentEditable))
      } catch (_) {
        return false
      }
    })
  }

  async function ensureHtmlComposer () {
    const format = findFormatSelect()
    if (!format) return true

    const selectedLabel = normalize(format.options[format.selectedIndex]?.textContent)
    if (selectedLabel === 'html') return true

    const htmlOption = Array.from(format.options).find((option) => normalize(option.textContent) === 'html')
    if (!htmlOption) return false

    setStatus('Preparando o editor da resposta…')
    format.value = htmlOption.value
    dispatch(format, 'input')
    dispatch(format, 'change')

    const started = Date.now()
    while (Date.now() - started < 3000) {
      if (hasHtmlEditor()) return true
      await sleep(120)
    }

    return false
  }

  function removeLegacyBaixaState () {
    document.querySelector('#spfm-p0-baixa-chooser')?.remove()
    const selected = document.querySelector('#spfm-workflow-v3-selected')
    if (selected && /baixa de restri/i.test(selected.textContent || '')) selected.hidden = true
  }

  function panelHost () {
    const root = document.querySelector('#spfm-workflow-v3')
    if (!root) return null
    return root.querySelector('#spfm-workflow-v3-selected') || root.querySelector('#spfm-workflow-v3-status') || root.lastElementChild
  }

  function showInsertState (script, label) {
    const panel = document.getElementById(PANEL_ID)
    if (!panel) return

    const presencial = isPresential(script)
    panel.innerHTML = `
      <div style="display:grid;gap:8px;padding:10px;border:1px solid ${presencial ? '#f2c94c' : '#38516b'};border-radius:10px;background:#07182c;">
        <strong style="color:#f2c94c;font-size:11px;">${presencial ? 'SOMENTE PRESENCIAL' : 'RESPOSTA LOCALIZADA'}</strong>
        <span style="color:#fff;font-size:11px;line-height:1.35;">${label}</span>
        <button id="spfm-baixa-direct-insert" type="button" style="min-height:42px;border:0;border-radius:9px;background:#f4c84d;color:#07182c;font-weight:800;cursor:pointer;">INSERIR RESPOSTA</button>
      </div>
    `

    const insert = panel.querySelector('#spfm-baixa-direct-insert')
    insert?.addEventListener('click', async () => {
      const nativeInsert = document.querySelector('#spfm-insert-script')
      if (!nativeInsert || nativeInsert.disabled) {
        setStatus('A resposta foi selecionada, mas o botão de inserção ainda não está disponível.')
        return
      }

      insert.disabled = true
      try {
        const editorReady = await ensureHtmlComposer()
        if (!editorReady) {
          setStatus('Não consegui preparar com segurança o corpo do e-mail. A resposta NÃO foi inserida.')
          return
        }

        await sleep(100)
        nativeInsert.click()
        setStatus(presencial
          ? 'Resposta presencial inserida. Confira o texto e envie ao requerente.'
          : 'Resposta inserida. Confira o texto antes do envio.')
      } finally {
        insert.disabled = false
      }
    })
    cue(insert)
    setStatus(presencial
      ? `${label} — atendimento SOMENTE PRESENCIAL. Clique em INSERIR RESPOSTA.`
      : `${label} selecionada. Clique em INSERIR RESPOSTA.`)
  }

  function choose (title, label) {
    const script = scriptByTitle(title)
    if (!script) {
      setStatus(`Não encontrei no catálogo o script “${title}”.`)
      return
    }

    if (!selectNativeScript(script)) {
      setStatus(`Encontrei “${title}”, mas não consegui selecioná-lo automaticamente.`)
      return
    }

    showInsertState(script, label)
  }

  function renderChooser () {
    removeLegacyBaixaState()
    document.getElementById(PANEL_ID)?.remove()

    const host = panelHost()
    if (!host) {
      setStatus('O painel do FAST MAIL ainda não ficou pronto.')
      return
    }

    const panel = document.createElement('div')
    panel.id = PANEL_ID
    panel.style.display = 'grid'
    panel.style.gap = '7px'
    panel.style.margin = '8px 0'
    panel.style.padding = '10px'
    panel.style.border = '1px solid rgba(242,201,76,.72)'
    panel.style.borderRadius = '10px'
    panel.style.background = '#07182c'
    panel.innerHTML = '<strong style="color:#f2c94c;font-size:11px;">BAIXA DE RESTRIÇÃO — QUAL É O CASO?</strong>'

    const options = [
      [TITLES.general, 'BAIXA DE RESTRIÇÃO — GERAL'],
      [TITLES.heirs, 'INVENTÁRIO — HERDEIROS'],
      [TITLES.third, 'INVENTÁRIO — TERCEIROS']
    ]

    options.forEach(([title, label]) => {
      const script = scriptByTitle(title)
      if (!script) return
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = label
      button.style.minHeight = '40px'
      button.style.border = '0'
      button.style.borderRadius = '9px'
      button.style.background = '#f4c84d'
      button.style.color = '#07182c'
      button.style.fontWeight = '800'
      button.style.cursor = 'pointer'
      button.addEventListener('click', () => choose(title, label))
      panel.appendChild(button)
    })

    host.insertAdjacentElement('beforebegin', panel)
    setStatus('Baixa de Restrição selecionada. Escolha o caso.')
    cue(panel.querySelector('button'))
  }

  function isBaixaMainButton (target) {
    const button = target?.closest?.('button')
    if (!button) return false
    if (button.id === MAIN_BUTTON_ID) return true
    return normalize(button.textContent).replace(/^\s*/, '') === 'baixa de restricao'
  }

  function bindGlobalInterceptor () {
    document.addEventListener('click', (event) => {
      if (!isBaixaMainButton(event.target)) return
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()

      document.querySelectorAll('.spfm-workflow-v3-service-button.is-selected').forEach((button) => {
        button.classList.remove('is-selected')
        button.setAttribute('aria-pressed', 'false')
      })
      const activeButton = event.target.closest('button')
      activeButton?.classList.add('is-selected')
      activeButton?.setAttribute('aria-pressed', 'true')

      renderChooser()
    }, true)
  }

  async function init () {
    try {
      const [scriptData, trelloData] = await Promise.all([
        fetchJson(SCRIPT_CATALOG_PATH),
        fetchJson(TRELLO_STATE_PATH)
      ])
      scripts = Array.isArray(scriptData?.scripts) ? scriptData.scripts : []
      trelloState = trelloData || null
      bindGlobalInterceptor()
    } catch (error) {
      console.error('[SEI Protocolistas] Falha ao iniciar fluxo direto de Baixa de Restrição:', error)
    }
  }

  init()
})()
