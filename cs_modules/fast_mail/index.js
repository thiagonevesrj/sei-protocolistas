(() => {
  'use strict'

  if (window.top !== window) return

  const IS_COMPOSE_WINDOW = /[?&]ae=PreFormAction(?:&|$)/i.test(location.search) &&
    /[?&]a=(?:Reply|ReplyAll|Forward|New)(?:&|$)/i.test(location.search)

  const api = typeof browser === 'undefined' ? chrome : browser
  const OPERATOR_KEY = 'fastMailOperadorValidado'
  const ATTENDANCE_KEY = 'centralProtocolistaAtendimento'
  const FAST_PROC_HANDOFF_KEY = 'fastMailFastProcHandoff'
  const EMAIL_RESULT_KEY = 'fastMailProcessoFinalizado'
  const WEBMAIL_CREDENTIALS_KEY = 'centralProtocolistaWebmailCredentials'
  const SEI_LOGIN_URL = 'https://sei.rj.gov.br/sip/login.php?sigla_orgao_sistema=ERJ&sigla_sistema=SEI'
  const BCC_EMAIL = 'protocolodetran@detran.rj.gov.br'
  const CATALOG_PATH = 'data/catalogo-processos.json'
  const SCRIPT_CATALOG_PATH = 'data/catalogo-scripts.json'
  const HISTORY_SEPARATOR = '----- HISTÓRICO DE MENSAGENS ANTERIORES -----'
  const REGISTER_ORIGIN_MESSAGE = 'sei-protocolistas:register-fast-mail-origin'
  const PROCESS_RESULT_READY_MESSAGE = 'sei-protocolistas:process-result-ready'

  let catalogProcesses = []
  let catalogNavigation = { areas: [] }
  let priorityTopics = []
  let responseScripts = []
  let responseScriptPhases = []
  let currentOperator = null
  let processResultAutofillRunning = false

  function processTypeById (procedureId) {
    return catalogProcesses.find((item) => item.id === procedureId) || null
  }

  function missingDocumentsForProcedure (procedureId) {
    const processType = processTypeById(procedureId)
    return Array.isArray(processType?.missingDocuments)
      ? processType.missingDocuments
      : []
  }

  const storageGet = (keys) => new Promise((resolve, reject) => {
    const result = api.storage.local.get(keys, (items) => {
      const error = api.runtime?.lastError
      if (error) reject(error)
      else resolve(items)
    })
    if (result?.then) result.then(resolve, reject)
  })

  const storageSet = (items) => new Promise((resolve, reject) => {
    const result = api.storage.local.set(items, () => {
      const error = api.runtime?.lastError
      if (error) reject(error)
      else resolve()
    })
    if (result?.then) result.then(resolve, reject)
  })

  const storageRemove = (keys) => new Promise((resolve, reject) => {
    const result = api.storage.local.remove(keys, () => {
      const error = api.runtime?.lastError
      if (error) reject(error)
      else resolve()
    })
    if (result?.then) result.then(resolve, reject)
  })

  const runtimeMessage = (message) => new Promise((resolve, reject) => {
    const result = api.runtime.sendMessage(message, (response) => {
      const error = api.runtime?.lastError
      if (error) reject(error)
      else if (response?.ok === false) reject(new Error(response.error || 'Falha na comunicação da extensão.'))
      else resolve(response || {})
    })
    if (result?.then) result.then(resolve, reject)
  })

  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))

  function dispatchFieldEvents (field) {
    ['input', 'change', 'keyup', 'blur'].forEach((eventName) => {
      field.dispatchEvent(new Event(eventName, { bubbles: true }))
    })
  }

  function findLoginField (selectors) {
    for (const doc of allDocuments()) {
      for (const selector of selectors) {
        const field = doc.querySelector(selector)
        if (field && isVisible(field)) return field
      }
    }
    return null
  }

  async function autoLoginWebmail () {
    const passwordField = findLoginField([
      'input[type="password"]',
      'input[name*="password" i]',
      'input[id*="password" i]',
      'input[name*="senha" i]',
      'input[id*="senha" i]'
    ])

    if (!passwordField) return false

    const userField = findLoginField([
      'input[type="email"]',
      'input[autocomplete="username"]',
      'input[name*="username" i]',
      'input[id*="username" i]',
      'input[name*="usuario" i]',
      'input[id*="usuario" i]'
    ])

    if (!userField) return false

    const stored = await storageGet(WEBMAIL_CREDENTIALS_KEY)
    const credentials = stored[WEBMAIL_CREDENTIALS_KEY]
    if (!credentials?.remember || !credentials.user || !credentials.password) return false

    const attemptKey = 'seiProtocolistasWebmailLoginAttempt'
    const previousAttempt = Number(sessionStorage.getItem(attemptKey) || 0)
    if (Date.now() - previousAttempt < 30000) return true
    sessionStorage.setItem(attemptKey, String(Date.now()))

    userField.focus()
    userField.value = credentials.user
    dispatchFieldEvents(userField)
    passwordField.focus()
    passwordField.value = credentials.password
    dispatchFieldEvents(passwordField)

    const form = passwordField.closest('form') || userField.closest('form')
    const submit = form?.querySelector('button[type="submit"],input[type="submit"],button:not([type])')
    await sleep(150)

    if (submit) clickElement(submit)
    else if (form?.requestSubmit) form.requestSubmit()
    else form?.submit?.()

    return true
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

  function textFromDocuments () {
    return allDocuments().map((doc) => doc.body?.innerText || '').join('\n')
  }

  function findOperator () {
    const text = textFromDocuments()
    const accountMatch = text.match(/protocolista\s*(\d{1,4})@detran\.rj\.gov\.br/i)
    const labelMatch = text.match(/\bProtocolista\s+(\d{1,4})\b/i)
    const number = accountMatch?.[1] || labelMatch?.[1] || ''

    if (!number) return null

    return {
      number,
      email: `protocolista${number}@detran.rj.gov.br`,
      source: accountMatch ? 'conta-webmail' : 'rotulo-webmail',
      validatedAt: Date.now()
    }
  }

  function normalizeEmail (value) {
    return String(value || '')
      .replace(/^mailto:/i, '')
      .replace(/[[\]<>]/g, '')
      .split('?')[0]
      .trim()
      .toLowerCase()
  }

  function extractEmailFromCurrentHeaderText (text) {
    const normalizedText = String(text || '').replace(/\r/g, '')
    const paraIndex = normalizedText.search(/(?:^|\n)\s*Para:\s*/i)
    const header = paraIndex >= 0
      ? normalizedText.slice(0, paraIndex)
      : normalizedText.slice(0, 700)

    const bracketMatch = header.match(/\[([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\]/i)
    if (bracketMatch) return normalizeEmail(bracketMatch[1])

    const directMatch = header.match(/\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i)
    return directMatch ? normalizeEmail(directMatch[1]) : ''
  }

  function findSenderEmail () {
    const candidates = []

    allDocuments().forEach((doc) => {
      const text = doc.body?.innerText || ''
      if (!text) return

      const email = extractEmailFromCurrentHeaderText(text)
      if (!email) return
      if (/^protocolista\d+@detran\.rj\.gov\.br$/i.test(email)) return

      const paraIndex = text.search(/(?:^|\n)\s*Para:\s*/i)
      candidates.push({
        email,
        score: paraIndex >= 0 ? paraIndex : Number.MAX_SAFE_INTEGER
      })
    })

    candidates.sort((a, b) => a.score - b.score)
    return candidates[0]?.email || ''
  }

  function isVisible (element) {
    if (!element) return false
    const view = element.ownerDocument.defaultView
    const style = view?.getComputedStyle(element)
    if (!style || style.display === 'none' || style.visibility === 'hidden') return false
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }

  function elementText (element) {
    return String(
      element?.innerText ||
      element?.textContent ||
      element?.value ||
      element?.getAttribute?.('aria-label') ||
      element?.getAttribute?.('title') ||
      ''
    ).replace(/\s+/g, ' ').trim()
  }

  function clickElement (element) {
    if (!element) return false

    const target = element.closest?.('a,button,input,label') || element
    const view = target.ownerDocument.defaultView || window
    target.focus?.()

    const options = { bubbles: true, cancelable: true, view }
    target.dispatchEvent(new MouseEvent('mousedown', options))
    target.dispatchEvent(new MouseEvent('mouseup', options))
    target.dispatchEvent(new MouseEvent('click', options))
    return true
  }

  async function waitFor (getter, timeout = 3500, interval = 120) {
    const startedAt = Date.now()

    while (Date.now() - startedAt < timeout) {
      const result = getter()
      if (result) return result
      await sleep(interval)
    }

    return null
  }

  function findOptionsButton () {
    for (const doc of allDocuments()) {
      const items = Array.from(doc.querySelectorAll('a,button,span,div'))
        .filter((element) =>
          isVisible(element) &&
          /^Opções\.{0,3}$/i.test(elementText(element))
        )

      if (items.length) return items[0]
    }

    return null
  }

  function findShowBccCheckbox () {
    for (const doc of allDocuments()) {
      const labels = Array.from(doc.querySelectorAll('label,span,div,td'))
        .filter((element) =>
          isVisible(element) &&
          /^Mostrar\s+Bcc$/i.test(elementText(element))
        )

      for (const label of labels) {
        const forId = label.getAttribute?.('for')

        if (forId) {
          const linked = doc.getElementById(forId)
          if (linked?.type === 'checkbox' && isVisible(linked)) return linked
        }

        const container = label.closest('tr,div,td')
        const checkbox = container?.querySelector('input[type="checkbox"]')
        if (checkbox && isVisible(checkbox)) return checkbox

        const previous = label.previousElementSibling
        if (previous?.matches?.('input[type="checkbox"]') && isVisible(previous)) {
          return previous
        }
      }

      const checkboxes = Array.from(doc.querySelectorAll('input[type="checkbox"]'))
        .filter(isVisible)

      for (const checkbox of checkboxes) {
        const rowText = elementText(checkbox.closest('tr,div,td'))
        if (/Mostrar\s+Bcc/i.test(rowText)) return checkbox
      }
    }

    return null
  }

  function findOptionsOkButton () {
    for (const doc of allDocuments()) {
      const dialogCandidates = Array.from(doc.querySelectorAll('div,table,form'))
        .filter((element) =>
          isVisible(element) &&
          /Opções de Mensagens/i.test(elementText(element))
        )

      const scopes = dialogCandidates.length ? dialogCandidates : [doc]

      for (const scope of scopes) {
        const candidates = Array.from(scope.querySelectorAll(
          'button,input[type="button"],input[type="submit"],a,span,div'
        )).filter((element) => {
          if (!isVisible(element)) return false

          const text = elementText(element)
          const value = String(element.value || '').trim()

          return /^OK$/i.test(text) || /^OK$/i.test(value)
        })

        if (candidates.length) {
          return candidates.sort((a, b) => {
            const ar = a.getBoundingClientRect()
            const br = b.getBoundingClientRect()
            return br.top - ar.top || ar.left - br.left
          })[0]
        }
      }
    }

    return null
  }

  function findBccField () {
    const selectors = [
      'input[name*="bcc" i]',
      'textarea[name*="bcc" i]',
      'input[id*="bcc" i]',
      'textarea[id*="bcc" i]',
      'input[aria-label*="bcc" i]',
      'textarea[aria-label*="bcc" i]',
      '[contenteditable="true"][aria-label*="bcc" i]',
      '[contenteditable="true"][title*="bcc" i]'
    ]

    for (const doc of allDocuments()) {
      for (const selector of selectors) {
        const visible = Array.from(doc.querySelectorAll(selector)).find(isVisible)
        if (visible) return visible
      }

      const labels = Array.from(doc.querySelectorAll('label,td,span,div'))
        .filter((element) =>
          isVisible(element) &&
          /^Bcc\.{0,3}:?$/i.test(elementText(element))
        )

      for (const label of labels) {
        const forId = label.getAttribute('for')

        if (forId) {
          const linked = doc.getElementById(forId)
          if (linked && isVisible(linked)) return linked
        }

        const row = label.closest('tr,div,td')
        const input = row?.querySelector('input,textarea,[contenteditable="true"]')
        if (input && isVisible(input)) return input
      }
    }

    return null
  }

  function setFieldValue (field, value) {
    field.focus()

    if ('value' in field) {
      const prototype = field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype

      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')

      if (descriptor?.set) descriptor.set.call(field, value)
      else field.value = value
    } else {
      field.textContent = value
    }

    field.dispatchEvent(new Event('input', { bubbles: true }))
    field.dispatchEvent(new Event('change', { bubbles: true }))

    field.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true
    }))

    field.dispatchEvent(new KeyboardEvent('keyup', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true
    }))

    field.blur()
  }

  function fieldText (field) {
    return String(
      field?.value ||
      field?.textContent ||
      field?.innerText ||
      ''
    ).toLowerCase()
  }

  async function revealBcc () {
    let field = findBccField()
    if (field) return field

    const options = findOptionsButton()
    if (!options) return null

    clickElement(options)

    const checkbox = await waitFor(findShowBccCheckbox, 3000)
    if (!checkbox) return null

    if (!checkbox.checked) {
      clickElement(checkbox)
      await sleep(250)
    }

    const ok = await waitFor(findOptionsOkButton, 2500)
    if (!ok) return null

    clickElement(ok)

    field = await waitFor(findBccField, 4000)
    return field
  }

  async function prepareBcc () {
    const status = document.querySelector('#spfm-bcc-status')
    if (status) status.textContent = 'Preparando automaticamente...'

    const field = await revealBcc()

    if (!field) {
      if (status) status.textContent = 'Não localizei o campo Bcc'
      return false
    }

    if (!fieldText(field).includes(BCC_EMAIL)) {
      setFieldValue(field, BCC_EMAIL)
      await sleep(600)
    }

    const filled = fieldText(field).includes(BCC_EMAIL)
    if (status) {
      status.textContent = filled
        ? 'Bcc preenchido automaticamente'
        : 'Bcc inserido — confirme no campo'
    }
    return filled
  }

  function escapeHtml (value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  function findMessageBodyEditor () {
    const candidates = []

    for (const doc of allDocuments()) {
      const elements = Array.from(doc.querySelectorAll('[contenteditable="true"], body[contenteditable="true"]'))

      if (doc.designMode?.toLowerCase() === 'on' && doc.body) elements.push(doc.body)

      for (const element of elements) {
        if (!isVisible(element)) continue
        if (element.closest?.('#sei-protocolistas-fast-mail-status')) continue
        if (element.matches?.('input,textarea')) continue

        const rect = element.getBoundingClientRect()
        const area = rect.width * rect.height
        if (area < 12000) continue

        const label = `${element.getAttribute?.('aria-label') || ''} ${element.getAttribute?.('title') || ''}`
        if (/assunto|subject|bcc|cc|destinat|recipient/i.test(label)) continue

        candidates.push({ element, score: area + (element.innerText?.length || 0) })
      }
    }

    candidates.sort((a, b) => b.score - a.score)
    return candidates[0]?.element || null
  }

  function selectedMissingDocuments () {
    const procedureId = document.querySelector('#spfm-procedure')?.value || ''
    const availableDocuments = missingDocumentsForProcedure(procedureId)

    return Array.from(document.querySelectorAll('.spfm-missing-doc:checked'))
      .map((checkbox) => availableDocuments.find((item) => item.id === checkbox.value))
      .filter(Boolean)
  }

  function buildMissingDocumentsRequirementHtml (name, procedureLabel, documents) {
    const safeName = escapeHtml(cleanValue(name))
    const safeProcedureLabel = escapeHtml(cleanValue(procedureLabel))
    const operatorSignature = currentOperator?.number
      ? `Protocolista nº ${escapeHtml(currentOperator.number)} — SEI-RJ`
      : 'Serviço de Protocolo — DETRAN-RJ'
    const items = documents
      .map((item) => `<li style="margin:0 0 7px 0;">${escapeHtml(item.text)}</li>`)
      .join('')

    const links = documents
      .filter((item) => item.link)
      .map((item) => {
        const intro = item.linkIntro
          ? `<p style="margin:12px 0 4px 0;">${escapeHtml(item.linkIntro)}</p>`
          : '<p style="margin:12px 0 4px 0;">O formulário está disponível no link abaixo:</p>'
        return `${intro}<p style="margin:0 0 8px 0;"><a href="${escapeHtml(item.link)}">${escapeHtml(item.linkLabel)}</a></p>`
      })
      .join('')

    return `
      <div data-sei-protocolistas="missing-documents-requirement" style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#000;">
        <p style="margin:0 0 14px 0;">Olá, ${safeName}.</p>
        <p style="margin:0 0 12px 0;">Após a análise da documentação encaminhada, identificamos a necessidade do envio dos seguintes documentos para dar continuidade à solicitação de ${safeProcedureLabel}:</p>
        <ul style="margin:0 0 14px 22px;padding:0;">${items}</ul>
        ${links}
        <div style="margin:16px 0 0 0;padding:12px 14px;background:#f6f7f9;border:1px solid #c9ced6;border-left:4px solid #7a8491;border-radius:4px;color:#1f1f1f;">
          <p style="margin:0 0 7px 0;font-weight:700;">ATENÇÃO</p>
          <p style="margin:0 0 7px 0;">Para prosseguirmos com o atendimento, responda a esta mesma mensagem e reenvie, em um único e-mail, <strong>todos os documentos necessários, inclusive aqueles que já foram enviados anteriormente</strong>.</p>
          <p style="margin:0;"><strong>O envio apenas dos documentos indicados como faltantes não será suficiente para a continuidade da solicitação.</strong></p>
        </div>
        <p style="margin:12px 0 0 0;">Não altere o assunto desta mensagem e não encaminhe um novo e-mail para a mesma solicitação.</p>
        <p style="margin:18px 0 0 0;">Atenciosamente,<br><br>${operatorSignature}</p>
      </div>`
  }

  function insertRequirementIntoBody (editor, responseHtml) {
    if (editor.querySelector?.('[data-sei-protocolistas="missing-documents-requirement"]')) {
      throw new Error('A exigência já foi inserida nesta resposta.')
    }

    insertResponseBeforeHistory(editor, responseHtml)
  }

  function insertResponseBeforeHistory (editor, responseHtml) {
    const oldHtml = editor.innerHTML || ''
    const separator = `<div data-sei-protocolistas="history-separator" style="margin:22px 0 14px 0;padding-top:10px;border-top:1px solid #a7a7a7;color:#666;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:.04em;">${HISTORY_SEPARATOR}</div>`

    editor.focus()
    editor.innerHTML = `${responseHtml}${separator}${oldHtml}`
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    editor.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function renderMissingDocumentsOptions () {
    const list = document.querySelector('#spfm-missing-options')
    const procedureId = document.querySelector('#spfm-procedure')?.value || ''
    if (!list) return

    list.innerHTML = missingDocumentsForProcedure(procedureId)
      .map((item) => `
        <label class="spfm-check">
          <input class="spfm-missing-doc" type="checkbox" value="${item.id}">
          <span>${item.label}</span>
        </label>`)
      .join('')
  }

  function updateMissingDocumentsVisibility () {
    const box = document.querySelector('#spfm-missing-box')
    const procedure = document.querySelector('#spfm-procedure')
    const list = document.querySelector('#spfm-missing-list')
    if (!box || !procedure) return

    const documents = missingDocumentsForProcedure(procedure.value)
    const hasDocumentModel = documents.length > 0
    box.hidden = !hasDocumentModel

    if (!hasDocumentModel) {
      if (list) list.hidden = true
      return
    }

    renderMissingDocumentsOptions()
  }

  function toggleMissingDocuments () {
    const list = document.querySelector('#spfm-missing-list')
    if (!list) return
    list.hidden = !list.hidden
  }

  async function insertMissingDocumentsRequirement () {
    const status = document.querySelector('#spfm-body-status')

    try {
      const procedureId = document.querySelector('#spfm-procedure')?.value || ''
      const processType = catalogProcesses.find((item) => item.id === procedureId)
      if (!processType) throw new Error('Selecione o procedimento.')

      const name = cleanValue(document.querySelector('#spfm-requester-name')?.value)
      if (!name) throw new Error('Digite o nome do requerente.')

      const documents = selectedMissingDocuments()
      if (!documents.length) throw new Error('Marque pelo menos um documento faltante.')

      const editor = findMessageBodyEditor()
      if (!editor) throw new Error('Não localizei o corpo editável do e-mail.')

      await savePanelAttendance()
      insertRequirementIntoBody(
        editor,
        buildMissingDocumentsRequirementHtml(
          name,
          String(processType.name || '').toLowerCase(),
          documents
        )
      )
      if (status) status.textContent = 'Exigência inserida com sucesso.'
    } catch (error) {
      if (status) status.textContent = error.message || 'Não foi possível inserir a exigência'
    }
  }

  function buildProcessCompletedResponseHtml (payload) {
    const name = escapeHtml(cleanValue(payload?.requerente) || 'requerente')
    const processNumber = escapeHtml(cleanValue(payload?.numero))
    const processType = escapeHtml(cleanValue(payload?.tipo))
    const destination = escapeHtml(cleanValue(payload?.destino))

    return `
      <div data-sei-protocolistas="process-completed-response" style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#000;">
        <p style="margin:0 0 14px 0;">Olá, ${name}.</p>
        <p style="margin:0 0 14px 0;">Informamos que sua solicitação foi protocolada e encaminhada para análise.</p>
        <p style="margin:0 0 6px 0;"><strong>Número do processo:</strong> ${processNumber || 'Não identificado'}</p>
        <p style="margin:0 0 6px 0;"><strong>Tipo de processo:</strong> ${processType || 'Não identificado'}</p>
        <p style="margin:0 0 14px 0;"><strong>Unidade de destino:</strong> ${destination || 'Não identificada'}</p>
        <p style="margin:0 0 14px 0;">O atendimento por e-mail foi concluído. Guarde o número do processo para futuras consultas.</p>
        <p style="margin:18px 0 0 0;">Atenciosamente,<br><br>Serviço de Protocolo<br>DETRAN-RJ</p>
      </div>`
  }

  function insertProcessCompletedResponse (editor, responseHtml) {
    if (editor.querySelector?.('[data-sei-protocolistas="process-completed-response"]')) {
      throw new Error('A resposta do processo já foi inserida neste e-mail.')
    }

    const oldHtml = editor.innerHTML || ''
    const separator = `<div data-sei-protocolistas="history-separator" style="margin:22px 0 14px 0;padding-top:10px;border-top:1px solid #a7a7a7;color:#666;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:.04em;">${HISTORY_SEPARATOR}</div>`

    editor.focus()
    editor.innerHTML = `${responseHtml}${separator}${oldHtml}`
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    editor.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function shortDestinationForSubject (value) {
    const destination = cleanValue(value).toUpperCase()
    if (!destination) return ''

    const slashParts = destination.split('/').map((part) => cleanValue(part)).filter(Boolean)
    const lastSlashPart = slashParts[slashParts.length - 1] || destination

    const tokens = lastSlashPart
      .split(/[\s\-–—>]+/)
      .map((part) => cleanValue(part))
      .filter(Boolean)

    const acronym = tokens.find((part) => /^[A-Z]{2,10}$/.test(part))
    if (acronym) return acronym

    const directMatch = destination.match(/\b([A-Z]{2,10})\b(?=\s*$)/)
    return directMatch?.[1] || lastSlashPart
  }

  function compactDateForSubject (value) {
    const raw = cleanValue(value)

    const direct = raw.match(/\b(\d{2})[/.-](\d{2})[/.-](\d{4})\b/)
    if (direct) return `${direct[1]}${direct[2]}${direct[3]}`

    const now = new Date()
    return [
      String(now.getDate()).padStart(2, '0'),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getFullYear())
    ].join('')
  }

  function finalSubjectSequence (currentSubject, payload) {
    const existing = cleanValue(currentSubject).match(/\b(\d{8})(\d{1,4})\b/)
    if (existing) return `${existing[1]}${existing[2]}`

    const date = compactDateForSubject(payload?.data)
    const operatorNumber = currentOperator?.number || ''
    return `${date}${operatorNumber}`
  }

  function finalizeSubjectWithProcessResult (payload) {
    const field = findSubjectField()
    if (!field) return false

    const currentSubject = cleanValue(field.value || field.textContent)
    const prefix = getSubjectPrefix(currentSubject) || 'RE: '
    const name = cleanValue(payload?.requerente).toUpperCase() ||
      cleanValue(document.querySelector('#spfm-requester-name')?.value).toUpperCase()
    const destination = shortDestinationForSubject(payload?.destino)
    const sequence = finalSubjectSequence(currentSubject, payload)

    if (!name || !destination || !sequence) return false

    const updatedSubject = `${prefix}${name} - ${destination} - ${sequence} - FECHADO`
    setFieldValue(field, updatedSubject)
    return true
  }

  async function pendingProcessResult () {
    const stored = await storageGet(EMAIL_RESULT_KEY)
    const payload = stored[EMAIL_RESULT_KEY]
    if (!payload) return null

    if (!payload.expiresAt || Date.now() > payload.expiresAt) {
      await storageRemove(EMAIL_RESULT_KEY)
      return null
    }

    const senderEmail = findSenderEmail()
    if (!senderEmail || normalizeEmail(payload.email) !== normalizeEmail(senderEmail)) {
      return null
    }

    return payload
  }

  async function updateProcessResponseButton () {
    const box = document.querySelector('#spfm-process-response-box')
    const button = document.querySelector('#spfm-insert-process-response')
    const status = document.querySelector('#spfm-process-response-status')
    if (!box || !button) return

    try {
      const payload = await pendingProcessResult()
      box.hidden = !payload

      if (!payload) {
        button.disabled = false
        button.textContent = 'INSERIR RESPOSTA DO PROCESSO'
        if (status) status.textContent = ''
        return
      }

      button.dataset.processNumber = cleanValue(payload.numero)
      button.textContent = payload.numero
        ? `PROCESSO ${payload.numero} — INSERIR RESPOSTA`
        : 'PROCESSO CRIADO — INSERIR RESPOSTA'
      if (status) status.textContent = 'Dados recebidos do SEI e prontos para este e-mail.'
    } catch (error) {
      console.error('[SEI Protocolistas] Falha ao verificar resposta pendente:', error)
      box.hidden = true
    }
  }

  function renderAttendanceCompletedState (payload) {
    const openButton = document.querySelector('#spfm-open-process')
    const triageButton = document.querySelector('#spfm-triagem')
    const routeStatus = document.querySelector('#spfm-route-status')
    const area = document.querySelector('#spfm-area')
    const objective = document.querySelector('#spfm-objective')
    const procedure = document.querySelector('#spfm-procedure')
    const destination = document.querySelector('#spfm-destination')
    const destinationField = document.querySelector('#spfm-destination-field')
    const missingBox = document.querySelector('#spfm-missing-box')

    if (openButton) openButton.hidden = true
    if (triageButton) triageButton.hidden = true
    if (missingBox) missingBox.hidden = true

    if (destinationField) destinationField.hidden = false
    if (destination && payload?.destino) destination.value = cleanValue(payload.destino)

    if (area) area.disabled = true
    if (objective) objective.disabled = true
    if (procedure) procedure.disabled = true
    if (destination) destination.disabled = true

    if (routeStatus) {
      routeStatus.textContent = payload?.numero
        ? `ATENDIMENTO CONCLUÍDO — PROCESSO ${cleanValue(payload.numero)}`
        : 'ATENDIMENTO CONCLUÍDO'
    }
  }

  async function insertPendingProcessResponse (automatic = false) {
    if (automatic && processResultAutofillRunning) return

    const button = document.querySelector('#spfm-insert-process-response')
    const status = document.querySelector('#spfm-process-response-status')
    const originalText = button?.textContent || 'INSERIR RESPOSTA DO PROCESSO'

    if (automatic) processResultAutofillRunning = true

    if (button) {
      button.disabled = true
      button.textContent = 'INSERINDO...'
    }

    try {
      const payload = await pendingProcessResult()
      if (!payload) throw new Error('Não há dados de processo para este e-mail.')

      const editor = automatic
        ? await waitFor(findMessageBodyEditor, 7000)
        : findMessageBodyEditor()
      if (!editor) throw new Error('Não localizei o corpo editável do e-mail.')

      if (automatic) {
        const subjectField = await waitFor(findSubjectField, 7000)
        if (!subjectField) throw new Error('Não localizei o assunto editável do e-mail.')
      }

      if (!finalizeSubjectWithProcessResult(payload)) {
        throw new Error('Não foi possível atualizar automaticamente o assunto do e-mail.')
      }

      if (!editor.querySelector?.('[data-sei-protocolistas="process-completed-response"]')) {
        insertProcessCompletedResponse(
          editor,
          buildProcessCompletedResponseHtml(payload)
        )
      }

      renderAttendanceCompletedState(payload)

      await storageRemove(EMAIL_RESULT_KEY)

      const box = document.querySelector('#spfm-process-response-box')
      if (status) status.textContent = 'Resposta do processo inserida com sucesso.'
      if (button) button.textContent = 'RESPOSTA INSERIDA'
      window.setTimeout(() => {
        if (box) box.hidden = true
      }, 1600)
    } catch (error) {
      if (status) status.textContent = error.message || 'Não foi possível inserir a resposta.'
      if (button) {
        button.disabled = false
        button.textContent = originalText
      }
    } finally {
      if (automatic) processResultAutofillRunning = false
    }
  }

  async function autoInsertPendingProcessResponse () {
    const payload = await pendingProcessResult()
    if (!payload) return

    await updateProcessResponseButton()
    await insertPendingProcessResponse(true)
  }

  function cleanValue (value) {
    return String(value || '').replace(/\s+/g, ' ').trim()
  }

  function formatCpf (value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 11)
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2')
  }

  async function loadCatalog () {
    try {
      const response = await fetch(api.runtime.getURL(CATALOG_PATH))
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload = await response.json()
      catalogProcesses = Array.isArray(payload.processTypes) ? payload.processTypes : []
      priorityTopics = Array.isArray(payload.fastMailPriorityTopics) ? payload.fastMailPriorityTopics : []
      catalogNavigation = payload.fastMailNavigation && Array.isArray(payload.fastMailNavigation.areas)
        ? payload.fastMailNavigation
        : { areas: [] }
      renderProcedureOptions()
      renderAreaOptions()
      renderPriorityTopics()
    } catch (error) {
      console.error('[SEI Protocolistas] Falha ao carregar catálogo no FAST MAIL:', error)
      const select = document.querySelector('#spfm-procedure')
      if (select) select.innerHTML = '<option value="">Catálogo indisponível</option>'
    }
  }

  function normalizeSearchText (value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  }

  function scriptSearchText (script) {
    if (!script._searchText) {
      script._searchText = normalizeSearchText([
        script.title,
        script.phaseLabel,
        script.group,
        script.body
      ].join(' '))
    }
    return script._searchText
  }

  function filteredResponseScripts () {
    const phase = document.querySelector('#spfm-script-phase')?.value || ''
    const query = normalizeSearchText(document.querySelector('#spfm-script-search')?.value)
    const terms = query.split(' ').filter(Boolean)

    return responseScripts.filter((script) => {
      if (!script.body) return false
      if (phase && script.phase !== phase) return false
      const haystack = scriptSearchText(script)
      return terms.every((term) => haystack.includes(term))
    })
  }

  function selectedResponseScript () {
    const scriptId = document.querySelector('#spfm-script-result')?.value || ''
    return responseScripts.find((script) => script.id === scriptId) || null
  }

  function renderSelectedResponseScript () {
    const script = selectedResponseScript()
    const preview = document.querySelector('#spfm-script-preview')
    const insertButton = document.querySelector('#spfm-insert-script')
    if (!preview || !insertButton) return

    preview.textContent = script
      ? `${script.phaseLabel} › ${script.group}\n${script.title}`
      : 'Selecione um resultado para conferir.'
    insertButton.disabled = !script
  }

  function renderResponseScriptResults () {
    const select = document.querySelector('#spfm-script-result')
    const count = document.querySelector('#spfm-script-count')
    if (!select) return

    const currentValue = select.value
    const matches = filteredResponseScripts()
    const visibleMatches = matches.slice(0, 60)

    select.innerHTML = '<option value="">Selecione o script</option>'
    visibleMatches.forEach((script) => {
      const option = document.createElement('option')
      option.value = script.id
      option.textContent = `${script.title} — ${script.group}`
      select.appendChild(option)
    })

    if (visibleMatches.some((script) => script.id === currentValue)) {
      select.value = currentValue
    }

    if (count) {
      count.textContent = matches.length > visibleMatches.length
        ? `${matches.length} encontrados — refine a busca para ver todos`
        : `${matches.length} script${matches.length === 1 ? '' : 's'} encontrado${matches.length === 1 ? '' : 's'}`
    }
    renderSelectedResponseScript()
  }

  function renderResponseScriptPhases () {
    const select = document.querySelector('#spfm-script-phase')
    if (!select) return

    select.innerHTML = '<option value="">Todas as fases</option>'
    responseScriptPhases.forEach((phase) => {
      const option = document.createElement('option')
      option.value = phase.id
      option.textContent = phase.label
      select.appendChild(option)
    })
    select.value = responseScriptPhases.some((phase) => phase.id === 'orientacao')
      ? 'orientacao'
      : ''
  }

  async function loadResponseScriptCatalog () {
    const status = document.querySelector('#spfm-script-status')
    try {
      const response = await fetch(api.runtime.getURL(SCRIPT_CATALOG_PATH))
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload = await response.json()
      responseScripts = Array.isArray(payload.scripts) ? payload.scripts : []
      responseScriptPhases = Array.isArray(payload.phases) ? payload.phases : []
      renderResponseScriptPhases()
      renderResponseScriptResults()
      const available = responseScripts.filter((script) => script.body).length
      const empty = responseScripts.length - available
      if (status) {
        status.textContent = empty
          ? `${available} respostas disponíveis; ${empty} cartão sem conteúdo.`
          : `${available} respostas disponíveis.`
      }
    } catch (error) {
      console.error('[SEI Protocolistas] Falha ao carregar scripts:', error)
      if (status) status.textContent = 'Catálogo de scripts indisponível.'
    }
  }

  function formatScriptLine (line) {
    const links = []
    let tokenized = String(line || '').replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)|(https?:\/\/[^\s<>]+)/g,
      (match, label, markdownUrl, bareUrl) => {
        const url = markdownUrl || bareUrl
        const text = label || bareUrl
        const token = `SPFMLINKTOKEN${links.length}END`
        links.push({ token, url, text })
        return token
      }
    )

    tokenized = tokenized.replace(/^\s*#{1,6}\s*/, '')
    let html = escapeHtml(tokenized)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

    links.forEach((link) => {
      html = html.replace(
        link.token,
        `<a href="${escapeHtml(link.url)}">${escapeHtml(link.text)}</a>`
      )
    })
    return html
  }

  function buildCatalogScriptHtml (script) {
    const body = String(script.body || '')
      .split(/\r?\n/)
      .map(formatScriptLine)
      .join('<br>')

    return `
      <div data-sei-protocolistas="catalog-script" data-script-id="${escapeHtml(script.id)}" style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#000;">
        ${body}
      </div>`
  }

  async function insertResponseScript (script, status = document.querySelector('#spfm-script-status')) {
    try {
      if (!script) throw new Error('Selecione um script.')

      const editor = findMessageBodyEditor()
      if (!editor) throw new Error('Não localizei o corpo editável do e-mail.')
      if (editor.querySelector?.('[data-sei-protocolistas="catalog-script"]')) {
        throw new Error('Já existe um script inserido nesta resposta.')
      }

      insertResponseBeforeHistory(editor, buildCatalogScriptHtml(script))
      if (status) status.textContent = `Script inserido: ${script.title}`
    } catch (error) {
      if (status) status.textContent = error.message || 'Não foi possível inserir o script.'
    }
  }

  async function insertSelectedResponseScript () {
    await insertResponseScript(selectedResponseScript())
  }

  function toggleResponseScriptCatalog () {
    const catalog = document.querySelector('#spfm-script-catalog')
    const button = document.querySelector('#spfm-script-toggle')
    if (!catalog || !button) return

    catalog.hidden = !catalog.hidden
    button.textContent = catalog.hidden ? 'BUSCAR SCRIPT' : 'FECHAR SCRIPTS'
    if (!catalog.hidden) document.querySelector('#spfm-script-search')?.focus()
  }

  function selectedPriorityTopic () {
    const selected = document.querySelector('.spfm-topic-button.is-active')
    return priorityTopics.find((topic) => topic.id === selected?.dataset.topicId) || null
  }

  function selectedPriorityVariant (topic) {
    const variantId = document.querySelector('#spfm-topic-variant')?.value || ''
    return topic?.variants?.find((variant) => variant.id === variantId) || null
  }

  function selectedPriorityRoute () {
    const topic = selectedPriorityTopic()
    const variant = selectedPriorityVariant(topic)
    if (!topic) return null

    return {
      ...topic,
      ...(variant || {}),
      topicId: topic.id,
      topicLabel: topic.label,
      variantLabel: variant?.label || ''
    }
  }

  function renderPriorityRoute () {
    const topic = selectedPriorityTopic()
    const variantField = document.querySelector('#spfm-topic-variant-field')
    const variantSelect = document.querySelector('#spfm-topic-variant')
    const replyButton = document.querySelector('#spfm-priority-reply')
    const openButton = document.querySelector('#spfm-priority-open')
    const status = document.querySelector('#spfm-priority-status')
    if (!variantField || !variantSelect || !replyButton || !openButton || !status) return

    const currentVariant = variantSelect.value
    const variants = Array.isArray(topic?.variants) ? topic.variants : []
    variantSelect.innerHTML = ''
    variants.forEach((variant) => {
      const option = document.createElement('option')
      option.value = variant.id
      option.textContent = variant.label
      variantSelect.appendChild(option)
    })
    if (variants.some((variant) => variant.id === currentVariant)) {
      variantSelect.value = currentVariant
    }
    variantField.hidden = variants.length === 0

    const route = selectedPriorityRoute()
    replyButton.disabled = !route?.scriptId
    openButton.disabled = !route?.canOpenProcess || !route?.processId
    status.textContent = !route
      ? 'Escolha o assunto do e-mail.'
      : route.canOpenProcess
        ? 'Documentação incompleta: responder. Documentação completa: abrir no FAST PROC.'
        : route.blockedReason || 'Este atendimento deve ser respondido por e-mail.'

    if (route?.processId) syncRouteWithProcedure(route.processId)
    else syncRouteWithProcedure('')
  }

  function selectPriorityTopic (topicId) {
    document.querySelectorAll('.spfm-topic-button').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.topicId === topicId)
    })
    renderPriorityRoute()
  }

  function renderPriorityTopics () {
    const container = document.querySelector('#spfm-priority-topics')
    if (!container) return

    container.innerHTML = ''
    priorityTopics.forEach((topic) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'spfm-topic-button'
      button.dataset.topicId = topic.id
      button.textContent = topic.label
      button.addEventListener('click', () => selectPriorityTopic(topic.id))
      container.appendChild(button)
    })
    renderPriorityRoute()
  }

  function openPriorityResponses () {
    const route = selectedPriorityRoute()
    const catalog = document.querySelector('#spfm-script-catalog')
    const toggleButton = document.querySelector('#spfm-script-toggle')
    const phase = document.querySelector('#spfm-script-phase')
    const search = document.querySelector('#spfm-script-search')
    const result = document.querySelector('#spfm-script-result')
    const status = document.querySelector('#spfm-priority-status')
    if (!route || !catalog || !toggleButton || !phase || !search || !result) {
      if (status) status.textContent = 'Escolha primeiro o assunto do e-mail.'
      return
    }

    catalog.hidden = false
    toggleButton.textContent = 'FECHAR RESPOSTAS'
    phase.value = ''
    search.value = route.searchQuery || route.topicLabel || ''
    renderResponseScriptResults()

    const mappedScriptAvailable = Array.from(result.options).some((option) => option.value === route.scriptId)
    if (mappedScriptAvailable) result.value = route.scriptId
    renderSelectedResponseScript()
    if (status) status.textContent = 'Escolha a fase e confira a resposta antes de inserir.'
    catalog.scrollIntoView?.({ block: 'nearest' })
  }

  async function openPriorityProcess () {
    const route = selectedPriorityRoute()
    const button = document.querySelector('#spfm-priority-open')
    const status = document.querySelector('#spfm-priority-status')
    if (!route?.canOpenProcess || !route?.processId) {
      if (status) status.textContent = route?.blockedReason || 'Este atendimento não admite abertura por e-mail.'
      return
    }

    syncRouteWithProcedure(route.processId)
    await openProcessInSei(button)
  }

  function renderProcedureOptions (processIds = null) {
    const select = document.querySelector('#spfm-procedure')
    if (!select) return

    const currentValue = select.value
    const allowedIds = Array.isArray(processIds) ? new Set(processIds) : null
    const availableProcesses = allowedIds
      ? catalogProcesses.filter((item) => allowedIds.has(item.id))
      : catalogProcesses

    select.innerHTML = '<option value="">Selecione o procedimento</option>'

    availableProcesses.forEach((processType) => {
      const option = document.createElement('option')
      option.value = processType.id
      option.textContent = `${processType.name} — ${processType.destinationUnit}`
      select.appendChild(option)
    })

    if (availableProcesses.some((item) => item.id === currentValue)) {
      select.value = currentValue
    }
  }

  function ensureProcedureOption (procedureId) {
    const select = document.querySelector('#spfm-procedure')
    if (!select || !procedureId) return

    const hasOption = Array.from(select.options).some((option) => option.value === procedureId)
    if (!hasOption) renderProcedureOptions([procedureId])
  }

  function routeAreaById (areaId) {
    return catalogNavigation.areas.find((area) => area.id === areaId) || null
  }

  function renderAreaOptions () {
    const area = document.querySelector('#spfm-area')
    if (!area) return

    const currentValue = area.value
    area.innerHTML = '<option value="">Selecione a área</option>'

    catalogNavigation.areas.forEach((item) => {
      const option = document.createElement('option')
      option.value = item.id
      option.textContent = item.label
      area.appendChild(option)
    })

    if (catalogNavigation.areas.some((item) => item.id === currentValue)) {
      area.value = currentValue
    }
  }

  function renderObjectiveOptions (areaConfig) {
    const field = document.querySelector('#spfm-objective-field')
    const objective = document.querySelector('#spfm-objective')
    if (!field || !objective) return

    const objectives = Array.isArray(areaConfig?.objectives)
      ? areaConfig.objectives
      : []

    objective.innerHTML = '<option value="">O que o cidadão deseja?</option>'
    objectives.forEach((item) => {
      const option = document.createElement('option')
      option.value = item.id
      option.textContent = item.label
      objective.appendChild(option)
    })

    field.hidden = objectives.length === 0
  }

  function selectedDestination () {
    const procedureId = document.querySelector('#spfm-procedure')?.value || ''
    const processType = processTypeById(procedureId)
    const manualDestination = cleanValue(document.querySelector('#spfm-destination')?.value)
    return manualDestination || processType?.destinationUnit || ''
  }

  function updateDestinationField (useProcedureDefault = true) {
    const field = document.querySelector('#spfm-destination-field')
    const input = document.querySelector('#spfm-destination')
    const procedureId = document.querySelector('#spfm-procedure')?.value || ''
    const processType = processTypeById(procedureId)
    if (!field || !input) return

    field.hidden = !processType

    if (!processType) {
      input.value = ''
      return
    }

    if (useProcedureDefault || !cleanValue(input.value)) {
      input.value = processType.destinationUnit || ''
    }
  }

  function renderSelectedProcedure () {
    const status = document.querySelector('#spfm-route-status')
    const procedureId = document.querySelector('#spfm-procedure')?.value || ''
    const processType = processTypeById(procedureId)

    if (!status) return

    status.textContent = processType
      ? `${processType.name} → ${selectedDestination() || 'destino a confirmar'}`
      : 'Escolha uma das áreas principais.'
  }

  function applyProcedureSelection (procedureId) {
    const select = document.querySelector('#spfm-procedure')
    if (!select) return

    ensureProcedureOption(procedureId)
    select.value = catalogProcesses.some((item) => item.id === procedureId)
      ? procedureId
      : ''

    const missingList = document.querySelector('#spfm-missing-list')
    const bodyStatus = document.querySelector('#spfm-body-status')
    if (missingList) missingList.hidden = true
    if (bodyStatus) bodyStatus.textContent = ''

    updateDestinationField(true)
    renderSelectedProcedure()
    updateMissingDocumentsVisibility()
  }

  function configureAreaRoute (areaId) {
    const areaConfig = routeAreaById(areaId)
    const objectiveField = document.querySelector('#spfm-objective-field')
    const objective = document.querySelector('#spfm-objective')
    const procedureField = document.querySelector('#spfm-procedure-field')

    if (objective) objective.value = ''
    if (objectiveField) objectiveField.hidden = true
    if (procedureField) procedureField.hidden = true

    applyProcedureSelection('')

    if (!areaConfig) return

    if (areaConfig.processId) {
      applyProcedureSelection(areaConfig.processId)
      return
    }

    if (Array.isArray(areaConfig.objectives) && areaConfig.objectives.length) {
      renderObjectiveOptions(areaConfig)
      return
    }

    if (areaConfig.manualSelection && procedureField) {
      renderProcedureOptions(areaConfig.processIds)
      procedureField.hidden = false
      renderSelectedProcedure()
    }
  }

  function handleObjectiveChange () {
    const areaId = document.querySelector('#spfm-area')?.value || ''
    const objectiveId = document.querySelector('#spfm-objective')?.value || ''
    const areaConfig = routeAreaById(areaId)
    const objective = areaConfig?.objectives?.find((item) => item.id === objectiveId)

    applyProcedureSelection(objective?.processId || '')
  }

  function syncRouteWithProcedure (procedureId) {
    const area = document.querySelector('#spfm-area')
    const objective = document.querySelector('#spfm-objective')
    const procedureField = document.querySelector('#spfm-procedure-field')
    if (!area) return

    for (const areaConfig of catalogNavigation.areas) {
      if (areaConfig.processId === procedureId) {
        area.value = areaConfig.id
        configureAreaRoute(areaConfig.id)
        return
      }

      const objectiveConfig = areaConfig.objectives?.find((item) => item.processId === procedureId)
      if (objectiveConfig) {
        area.value = areaConfig.id
        renderObjectiveOptions(areaConfig)
        if (objective) objective.value = objectiveConfig.id
        if (procedureField) procedureField.hidden = true
        applyProcedureSelection(procedureId)
        return
      }
    }

    const manualArea = catalogNavigation.areas.find((item) =>
      item.manualSelection && Array.isArray(item.processIds) && item.processIds.includes(procedureId)
    )
    if (manualArea && procedureId) {
      area.value = manualArea.id
      configureAreaRoute(manualArea.id)
      if (procedureField) procedureField.hidden = false
      applyProcedureSelection(procedureId)
      return
    }

    area.value = ''
    configureAreaRoute('')
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

      const labels = Array.from(doc.querySelectorAll('label,td,span,div'))
        .filter((element) => isVisible(element) && /^Assunto:?$/i.test(elementText(element)))

      for (const label of labels) {
        const row = label.closest('tr,div,td')
        const field = row?.querySelector('input,textarea')
        if (field && isVisible(field)) return field
      }
    }

    return null
  }

  function getSubjectPrefix (subject) {
    const match = cleanValue(subject).match(/^((?:RE|ENC|FW|FWD)\s*:\s*)+/i)
    return match ? match[0].replace(/\s+/g, ' ').trim() + ' ' : ''
  }

  function buildTriagemSubject () {
    const name = cleanValue(document.querySelector('#spfm-requester-name')?.value).toUpperCase()
    const destination = selectedDestination() || 'UNDEFINED'

    if (!name) throw new Error('Digite o nome do requerente.')
    if (!currentOperator?.number) throw new Error('Operador não identificado.')

    const now = new Date()
    const date = [
      String(now.getDate()).padStart(2, '0'),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getFullYear())
    ].join('')

    return `${name} - ${destination} - ${date}${currentOperator.number} - TRIAGEM`
  }

  async function savePanelAttendance () {
    const name = cleanValue(document.querySelector('#spfm-requester-name')?.value)
    const cpf = String(document.querySelector('#spfm-requester-cpf')?.value || '').replace(/\D/g, '')
    const procedureId = document.querySelector('#spfm-procedure')?.value || ''
    const destination = selectedDestination()
    const stored = await storageGet(ATTENDANCE_KEY)
    const current = stored[ATTENDANCE_KEY] || {}

    await storageSet({
      [ATTENDANCE_KEY]: {
        ...current,
        name,
        cpf,
        procedureId,
        destination,
        updatedAt: Date.now()
      }
    })
  }

  async function loadPanelAttendance () {
    const stored = await storageGet(ATTENDANCE_KEY)
    const current = stored[ATTENDANCE_KEY] || {}
    const name = document.querySelector('#spfm-requester-name')
    const cpf = document.querySelector('#spfm-requester-cpf')
    const procedure = document.querySelector('#spfm-procedure')
    const destination = document.querySelector('#spfm-destination')

    if (name && !name.value) name.value = current.name || ''
    if (cpf && !cpf.value) cpf.value = formatCpf(current.cpf || '')
    if (procedure && current.procedureId) {
      procedure.value = current.procedureId
      syncRouteWithProcedure(current.procedureId)
      if (destination && current.destination) destination.value = current.destination
      updateDestinationField(false)
      renderSelectedProcedure()
    } else {
      syncRouteWithProcedure('')
    }
  }

  async function openProcessInSei (buttonOverride = null) {
    const button = buttonOverride || document.querySelector('#spfm-open-process')
    const originalText = button?.textContent || 'ABRIR PROCESSO'

    if (button) {
      button.disabled = true
      button.textContent = 'ABRINDO SEI...'
    }

    try {
      const email = findSenderEmail()
      if (!email) {
        throw new Error('Não identifiquei o e-mail do remetente.')
      }

      const name = cleanValue(document.querySelector('#spfm-requester-name')?.value)
      const cpf = String(document.querySelector('#spfm-requester-cpf')?.value || '').replace(/\D/g, '')
      const procedureId = document.querySelector('#spfm-procedure')?.value || ''
      const processType = processTypeById(procedureId)
      const area = document.querySelector('#spfm-area')
      const objective = document.querySelector('#spfm-objective')
      const destination = selectedDestination()

      if (!name) throw new Error('Digite o nome do requerente.')
      if (!processType) throw new Error('Selecione o procedimento.')

      const attendanceId = globalThis.crypto?.randomUUID?.() ||
        `atendimento-${Date.now()}-${Math.random().toString(16).slice(2)}`

      const handoff = {
        attendanceId,
        source: 'fast-mail',
        mode: 'email',
        email,
        name,
        cpf,
        procedureId,
        procedureName: processType.name || '',
        seiProcessName: processType.seiNames?.[0] || processType.name || '',
        destination,
        areaId: area?.value || '',
        areaLabel: area?.selectedOptions?.[0]?.textContent || '',
        objectiveId: objective?.value || '',
        objectiveLabel: objective?.selectedOptions?.[0]?.textContent || '',
        operator: currentOperator
          ? {
              number: currentOperator.number,
              email: currentOperator.email,
              source: currentOperator.source
            }
          : null,
        createdAt: Date.now(),
        expiresAt: Date.now() + (15 * 60 * 1000)
      }

      const seiWindow = window.open('about:blank', '_blank')
      if (!seiWindow) throw new Error('Autorize pop-ups para abrir o SEI.')

      try {
        await storageSet({
          [FAST_PROC_HANDOFF_KEY]: handoff,
          [ATTENDANCE_KEY]: {
            ...handoff,
            updatedAt: Date.now()
          }
        })
        await runtimeMessage({
          type: REGISTER_ORIGIN_MESSAGE,
          attendanceId,
          email,
          url: location.href,
          createdAt: handoff.createdAt,
          expiresAt: Date.now() + (60 * 60 * 1000)
        })
        seiWindow.location.replace(SEI_LOGIN_URL)
        seiWindow.opener = null
      } catch (error) {
        seiWindow.close()
        throw error
      }

      if (button) {
        button.textContent = 'SEI ABERTO — PREPARANDO FAST PROC'
      }
    } catch (error) {
      if (button) {
        button.textContent = error.message || 'ERRO AO ABRIR PROCESSO'
      }
    } finally {
      window.setTimeout(() => {
        if (button) {
          button.disabled = false
          button.textContent = originalText
        }
      }, 3500)
    }
  }

  async function prepareTriagem () {
    const button = document.querySelector('#spfm-triagem')
    const originalText = button?.textContent || 'PREPARAR TRIAGEM'

    if (button) {
      button.disabled = true
      button.textContent = 'PREPARANDO...'
    }

    try {
      await savePanelAttendance()
      await prepareBcc()

      const field = findSubjectField()
      if (!field) throw new Error('Abra a tela de resposta para editar o assunto.')

      const currentSubject = cleanValue(field.value || field.textContent)
      const procedureId = document.querySelector('#spfm-procedure')?.value || ''
      const destination = selectedDestination()

      if (/\bTRIAGEM\b/i.test(currentSubject)) {
        if (/\bUNDEFINED\b/i.test(currentSubject) && destination) {
          const updatedSubject = currentSubject.replace(/\bUNDEFINED\b/i, destination)
          setFieldValue(field, updatedSubject)
          await sleep(350)
          if (button) button.textContent = 'PROCEDIMENTO ATUALIZADO'
          return
        }

        if (button) button.textContent = 'TRIAGEM JÁ PREPARADA'
        return
      }

      const prefix = getSubjectPrefix(currentSubject)
      const subject = prefix + buildTriagemSubject()
      setFieldValue(field, subject)
      await sleep(350)

      if (button) {
        button.textContent = procedureId
          ? 'TRIAGEM PREPARADA'
          : 'TRIAGEM CRIADA COMO UNDEFINED'
      }
    } catch (error) {
      if (button) button.textContent = error.message || 'ERRO AO PREPARAR'
    } finally {
      window.setTimeout(() => {
        if (button) {
          button.disabled = false
          button.textContent = originalText
        }
      }, 2200)
    }
  }

  function makePanelMovable (panel) {
    const handle = panel.querySelector('#spfm-drag-handle')
    if (!handle) return

    const storageKey = 'seiProtocolistasFastMailPosition'
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null')

    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
      panel.style.left = `${Math.max(0, Math.min(saved.left, window.innerWidth - 80))}px`
      panel.style.top = `${Math.max(0, Math.min(saved.top, window.innerHeight - 48))}px`
      panel.style.right = 'auto'
      panel.style.bottom = 'auto'
    }

    let dragging = false
    let offsetX = 0
    let offsetY = 0

    handle.addEventListener('mousedown', (event) => {
      if (event.button !== 0 || event.target.closest('button')) return

      const rect = panel.getBoundingClientRect()
      dragging = true
      offsetX = event.clientX - rect.left
      offsetY = event.clientY - rect.top

      panel.style.left = `${rect.left}px`
      panel.style.top = `${rect.top}px`
      panel.style.right = 'auto'
      panel.style.bottom = 'auto'
      panel.classList.add('spfm-dragging')
      event.preventDefault()
    })

    document.addEventListener('mousemove', (event) => {
      if (!dragging) return

      const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth)
      const maxTop = Math.max(0, window.innerHeight - 44)
      const left = Math.max(0, Math.min(event.clientX - offsetX, maxLeft))
      const top = Math.max(0, Math.min(event.clientY - offsetY, maxTop))

      panel.style.left = `${left}px`
      panel.style.top = `${top}px`
    })

    document.addEventListener('mouseup', () => {
      if (!dragging) return
      dragging = false
      panel.classList.remove('spfm-dragging')

      const rect = panel.getBoundingClientRect()
      localStorage.setItem(storageKey, JSON.stringify({
        left: Math.round(rect.left),
        top: Math.round(rect.top)
      }))
    })
  }

  function togglePanel (panel) {
    const body = panel.querySelector('#spfm-panel-body')
    const button = panel.querySelector('#spfm-collapse')
    if (!body || !button) return

    const collapsed = !panel.classList.contains('spfm-collapsed')
    panel.classList.toggle('spfm-collapsed', collapsed)
    body.hidden = collapsed
    button.textContent = collapsed ? '+' : '−'
    button.title = collapsed ? 'Expandir FAST MAIL' : 'Recolher FAST MAIL'
  }

  function createPanel () {
    const panel = document.createElement('aside')
    panel.id = 'sei-protocolistas-fast-mail-status'

    panel.innerHTML = `
      <div id="spfm-drag-handle" class="spfm-header">
        <div>
          <div class="spfm-title">SEI PROTOCOLISTAS</div>
          <div class="spfm-subtitle">FAST MAIL</div>
        </div>
        <button id="spfm-collapse" class="spfm-icon-button" type="button" title="Recolher FAST MAIL">−</button>
      </div>

      <div id="spfm-panel-body" class="spfm-panel-body">
        <div class="spfm-summary">
          <strong id="spfm-operator">Identificando...</strong>
          <span id="spfm-email">Abra uma mensagem</span>
        </div>

        <section class="spfm-priority-workflow">
          <div class="spfm-section-title">QUAL É O ASSUNTO DO E-MAIL?</div>
          <div id="spfm-priority-topics" class="spfm-topic-grid"></div>
          <label id="spfm-topic-variant-field" hidden>
            <span>Qual é o caso?</span>
            <select id="spfm-topic-variant"></select>
          </label>
          <div class="spfm-decision-grid">
            <button id="spfm-priority-reply" type="button" disabled>RESPONDER E-MAIL</button>
            <button id="spfm-priority-open" type="button" disabled>ABRIR NO FAST PROC</button>
          </div>
          <div id="spfm-priority-status" class="spfm-mini-status">Escolha o assunto do e-mail.</div>
        </section>

        <button id="spfm-script-toggle" class="spfm-secondary" type="button">BUSCAR SCRIPT</button>
        <div id="spfm-script-catalog" class="spfm-script-catalog" hidden>
          <label>
            <span>Fase do atendimento</span>
            <select id="spfm-script-phase">
              <option value="">Carregando fases...</option>
            </select>
          </label>
          <label>
            <span>Buscar por assunto ou palavra</span>
            <input id="spfm-script-search" type="search" autocomplete="off" placeholder="Ex.: motor, IPVA, processo aberto">
          </label>
          <div id="spfm-script-count" class="spfm-mini-status"></div>
          <label>
            <span>Resposta padrão</span>
            <select id="spfm-script-result">
              <option value="">Selecione o script</option>
            </select>
          </label>
          <div id="spfm-script-preview" class="spfm-script-preview">Selecione um resultado para conferir.</div>
          <button id="spfm-insert-script" type="button" disabled>INSERIR RESPOSTA</button>
          <div id="spfm-script-status" class="spfm-mini-status"></div>
        </div>

        <div class="spfm-fields">
          <label>
            <span>Nome do requerente</span>
            <input id="spfm-requester-name" type="text" autocomplete="off" placeholder="Nome completo">
          </label>
          <label>
            <span>CPF <small>(opcional)</small></span>
            <input id="spfm-requester-cpf" type="text" inputmode="numeric" maxlength="14" autocomplete="off" placeholder="Somente se informado">
          </label>
          <label>
            <span>Área</span>
            <select id="spfm-area">
              <option value="">Carregando caminhos...</option>
            </select>
          </label>
          <label id="spfm-objective-field" hidden>
            <span>Objetivo do cidadão</span>
            <select id="spfm-objective">
              <option value="">O que o cidadão deseja?</option>
            </select>
          </label>
          <label id="spfm-procedure-field" hidden>
            <span>Procedimento</span>
            <select id="spfm-procedure">
              <option value="">Carregando catálogo...</option>
            </select>
          </label>
          <label id="spfm-destination-field" hidden>
            <span>Destino <small>(editável)</small></span>
            <input id="spfm-destination" type="text" autocomplete="off" placeholder="Unidade de destino">
          </label>
          <div id="spfm-route-status" class="spfm-mini-status">Escolha uma das áreas principais.</div>
        </div>

        <div id="spfm-missing-box" class="spfm-missing-box" hidden>
          <button id="spfm-missing-toggle" class="spfm-secondary" type="button">FALTAM DOCUMENTOS</button>
          <div id="spfm-missing-list" class="spfm-missing-list" hidden>
            <div id="spfm-missing-options"></div>
            <button id="spfm-insert-requirement" type="button">INSERIR EXIGÊNCIA</button>
            <div id="spfm-body-status" class="spfm-mini-status"></div>
          </div>
        </div>

        <div id="spfm-process-response-box" class="spfm-missing-box" hidden>
          <button id="spfm-insert-process-response" type="button">INSERIR RESPOSTA DO PROCESSO</button>
          <div id="spfm-process-response-status" class="spfm-mini-status"></div>
        </div>

        <button id="spfm-open-process" type="button" hidden>ABRIR PROCESSO</button>
        <button id="spfm-triagem" type="button">PREPARAR TRIAGEM</button>
      </div>
    `

    document.documentElement.appendChild(panel)

    panel.querySelector('#spfm-collapse').addEventListener('click', () => togglePanel(panel))
    panel.querySelector('#spfm-topic-variant').addEventListener('change', renderPriorityRoute)
    panel.querySelector('#spfm-priority-reply').addEventListener('click', openPriorityResponses)
    panel.querySelector('#spfm-priority-open').addEventListener('click', openPriorityProcess)
    panel.querySelector('#spfm-script-toggle').addEventListener('click', toggleResponseScriptCatalog)
    panel.querySelector('#spfm-script-phase').addEventListener('change', renderResponseScriptResults)
    panel.querySelector('#spfm-script-search').addEventListener('input', renderResponseScriptResults)
    panel.querySelector('#spfm-script-result').addEventListener('change', renderSelectedResponseScript)
    panel.querySelector('#spfm-insert-script').addEventListener('click', insertSelectedResponseScript)
    panel.querySelector('#spfm-open-process').addEventListener('click', () => openProcessInSei())
    panel.querySelector('#spfm-triagem').addEventListener('click', prepareTriagem)
    panel.querySelector('#spfm-missing-toggle').addEventListener('click', toggleMissingDocuments)
    panel.querySelector('#spfm-insert-requirement').addEventListener('click', insertMissingDocumentsRequirement)
    panel.querySelector('#spfm-insert-process-response').addEventListener('click', () => {
      insertPendingProcessResponse(false)
    })
    panel.querySelector('#spfm-requester-cpf').addEventListener('input', (event) => {
      event.target.value = formatCpf(event.target.value)
    })
    panel.querySelector('#spfm-requester-name').addEventListener('change', savePanelAttendance)
    panel.querySelector('#spfm-requester-cpf').addEventListener('change', savePanelAttendance)
    panel.querySelector('#spfm-area').addEventListener('change', async (event) => {
      configureAreaRoute(event.target.value)
      await savePanelAttendance()
    })
    panel.querySelector('#spfm-objective').addEventListener('change', async () => {
      handleObjectiveChange()
      await savePanelAttendance()
    })
    panel.querySelector('#spfm-procedure').addEventListener('change', async () => {
      updateDestinationField(true)
      renderSelectedProcedure()
      await savePanelAttendance()
      updateMissingDocumentsVisibility()
    })
    panel.querySelector('#spfm-destination').addEventListener('change', async () => {
      renderSelectedProcedure()
      await savePanelAttendance()
    })

    makePanelMovable(panel)
  }

  async function scan () {
    const operator = findOperator()
    const senderEmail = findSenderEmail()
    currentOperator = operator

    const operatorElement = document.querySelector('#spfm-operator')
    const emailElement = document.querySelector('#spfm-email')

    if (operatorElement) {
      operatorElement.textContent = operator
        ? `Protocolista ${operator.number}`
        : 'Não identificado'
    }

    if (emailElement) {
      emailElement.textContent = senderEmail ||
        'Não identificado no cabeçalho atual'
    }

    if (operator) await storageSet({ [OPERATOR_KEY]: operator })

    if (IS_COMPOSE_WINDOW) {
      await autoInsertPendingProcessResponse()
    }

    if (senderEmail) {
      const stored = await storageGet(ATTENDANCE_KEY)
      const current = stored[ATTENDANCE_KEY] || {}

      if (current.email !== senderEmail) {
        await storageSet({
          [ATTENDANCE_KEY]: {
            email: senderEmail,
            name: '',
            cpf: '',
            procedureId: '',
            destination: '',
            updatedAt: Date.now(),
            emailSource: 'webmail-current-header'
          }
        })

        const nameField = document.querySelector('#spfm-requester-name')
        const cpfField = document.querySelector('#spfm-requester-cpf')
        const procedureField = document.querySelector('#spfm-procedure')
        const destinationField = document.querySelector('#spfm-destination')
        const destinationLabel = document.querySelector('#spfm-destination-field')
        const areaField = document.querySelector('#spfm-area')
        const objectiveField = document.querySelector('#spfm-objective')
        const missingList = document.querySelector('#spfm-missing-list')
        const status = document.querySelector('#spfm-body-status')

        if (nameField) nameField.value = ''
        if (cpfField) cpfField.value = ''
        if (procedureField) procedureField.value = ''
        if (destinationField) destinationField.value = ''
        if (destinationLabel) destinationLabel.hidden = true
        if (areaField) areaField.value = ''
        if (objectiveField) objectiveField.value = ''
        configureAreaRoute('')
        document.querySelectorAll('.spfm-missing-doc:checked')
          .forEach((checkbox) => { checkbox.checked = false })
        if (missingList) missingList.hidden = true
        if (status) status.textContent = ''
        updateMissingDocumentsVisibility()
      }
    }
  }

  async function initialize () {
    if (await autoLoginWebmail()) return

    await scan()

    if (!IS_COMPOSE_WINDOW) {
      window.setInterval(scan, 2500)
      return
    }

    createPanel()
    await loadCatalog()
    await loadResponseScriptCatalog()
    await loadPanelAttendance()
    updateMissingDocumentsVisibility()
    await scan()
    await autoInsertPendingProcessResponse()

    // O Bcc é obrigatório em todas as respostas: prepara automaticamente.
    window.setTimeout(() => prepareBcc(), 700)
    window.setInterval(scan, 2500)
  }

  api.runtime.onMessage.addListener((message) => {
    if (message?.type !== PROCESS_RESULT_READY_MESSAGE) return
    autoInsertPendingProcessResponse().catch((error) => {
      console.error('[SEI Protocolistas] Falha ao inserir automaticamente o retorno do processo:', error)
    })
  })

  initialize()
})()
