(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const api = typeof browser === 'undefined' ? chrome : browser
  const OPERATOR_KEY = 'fastMailOperadorValidado'
  const FAST_PROC_HANDOFF_KEY = 'fastMailFastProcHandoff'
  const SCRIPT_CATALOG_PATH = 'data/catalogo-scripts.json'
  const PROCESS_CATALOG_PATH = 'data/catalogo-processos.json'
  const BAIXA_BUTTON_ID = 'spfm-p0-baixa-restricao'
  const BAIXA_CHOOSER_ID = 'spfm-p0-baixa-chooser'
  const IDENTITY_STATE_ID = 'spfm-p0-identity-state'
  const IDENTIFICATION_COMPLETE_TITLE = 'SCRIPT DE IDENTIFICAÇÃO COMPLETO'
  const IDENTIFICATION_SERVICE_TITLE = 'SCRIPT DE IDENTIFICAÇÃO DO SERVIÇO'

  let scriptCatalog = []
  let processCatalog = null
  let operatorNumber = ''
  let lastNormalizedSubject = ''

  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim()

  function normalize (value) {
    return clean(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  }

  function sleep (ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms))
  }

  function storageGet (keys) {
    return new Promise((resolve, reject) => {
      const result = api.storage.local.get(keys, (items) => {
        const error = api.runtime?.lastError
        if (error) reject(error)
        else resolve(items || {})
      })
      if (result?.then) result.then(resolve, reject)
    })
  }

  function storageSet (items) {
    return new Promise((resolve, reject) => {
      const result = api.storage.local.set(items, () => {
        const error = api.runtime?.lastError
        if (error) reject(error)
        else resolve()
      })
      if (result?.then) result.then(resolve, reject)
    })
  }

  async function fetchJson (path) {
    const response = await fetch(api.runtime.getURL(path))
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  }

  function allDocuments () {
    const documents = [document]
    const visit = (candidate) => {
      for (let index = 0; index < candidate.frames.length; index += 1) {
        try {
          const frame = candidate.frames[index]
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

  function isVisible (element) {
    if (!element) return false
    const style = element.ownerDocument.defaultView?.getComputedStyle(element)
    if (!style || style.display === 'none' || style.visibility === 'hidden') return false
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }

  function findSubjectField () {
    const selectors = [
      'input[name*="subject" i]',
      'input[id*="subject" i]',
      'input[name*="assunto" i]',
      'input[id*="assunto" i]',
      'textarea[name*="subject" i]',
      'textarea[id*="subject" i]'
    ]

    for (const doc of allDocuments()) {
      for (const selector of selectors) {
        const field = Array.from(doc.querySelectorAll(selector)).find(isVisible)
        if (field) return field
      }
    }
    return null
  }

  function setFieldValue (field, value) {
    if (!field) return
    field.focus()
    if ('value' in field) field.value = value
    else field.textContent = value
    field.dispatchEvent(new Event('input', { bubbles: true }))
    field.dispatchEvent(new Event('change', { bubbles: true }))
    field.blur()
  }

  function setStatuses (primary, secondary = '') {
    const v2 = document.querySelector('#spfm-v2-status')
    const native = document.querySelector('#spfm-priority-status')
    if (v2 && primary) v2.textContent = primary
    if (native && (secondary || primary)) native.textContent = secondary || primary
  }

  function identityData () {
    const name = clean(document.querySelector('#spfm-requester-name')?.value)
    const cpf = String(document.querySelector('#spfm-requester-cpf')?.value || '').replace(/\D/g, '')
    return {
      name,
      cpf,
      confirmed: Boolean(name && cpf.length === 11)
    }
  }

  function processTypes () {
    return Array.isArray(processCatalog?.processTypes) ? processCatalog.processTypes : []
  }

  function processById (id) {
    return processTypes().find((item) => item.id === id) || null
  }

  function selectedScript () {
    const id = document.querySelector('#spfm-script-result')?.value || ''
    return scriptCatalog.find((item) => item.id === id) || null
  }

  function selectedPriorityRoute () {
    const topicId = document.querySelector('#spfm-priority-topic')?.value || ''
    const topic = (processCatalog?.fastMailPriorityTopics || []).find((item) => item.id === topicId)
    if (!topic) return null
    const variantId = document.querySelector('#spfm-topic-variant')?.value || ''
    const variant = (topic.variants || []).find((item) => item.id === variantId)
    return { ...topic, ...(variant || {}) }
  }

  function resolvedDestination () {
    const manual = clean(document.querySelector('#spfm-destination')?.value).toUpperCase()
    if (manual) return manual

    const procedureId = document.querySelector('#spfm-procedure')?.value || ''
    const procedure = processById(procedureId)
    if (procedure?.destinationUnit) return clean(procedure.destinationUnit).toUpperCase()

    const scriptDestination = clean(selectedScript()?.routing?.destinationUnit).toUpperCase()
    if (scriptDestination) return scriptDestination

    const route = selectedPriorityRoute()
    const routeProcess = route?.processId ? processById(route.processId) : null
    return clean(routeProcess?.destinationUnit || route?.destinationUnit).toUpperCase()
  }

  function ensureIdentityStateBox () {
    if (document.getElementById(IDENTITY_STATE_ID)) return document.getElementById(IDENTITY_STATE_ID)
    const navigation = document.querySelector('#spfm-navigation-v2')
    const modeGrid = navigation?.querySelector('.spfm-v2-mode-grid')
    if (!navigation || !modeGrid) return null

    const box = document.createElement('div')
    box.id = IDENTITY_STATE_ID
    box.style.margin = '8px 0'
    box.style.padding = '9px 11px'
    box.style.border = '1px solid rgba(217, 173, 49, .7)'
    box.style.borderRadius = '9px'
    box.style.background = 'rgba(7, 24, 44, .94)'
    box.style.fontSize = '11px'
    box.style.lineHeight = '1.35'
    modeGrid.insertAdjacentElement('afterend', box)
    return box
  }

  function updateIdentityState (openIdentificationWhenMissing = false) {
    const box = ensureIdentityStateBox()
    if (!box) return

    const identity = identityData()
    const destination = resolvedDestination()

    if (!identity.confirmed) {
      box.innerHTML = '<strong style="color:#f1c44f;">IDENTIDADE NÃO CONFIRMADA</strong><br><span>Nome completo e CPF precisam estar confirmados por documento ou informação expressa do requerente.</span>'
      if (openIdentificationWhenMissing) {
        const mode = document.querySelector('[data-spfm-v2-mode="identificacao"]')
        if (mode && mode.getAttribute('aria-pressed') !== 'true') mode.click()
      }
      return
    }

    if (!destination) {
      box.innerHTML = '<strong style="color:#f1c44f;">IDENTIDADE CONFIRMADA</strong><br><span>Serviço/destino ainda não identificado. Use IDENTIFICAR SERVIÇO quando o pedido não estiver claro.</span>'
      return
    }

    box.innerHTML = `<strong style="color:#b9e3bd;">IDENTIDADE CONFIRMADA</strong><br><span>Destino identificado: ${destination}. Atendimento pronto para triagem.</span>`
  }

  function shortcutByTitle (title) {
    return Array.from(document.querySelectorAll('#spfm-v2-identification-shortcuts .spfm-v2-quick-button'))
      .find((button) => normalize(button.title) === normalize(title)) || null
  }

  async function selectNativeScript (script) {
    if (!script) return false

    const phaseButton = document.querySelector(`.spfm-phase-button[data-phase-id="${script.phase}"]`)
    phaseButton?.click()

    const catalog = document.querySelector('#spfm-script-catalog')
    const toggle = document.querySelector('#spfm-script-toggle')
    if (!catalog) return false
    if (catalog.hidden && toggle) toggle.click()

    const search = document.querySelector('#spfm-script-search')
    const result = document.querySelector('#spfm-script-result')
    if (!search || !result) return false

    search.value = script.title
    search.dispatchEvent(new Event('input', { bubbles: true }))
    const option = Array.from(result.options || []).find((item) => item.value === script.id)
    if (!option) return false

    result.value = script.id
    result.dispatchEvent(new Event('change', { bubbles: true }))

    const identityFields = document.querySelector('#spfm-identity-fields')
    const emailPreparation = document.querySelector('#spfm-email-preparation')
    if (identityFields) identityFields.hidden = false
    if (emailPreparation) emailPreparation.hidden = false
    return true
  }

  async function oneClickScript (title, waitingStatus) {
    const script = scriptCatalog.find((item) => normalize(item.title) === normalize(title) && item.phase === 'identificacao')
    if (!script) {
      setStatuses(`Não localizei o script “${title}” no catálogo atual.`)
      return false
    }

    const selected = await selectNativeScript(script)
    if (!selected) {
      setStatuses(`O script “${title}” existe, mas não foi possível selecioná-lo automaticamente.`)
      return false
    }

    await sleep(60)
    const insert = document.querySelector('#spfm-insert-script')
    if (!insert || insert.disabled) {
      setStatuses('Script selecionado. Confira a resposta antes do envio.')
      return false
    }

    insert.click()
    window.setTimeout(() => setStatuses(waitingStatus), 120)
    return true
  }

  function bindIdentificationButtons () {
    const complete = shortcutByTitle(IDENTIFICATION_COMPLETE_TITLE)
    const service = shortcutByTitle(IDENTIFICATION_SERVICE_TITLE)
    const inventory = Array.from(document.querySelectorAll('#spfm-v2-identification-shortcuts .spfm-v2-quick-button'))
      .find((button) => normalize(button.textContent) === 'inventario')

    if (inventory) inventory.hidden = true

    if (complete) {
      complete.textContent = 'SOLICITAR IDENTIFICAÇÃO'
      complete.classList.add('is-emphasis')
      if (complete.dataset.spfmP0Bound !== 'true') {
        complete.dataset.spfmP0Bound = 'true'
        complete.addEventListener('click', () => {
          window.setTimeout(() => oneClickScript(
            IDENTIFICATION_COMPLETE_TITLE,
            'AGUARDANDO IDENTIFICAÇÃO DO REQUERENTE — resposta pronta para envio.'
          ), 20)
        })
      }
    }

    if (service) {
      service.textContent = 'IDENTIFICAR SERVIÇO'
      if (service.dataset.spfmP0Bound !== 'true') {
        service.dataset.spfmP0Bound = 'true'
        service.addEventListener('click', () => {
          window.setTimeout(() => oneClickScript(
            IDENTIFICATION_SERVICE_TITLE,
            'AGUARDANDO IDENTIFICAÇÃO DO SERVIÇO — resposta pronta para envio.'
          ), 20)
        })
      }
    }
  }

  function baixaScripts () {
    return scriptCatalog
      .filter((script) => script.phase === 'orientacao' && normalize(script.title).includes('baixa de restricao'))
      .sort((a, b) => {
        const rank = (script) => {
          const title = normalize(script.title)
          if (title === 'baixa de restricao') return 0
          if (title.includes('para herdeiros')) return 1
          if (title.includes('para terceiros')) return 2
          return 3
        }
        return rank(a) - rank(b) || clean(a.title).localeCompare(clean(b.title), 'pt-BR')
      })
  }

  function baixaLabel (script) {
    const title = normalize(script.title)
    if (title === 'baixa de restricao') return 'BAIXA DE RESTRIÇÃO — GERAL'
    if (title.includes('para herdeiros')) return 'INVENTÁRIO — HERDEIROS'
    if (title.includes('para terceiros')) return 'INVENTÁRIO — TERCEIROS'
    return script.title
  }

  function removeBaixaChooser () {
    document.getElementById(BAIXA_CHOOSER_ID)?.remove()
  }

  function showBaixaChooser () {
    removeBaixaChooser()
    document.querySelector('[data-spfm-v2-mode="orientacao"]')?.click()

    const shortcuts = document.querySelector('#spfm-v2-orientation-shortcuts')
    if (!shortcuts) return

    const chooser = document.createElement('div')
    chooser.id = BAIXA_CHOOSER_ID
    chooser.style.display = 'grid'
    chooser.style.gap = '7px'
    chooser.style.margin = '8px 0'
    chooser.style.padding = '10px'
    chooser.style.border = '1px solid rgba(217, 173, 49, .7)'
    chooser.style.borderRadius = '10px'
    chooser.style.background = 'rgba(7, 24, 44, .96)'

    const heading = document.createElement('strong')
    heading.textContent = 'BAIXA DE RESTRIÇÃO — QUAL É O CASO?'
    heading.style.color = '#f1c44f'
    heading.style.fontSize = '12px'
    chooser.appendChild(heading)

    const scripts = baixaScripts()
    scripts.forEach((script) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'spfm-v2-quick-button'
      button.textContent = baixaLabel(script)
      button.title = script.title
      button.addEventListener('click', async () => {
        removeBaixaChooser()
        const selected = await selectNativeScript(script)
        setStatuses(
          selected
            ? `BAIXA DE RESTRIÇÃO → ${baixaLabel(script)}. Confira a orientação e siga para a ação aplicável.`
            : 'Não foi possível abrir automaticamente este tipo de baixa de restrição.'
        )
      })
      chooser.appendChild(button)
    })

    if (!scripts.length) {
      const empty = document.createElement('span')
      empty.textContent = 'Nenhum script vigente de baixa de restrição foi localizado.'
      chooser.appendChild(empty)
    }

    shortcuts.insertAdjacentElement('afterend', chooser)
    setStatuses('BAIXA DE RESTRIÇÃO selecionada. Escolha o tipo da baixa.')
  }

  function injectBaixaButton () {
    const shortcuts = document.querySelector('#spfm-v2-orientation-shortcuts')
    if (!shortcuts || document.getElementById(BAIXA_BUTTON_ID)) return

    const button = document.createElement('button')
    button.id = BAIXA_BUTTON_ID
    button.type = 'button'
    button.className = 'spfm-v2-quick-button is-emphasis'
    button.textContent = 'BAIXA DE RESTRIÇÃO'
    button.addEventListener('click', showBaixaChooser)
    shortcuts.prepend(button)
  }

  function currentDate6 () {
    const now = new Date()
    return [
      String(now.getDate()).padStart(2, '0'),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getFullYear()).slice(-2)
    ].join('')
  }

  function normalizeSequence (value) {
    const digits = String(value || '').replace(/\D/g, '')
    const operator = clean(operatorNumber)

    if (operator && digits.endsWith(operator)) {
      const datePart = digits.slice(0, -operator.length)
      if (datePart.length === 6) return `${datePart}${operator}`
      if (datePart.length === 8) return `${datePart.slice(0, 4)}${datePart.slice(-2)}${operator}`
    }

    return operator ? `${currentDate6()}${operator}` : digits
  }

  function subjectPrefix (value) {
    const match = clean(value).match(/^((?:RE|ENC|FW|FWD)\s*:\s*)+/i)
    return match ? `${match[0].replace(/\s+/g, ' ').trim()} ` : ''
  }

  function normalizeOperationalSubject () {
    const field = findSubjectField()
    if (!field) return false

    const current = clean(field.value || field.textContent)
    if (!current || current === lastNormalizedSubject) return false

    const prefix = subjectPrefix(current)
    const body = clean(current.slice(prefix.length))
    const parts = body.split(/\s+-\s+/).map(clean).filter(Boolean)
    if (parts.length < 4) return false

    const status = parts[parts.length - 1].toUpperCase()
    if (!['TRIAGEM', 'FECHADO'].includes(status)) return false

    const content = parts.slice(0, -1)
    const sequenceIndex = content.findIndex((part) => /^\d{7,12}$/.test(part))
    if (sequenceIndex === -1) return false

    const normalizedSequence = normalizeSequence(content[sequenceIndex])
    if (!normalizedSequence) return false

    let name = ''
    let destination = ''

    if (sequenceIndex === content.length - 1) {
      destination = content[content.length - 2]
      name = content.slice(0, -2).join(' - ')
    } else if (sequenceIndex === content.length - 2) {
      destination = content[content.length - 1]
      name = content.slice(0, -2).join(' - ')
    } else {
      return false
    }

    if (!name) return false
    if (!destination || normalize(destination) === 'undefined') destination = 'DESTINO PENDENTE'

    const updated = `${prefix}${name.toUpperCase()} - ${normalizedSequence} - ${destination.toUpperCase()} - ${status}`
    if (updated === current) {
      lastNormalizedSubject = current
      return false
    }

    lastNormalizedSubject = updated
    setFieldValue(field, updated)
    return true
  }

  async function operatorFromStorage () {
    try {
      const stored = await storageGet(OPERATOR_KEY)
      operatorNumber = clean(stored[OPERATOR_KEY]?.number)
    } catch (_) {}

    if (!operatorNumber) {
      operatorNumber = clean(document.querySelector('#spfm-operator')?.textContent).match(/\d{1,4}/)?.[0] || ''
    }
  }

  function interceptPrepareEmail () {
    document.addEventListener('click', (event) => {
      const button = event.target.closest?.('#spfm-triagem')
      if (!button) return

      const identity = identityData()
      if (!identity.confirmed) {
        event.preventDefault()
        event.stopImmediatePropagation()
        const complete = shortcutByTitle(IDENTIFICATION_COMPLETE_TITLE)
        if (complete) complete.click()
        else oneClickScript(
          IDENTIFICATION_COMPLETE_TITLE,
          'AGUARDANDO IDENTIFICAÇÃO DO REQUERENTE — resposta pronta para envio.'
        )
        setStatuses('IDENTIDADE NÃO CONFIRMADA — solicitação de identificação preparada automaticamente.')
        return
      }

      if (!resolvedDestination()) {
        event.preventDefault()
        event.stopImmediatePropagation()
        const service = shortcutByTitle(IDENTIFICATION_SERVICE_TITLE)
        if (service) service.click()
        else oneClickScript(
          IDENTIFICATION_SERVICE_TITLE,
          'AGUARDANDO IDENTIFICAÇÃO DO SERVIÇO — resposta pronta para envio.'
        )
        setStatuses('SERVIÇO NÃO IDENTIFICADO — pedido de esclarecimento preparado automaticamente.')
        return
      }

      ;[350, 700, 1200, 1800].forEach((delay) => {
        window.setTimeout(normalizeOperationalSubject, delay)
      })
    }, true)
  }

  function patchManualSeiTypeHandoff (changes, areaName) {
    if (areaName !== 'local') return
    const handoff = changes?.[FAST_PROC_HANDOFF_KEY]?.newValue
    if (!handoff || handoff.manualSeiTypeSelection || (!handoff.procedureId && !handoff.procedureName)) return

    const process = processById(handoff.procedureId)
    if (!process?.manualSeiTypeSelection) return

    storageSet({
      [FAST_PROC_HANDOFF_KEY]: {
        ...handoff,
        seiProcessName: '',
        procedureName: '',
        manualSeiTypeSelection: true
      }
    }).catch((error) => {
      console.warn('[SEI Protocolistas] Não foi possível manter a tipologia SEI em seleção manual:', error)
    })
  }

  function updateCpfLabel () {
    const field = document.querySelector('#spfm-requester-cpf')
    const label = field?.closest('label')?.querySelector('span')
    if (!label || label.dataset.spfmP0Required === 'true') return
    label.dataset.spfmP0Required = 'true'
    label.innerHTML = 'CPF <small>(necessário para confirmar a identidade)</small>'
  }

  function bindIdentityInputs () {
    ;['#spfm-requester-name', '#spfm-requester-cpf'].forEach((selector) => {
      const field = document.querySelector(selector)
      if (!field || field.dataset.spfmP0IdentityBound === 'true') return
      field.dataset.spfmP0IdentityBound = 'true'
      field.addEventListener('input', () => updateIdentityState(false))
      field.addEventListener('change', () => updateIdentityState(false))
    })
  }

  function reconcile () {
    if (!document.querySelector('#sei-protocolistas-fast-mail-status')) return
    bindIdentificationButtons()
    injectBaixaButton()
    updateCpfLabel()
    bindIdentityInputs()
    updateIdentityState(false)
  }

  async function initialize () {
    try {
      const [scripts, processes] = await Promise.all([
        fetchJson(SCRIPT_CATALOG_PATH),
        fetchJson(PROCESS_CATALOG_PATH)
      ])
      scriptCatalog = Array.isArray(scripts?.scripts) ? scripts.scripts : []
      processCatalog = processes || null
    } catch (error) {
      console.warn('[SEI Protocolistas] Camada P0 iniciou sem catálogo completo:', error)
    }

    await operatorFromStorage()
    interceptPrepareEmail()
    api.storage?.onChanged?.addListener?.(patchManualSeiTypeHandoff)

    const observer = new MutationObserver(reconcile)
    observer.observe(document.documentElement, { childList: true, subtree: true })

    const startedAt = Date.now()
    while (Date.now() - startedAt < 10000) {
      if (document.querySelector('#sei-protocolistas-fast-mail-status')) break
      await sleep(100)
    }

    reconcile()
    updateIdentityState(true)
    window.setInterval(() => {
      operatorFromStorage()
      normalizeOperationalSubject()
    }, 1200)
  }

  initialize()
})()
