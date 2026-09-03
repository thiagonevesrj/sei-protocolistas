(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const api = typeof browser === 'undefined' ? chrome : browser
  const OPERATOR_KEY = 'fastMailOperadorValidado'
  const FAST_PROC_HANDOFF_KEY = 'fastMailFastProcHandoff'
  const SCRIPT_CATALOG_PATH = 'data/catalogo-scripts.json'
  const PROCESS_CATALOG_PATH = 'data/catalogo-processos.json'
  const TRELLO_STATE_PATH = 'data/trello-fase02-estado-atual.json'
  const BAIXA_BUTTON_ID = 'spfm-p0-baixa-restricao'
  const BAIXA_CHOOSER_ID = 'spfm-p0-baixa-chooser'
  const IDENTITY_STATE_ID = 'spfm-p0-identity-state'
  const PRESENTIAL_PANEL_ID = 'spfm-p0-presential-panel'
  const IDENTIFICATION_COMPLETE_TITLE = 'SCRIPT DE IDENTIFICAÇÃO COMPLETO'
  const IDENTIFICATION_SERVICE_TITLE = 'SCRIPT DE IDENTIFICAÇÃO DO SERVIÇO'
  const INVENTORY_HEIRS_TITLE = 'Baixa de restrição referente a inventário (PARA HERDEIROS)'
  const INVENTORY_THIRD_PARTY_TITLE = 'Transferência de propriedade com baixa de restrição de inventário (PARA TERCEIROS)'
  const GENERAL_REQUEST_URL = 'https://www.detran.rj.gov.br/images/formularios/DETRAN_0049_requerimento_geral.pdf'
  const RESIDENCE_URL = 'https://www.detran.rj.gov.br/images/formularios/DETRAN0034_declararesid.pdf'
  const LOST_ATPV_URL = 'https://www.detran.rj.gov.br/images/drv/declaracao_perda_ATPV.pdf'
  const DUDA_URL = 'https://www.ib7.bradesco.com.br/ibpfdetranrj/debitoVeiculoRJDudaSelecionarProduto.do?cdProdutoInicial=INI'
  const PROTOCOL_SCHEDULING_URL = 'https://www.detran.rj.gov.br/todos-os-agendamentos/agendamento-recursos-e-protocolo.html'
  const CIRETRAN_URL = 'https://www.detran.rj.gov.br/consultas/consultas-drv/lista-de-ciretrans-sats.html'
  const HISTORY_SEPARATOR = '----- HISTÓRICO DE MENSAGENS ANTERIORES -----'

  const HEIRS_MISSING_DOCUMENTS = [
    {
      id: 'general-request',
      label: 'Requerimento Geral',
      text: 'Requerimento Geral devidamente preenchido e assinado pela pessoa que está com o veículo em seu nome.',
      link: GENERAL_REQUEST_URL,
      linkLabel: 'Acessar o Requerimento Geral'
    },
    {
      id: 'crv-security',
      label: 'CRV original ou Código de Segurança',
      text: 'CRV original, caso emitido antes de 04/01/2021, ou Código de Segurança, caso o documento seja digital.'
    },
    {
      id: 'lost-atpv-conditional',
      label: 'Se não houver CRV/Código: Declaração de Perda + DUDA 003-5',
      text: 'Caso não possua o CRV original ou o Código de Segurança: Declaração de Perda e Extravio de ATPV-e/Código de Segurança, com firma do proprietário reconhecida por autenticidade, acompanhada do DUDA 003-5.',
      links: [
        { url: LOST_ATPV_URL, label: 'Acessar a Declaração de Perda/Extravio de ATPV-e' },
        { url: DUDA_URL, label: 'Emitir o DUDA 003-5' }
      ]
    },
    {
      id: 'crlv',
      label: 'CRLV / CRLV-e',
      text: 'CRLV ou CRLV-e do veículo.'
    },
    {
      id: 'heirs-declarations',
      label: 'Declarações dos herdeiros',
      text: 'Declaração para abrir mão da propriedade de um veículo, preenchida/assinada pelos herdeiros que concordam com a baixa. Os originais dessas declarações ficam retidos no processo.',
      originalRetained: true
    },
    {
      id: 'identification',
      label: 'Documento de identificação',
      text: 'Documento de identificação do requerente.'
    },
    {
      id: 'cpf',
      label: 'CPF',
      text: 'CPF do requerente.'
    },
    {
      id: 'residence',
      label: 'Comprovante de residência',
      text: 'Comprovante de residência em nome do requerente, emitido há no máximo seis meses, ou Declaração de Residência.',
      link: RESIDENCE_URL,
      linkLabel: 'Acessar a Declaração de Residência'
    },
    {
      id: 'legal-entity',
      label: 'Documentação de pessoa jurídica, se aplicável',
      text: 'Se o requerente for pessoa jurídica: CNPJ, documentos constitutivos e documento de identidade/CPF do sócio que solicita o serviço.'
    },
    {
      id: 'representation',
      label: 'Documentação de representação, se aplicável',
      text: 'Documentação de representação aplicável ao caso, incluindo procuração/credencial do representante e documentos de identificação exigidos para a modalidade de representação.'
    }
  ]

  let scriptCatalog = []
  let processCatalog = null
  let trelloState = null
  let operatorNumber = ''
  let lastNormalizedSubject = ''
  let reconcileTimer = null
  let identityOpenedAutomatically = false
  let activeBaixaScriptId = ''

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

  function dispatchFieldEvent (field, eventName) {
    const view = field?.ownerDocument?.defaultView || window
    field?.dispatchEvent(new view.Event(eventName, { bubbles: true }))
  }

  function setNativeFieldValue (field, value) {
    if (!field) return
    field.focus?.()

    if ('value' in field) {
      const proto = Object.getPrototypeOf(field)
      const descriptor = proto ? Object.getOwnPropertyDescriptor(proto, 'value') : null
      if (descriptor?.set) descriptor.set.call(field, value)
      else field.value = value
    } else {
      field.textContent = value
    }

    dispatchFieldEvent(field, 'input')
    dispatchFieldEvent(field, 'change')
    dispatchFieldEvent(field, 'keyup')
    dispatchFieldEvent(field, 'blur')
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

  function findMessageBodyEditor () {
    const candidates = []

    for (const doc of allDocuments()) {
      const elements = Array.from(doc.querySelectorAll('[contenteditable="true"], body[contenteditable="true"]'))
      if (doc.designMode?.toLowerCase() === 'on' && doc.body) elements.push(doc.body)

      elements.forEach((element) => {
        if (!isVisible(element)) return
        if (element.closest?.('#sei-protocolistas-fast-mail-status')) return
        if (element.matches?.('input,textarea')) return

        const rect = element.getBoundingClientRect()
        const area = rect.width * rect.height
        if (area < 12000) return

        const label = `${element.getAttribute?.('aria-label') || ''} ${element.getAttribute?.('title') || ''}`
        if (/assunto|subject|bcc|cc|destinat|recipient/i.test(label)) return
        candidates.push({ element, score: area + (element.innerText?.length || 0) })
      })
    }

    candidates.sort((a, b) => b.score - a.score)
    return candidates[0]?.element || null
  }

  function escapeHtml (value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  function insertResponseBeforeHistory (editor, responseHtml) {
    if (!editor) return false
    if (editor.querySelector?.('[data-sei-protocolistas="presential-missing-documents"]')) {
      throw new Error('A orientação de documentos presenciais já foi inserida nesta resposta.')
    }

    const oldHtml = editor.innerHTML || ''
    const separator = `<div data-sei-protocolistas="history-separator" style="margin:22px 0 14px 0;padding-top:10px;border-top:1px solid #a7a7a7;color:#666;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:.04em;">${HISTORY_SEPARATOR}</div>`
    editor.focus()
    editor.innerHTML = `${responseHtml}${separator}${oldHtml}`
    dispatchFieldEvent(editor, 'input')
    dispatchFieldEvent(editor, 'change')
    return true
  }

  function setStatuses (primary, secondary = '') {
    const v2 = document.querySelector('#spfm-v2-status')
    const native = document.querySelector('#spfm-priority-status')
    if (v2 && primary && v2.textContent !== primary) v2.textContent = primary
    if (native && (secondary || primary)) {
      const message = secondary || primary
      if (native.textContent !== message) native.textContent = message
    }
  }

  function identityData () {
    const name = clean(document.querySelector('#spfm-requester-name')?.value)
    const cpf = String(document.querySelector('#spfm-requester-cpf')?.value || '').replace(/\D/g, '')
    return { name, cpf, confirmed: Boolean(name && cpf.length === 11) }
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

  function trelloRecordForScript (script) {
    if (!script) return null
    return (trelloState?.records || []).find((record) => record.scriptId === script.id) || null
  }

  function isPresentialScript (script) {
    return Boolean(trelloRecordForScript(script)?.labels?.includes('PRESENCIAL SOMENTE'))
  }

  function isHeirsInventory (script) {
    return normalize(script?.title) === normalize(INVENTORY_HEIRS_TITLE)
  }

  function isThirdPartyInventory (script) {
    return normalize(script?.title) === normalize(INVENTORY_THIRD_PARTY_TITLE)
  }

  function ensureIdentityStateBox () {
    const existing = document.getElementById(IDENTITY_STATE_ID)
    if (existing) return existing

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
    let stateKey = ''
    let html = ''

    if (!identity.confirmed) {
      stateKey = 'unconfirmed'
      html = '<strong style="color:#f1c44f;">IDENTIDADE NÃO CONFIRMADA</strong><br><span>Nome completo e CPF precisam estar confirmados por documento ou informação expressa do requerente.</span>'
    } else if (!destination) {
      stateKey = 'confirmed-no-service'
      html = '<strong style="color:#f1c44f;">IDENTIDADE CONFIRMADA</strong><br><span>Serviço/destino ainda não identificado. Use IDENTIFICAR SERVIÇO quando o pedido não estiver claro.</span>'
    } else {
      stateKey = `confirmed:${destination}`
      html = `<strong style="color:#b9e3bd;">IDENTIDADE CONFIRMADA</strong><br><span>Destino identificado: ${escapeHtml(destination)}. Atendimento pronto para triagem.</span>`
    }

    if (box.dataset.spfmP0State !== stateKey) {
      box.dataset.spfmP0State = stateKey
      box.innerHTML = html
    }

    if (!identity.confirmed && openIdentificationWhenMissing && !identityOpenedAutomatically) {
      identityOpenedAutomatically = true
      const mode = document.querySelector('[data-spfm-v2-mode="identificacao"]')
      if (mode && mode.getAttribute('aria-pressed') !== 'true') mode.click()
    }
  }

  function shortcutByTitle (title) {
    return Array.from(document.querySelectorAll('#spfm-v2-identification-shortcuts .spfm-v2-quick-button'))
      .find((button) => normalize(button.title) === normalize(title)) || null
  }

  async function selectNativeScript (script) {
    if (!script) return false

    document.querySelector(`.spfm-phase-button[data-phase-id="${script.phase}"]`)?.click()
    const catalog = document.querySelector('#spfm-script-catalog')
    const toggle = document.querySelector('#spfm-script-toggle')
    if (!catalog) return false
    if (catalog.hidden && toggle) toggle.click()

    const search = document.querySelector('#spfm-script-search')
    const result = document.querySelector('#spfm-script-result')
    if (!search || !result) return false

    setNativeFieldValue(search, script.title)
    const option = Array.from(result.options || []).find((item) => item.value === script.id)
    if (!option) return false

    result.value = script.id
    dispatchFieldEvent(result, 'change')

    const identityFields = document.querySelector('#spfm-identity-fields')
    const emailPreparation = document.querySelector('#spfm-email-preparation')
    if (identityFields) identityFields.hidden = false
    if (emailPreparation) emailPreparation.hidden = false
    activeBaixaScriptId = script.id
    scheduleReconcile()
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

    await sleep(80)
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

    if (inventory && !inventory.hidden) inventory.hidden = true

    if (complete) {
      if (complete.textContent !== 'SOLICITAR IDENTIFICAÇÃO') complete.textContent = 'SOLICITAR IDENTIFICAÇÃO'
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
      if (service.textContent !== 'IDENTIFICAR SERVIÇO') service.textContent = 'IDENTIFICAR SERVIÇO'
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
        const presencial = isPresentialScript(script)
        setStatuses(
          selected
            ? `BAIXA DE RESTRIÇÃO → ${baixaLabel(script)}${presencial ? ' — SOMENTE PRESENCIAL' : ''}.`
            : 'Não foi possível abrir automaticamente este tipo de baixa de restrição.'
        )
        if (selected) window.setTimeout(() => renderPresentialPanel(script), 50)
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

  function presentialSelectedDocuments () {
    return Array.from(document.querySelectorAll('#spfm-p0-presential-docs input[type="checkbox"]:checked'))
      .map((checkbox) => HEIRS_MISSING_DOCUMENTS.find((item) => item.id === checkbox.value))
      .filter(Boolean)
  }

  function updatePresentialInsertButton () {
    const button = document.querySelector('#spfm-p0-insert-presential')
    if (!button) return
    const count = presentialSelectedDocuments().length
    button.disabled = count === 0
    button.textContent = count
      ? `PREPARAR ORIENTAÇÃO PRESENCIAL (${count})`
      : 'MARQUE O QUE ESTÁ FALTANDO'
  }

  function linkHtmlForDocument (documentItem) {
    const links = []
    if (documentItem.link) links.push({ url: documentItem.link, label: documentItem.linkLabel || 'Acessar formulário' })
    ;(documentItem.links || []).forEach((item) => links.push(item))
    if (!links.length) return ''
    return `<div style="margin:4px 0 10px 0;">${links.map((item) => `<a href="${escapeHtml(item.url)}">${escapeHtml(item.label)}</a>`).join(' &nbsp;|&nbsp; ')}</div>`
  }

  function buildPresentialMissingHtml (documents) {
    const name = escapeHtml(identityData().name)
    const items = documents.map((item) => `<li style="margin:0 0 8px 0;">${escapeHtml(item.text)}${linkHtmlForDocument(item)}</li>`).join('')
    const declarationsSelected = documents.some((item) => item.originalRetained)

    return `
      <div data-sei-protocolistas="presential-missing-documents" style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#000;">
        <p style="margin:0 0 14px 0;">${name ? `Olá, ${name}.` : 'Olá.'}</p>
        <p style="margin:0 0 12px 0;">Para o atendimento de <strong>baixa de restrição referente a inventário — herdeiros</strong>, identificamos que ainda deverão ser apresentados os seguintes itens no atendimento presencial:</p>
        <ul style="margin:0 0 14px 22px;padding:0;">${items}</ul>
        <div style="margin:16px 0;padding:12px 14px;background:#f6f7f9;border:1px solid #c9ced6;border-left:4px solid #7a8491;border-radius:4px;color:#1f1f1f;">
          <p style="margin:0 0 7px 0;font-weight:700;">ATENDIMENTO SOMENTE PRESENCIAL</p>
          <p style="margin:0;">Os itens acima são pendências para apresentação no posto. <strong>Reúna também toda a documentação exigida para o procedimento</strong>. Não é possível abrir este processo administrativo por e-mail.</p>
        </div>
        ${declarationsSelected ? '<p style="margin:0 0 12px 0;"><strong>Importante:</strong> os originais das declarações dos herdeiros ficam retidos no processo.</p>' : ''}
        <p style="margin:0 0 8px 0;"><strong>Capital:</strong> faça o agendamento de Recursos e Protocolo pelo link:</p>
        <p style="margin:0 0 12px 0;"><a href="${PROTOCOL_SCHEDULING_URL}">Agendamento — Recursos e Protocolo</a></p>
        <p style="margin:0 0 8px 0;"><strong>Demais municípios do Estado:</strong> não é necessário se deslocar até a capital; verifique a CIRETRAN ou SAT mais próxima:</p>
        <p style="margin:0 0 14px 0;"><a href="${CIRETRAN_URL}">Lista de CIRETRANs e SATs</a></p>
        <p style="margin:18px 0 0 0;">Atenciosamente,<br><br>Serviço de Protocolo<br>DETRAN-RJ</p>
      </div>`
  }

  async function insertPresentialMissingDocuments () {
    const documents = presentialSelectedDocuments()
    if (!documents.length) {
      setStatuses('Marque pelo menos um documento que esteja faltando para o atendimento presencial.')
      return
    }

    const editor = findMessageBodyEditor()
    if (!editor) {
      setStatuses('Não localizei o corpo editável do e-mail para inserir a orientação presencial.')
      return
    }

    try {
      insertResponseBeforeHistory(editor, buildPresentialMissingHtml(documents))
      setStatuses('ORIENTAÇÃO PRESENCIAL PREPARADA — confira e envie ao requerente.')
      document.querySelector('#spfm-email-preparation')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
    } catch (error) {
      setStatuses(error.message || 'Não foi possível inserir a orientação presencial.')
    }
  }

  function removePresentialPanel () {
    document.getElementById(PRESENTIAL_PANEL_ID)?.remove()
  }

  function renderPresentialPanel (script) {
    if (!script || !isPresentialScript(script)) {
      removePresentialPanel()
      return
    }

    const existing = document.getElementById(PRESENTIAL_PANEL_ID)
    if (existing?.dataset.scriptId === script.id) return
    removePresentialPanel()

    const anchor = document.querySelector('#spfm-action-step') || document.querySelector('#spfm-script-catalog')
    if (!anchor) return

    const panel = document.createElement('div')
    panel.id = PRESENTIAL_PANEL_ID
    panel.dataset.scriptId = script.id
    panel.style.margin = '10px 0'
    panel.style.padding = '12px'
    panel.style.border = '1px solid rgba(241, 196, 79, .72)'
    panel.style.borderRadius = '10px'
    panel.style.background = 'rgba(7, 24, 44, .96)'
    panel.style.display = 'grid'
    panel.style.gap = '8px'

    const title = document.createElement('strong')
    title.style.color = '#f1c44f'
    title.textContent = 'SOMENTE PRESENCIAL'
    panel.appendChild(title)

    const helper = document.createElement('span')
    helper.style.fontSize = '11px'
    helper.textContent = isHeirsInventory(script)
      ? 'Marque somente o que está faltando. A resposta orientará o cidadão a levar as pendências e a documentação completa ao posto.'
      : 'Este procedimento está marcado no Trello vigente como PRESENCIAL SOMENTE. Use a orientação do script e não ofereça abertura por e-mail.'
    panel.appendChild(helper)

    if (isHeirsInventory(script)) {
      const list = document.createElement('div')
      list.id = 'spfm-p0-presential-docs'
      list.style.display = 'grid'
      list.style.gap = '6px'

      HEIRS_MISSING_DOCUMENTS.forEach((item) => {
        const label = document.createElement('label')
        label.style.display = 'flex'
        label.style.alignItems = 'flex-start'
        label.style.gap = '7px'
        label.style.fontSize = '11px'

        const checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.value = item.id
        checkbox.addEventListener('change', updatePresentialInsertButton)

        const text = document.createElement('span')
        text.textContent = item.label
        label.append(checkbox, text)
        list.appendChild(label)
      })

      const modelNote = document.createElement('small')
      modelNote.style.opacity = '.78'
      modelNote.textContent = 'A declaração dos herdeiros existe como anexo do card interno do Trello; não será enviado ao cidadão um link interno sem URL pública confirmada.'

      const insert = document.createElement('button')
      insert.id = 'spfm-p0-insert-presential'
      insert.type = 'button'
      insert.className = 'spfm-v2-quick-button is-emphasis'
      insert.disabled = true
      insert.textContent = 'MARQUE O QUE ESTÁ FALTANDO'
      insert.addEventListener('click', insertPresentialMissingDocuments)

      panel.append(list, modelNote, insert)
    } else if (isThirdPartyInventory(script)) {
      const note = document.createElement('small')
      note.style.opacity = '.8'
      note.textContent = 'Inventário para terceiros: atendimento presencial confirmado. O checklist detalhado permanece na orientação oficial até a extração/validação específica da documentação deste fluxo.'
      panel.appendChild(note)
    }

    anchor.insertAdjacentElement('afterend', panel)
    panel.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
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
    setNativeFieldValue(field, updated)
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
      field.addEventListener('input', scheduleReconcile)
      field.addEventListener('change', scheduleReconcile)
    })

    const scriptResult = document.querySelector('#spfm-script-result')
    if (scriptResult && scriptResult.dataset.spfmP0SelectionBound !== 'true') {
      scriptResult.dataset.spfmP0SelectionBound = 'true'
      scriptResult.addEventListener('change', scheduleReconcile)
    }
  }

  function updatePresentialPanelFromSelection () {
    const script = selectedScript()
    if (!script) {
      if (!activeBaixaScriptId) removePresentialPanel()
      return
    }

    if (isPresentialScript(script)) renderPresentialPanel(script)
    else if (document.getElementById(PRESENTIAL_PANEL_ID)) removePresentialPanel()
  }

  function reconcile () {
    if (!document.querySelector('#sei-protocolistas-fast-mail-status')) return
    bindIdentificationButtons()
    injectBaixaButton()
    updateCpfLabel()
    bindIdentityInputs()
    updateIdentityState(false)
    updatePresentialPanelFromSelection()
  }

  function scheduleReconcile () {
    if (reconcileTimer) return
    reconcileTimer = window.setTimeout(() => {
      reconcileTimer = null
      reconcile()
    }, 60)
  }

  async function initialize () {
    try {
      const [scripts, processes, trello] = await Promise.all([
        fetchJson(SCRIPT_CATALOG_PATH),
        fetchJson(PROCESS_CATALOG_PATH),
        fetchJson(TRELLO_STATE_PATH)
      ])
      scriptCatalog = Array.isArray(scripts?.scripts) ? scripts.scripts : []
      processCatalog = processes || null
      trelloState = trello || null
    } catch (error) {
      console.warn('[SEI Protocolistas] Camada P0 iniciou sem catálogo completo:', error)
    }

    await operatorFromStorage()
    interceptPrepareEmail()
    api.storage?.onChanged?.addListener?.(patchManualSeiTypeHandoff)

    const observer = new MutationObserver(scheduleReconcile)
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
