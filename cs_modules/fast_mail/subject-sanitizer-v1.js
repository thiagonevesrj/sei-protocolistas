(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const INTERNAL_RQ_LABEL = /\s*⚡?\s*REQUERIMENTO\s+R[ÁA]PIDO\b/gi
  const INSERTION_SELECTOR = '#spfm-insert-script, #spfm-insert-requirement, #spfm-baixa-direct-insert, #spfm-workflow-v3-identification-insert'
  let scheduled = false
  let subjectPreparationRunning = false

  function clean (value) {
    return String(value || '').replace(/\s+/g, ' ').trim()
  }

  function normalize (value) {
    return clean(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
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

  function visible (element) {
    if (!element) return false
    const style = element.ownerDocument.defaultView?.getComputedStyle(element)
    if (!style || style.display === 'none' || style.visibility === 'hidden') return false
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }

  function findSubjectField () {
    const selectors = [
      '#divWellSubject input',
      '#divWellSubject textarea',
      'input[name*="subject" i]',
      'input[id*="subject" i]',
      'input[name*="assunto" i]',
      'input[id*="assunto" i]',
      'textarea[name*="subject" i]',
      'textarea[id*="subject" i]'
    ]

    for (const doc of allDocuments()) {
      for (const selector of selectors) {
        const field = Array.from(doc.querySelectorAll(selector)).find(visible)
        if (field) return field
      }
    }
    return null
  }

  function requesterData () {
    const name = clean(
      document.querySelector('#spfm-requester-name')?.value ||
      document.querySelector('#spfm-workflow-v3-requester-name')?.value
    )
    const cpf = String(
      document.querySelector('#spfm-requester-cpf')?.value ||
      document.querySelector('#spfm-workflow-v3-requester-cpf')?.value || ''
    ).replace(/\D/g, '')

    return { name, cpf, complete: Boolean(name && cpf.length === 11) }
  }

  function selectedDestination () {
    const manual = clean(document.querySelector('#spfm-destination')?.value)
    if (manual) return manual

    const procedure = document.querySelector('#spfm-procedure')
    const selectedText = clean(procedure?.selectedOptions?.[0]?.textContent)
    const match = selectedText.match(/\s—\s(.+)$/)
    return clean(match?.[1])
  }

  function operatorNumber () {
    const panelOperator = clean(document.querySelector('#spfm-operator')?.textContent)
    const panelMatch = panelOperator.match(/(?:Protocolista\s*)?(\d{1,4})\b/i)
    if (panelMatch) return panelMatch[1]

    for (const doc of allDocuments()) {
      const text = String(doc.body?.innerText || '')
      const match = text.match(/\bProtocolista\s+(\d{1,4})\b/i) ||
        text.match(/protocolista\s*(\d{1,4})@detran\.rj\.gov\.br/i)
      if (match) return match[1]
    }
    return ''
  }

  function subjectPrefix (subject) {
    const match = clean(subject).match(/^((?:RE|ENC|FW|FWD)\s*:\s*)+/i)
    return match ? match[0].replace(/\s+/g, ' ').trim() + ' ' : ''
  }

  function partialTriagemSubject (subject) {
    const current = clean(subject)
    if (!current) return 'TRIAGEM'
    if (/\bTRIAGEM\b/i.test(current)) return current
    return `${current} - TRIAGEM`
  }

  function completeTriagemSubject (subject) {
    const data = requesterData()
    const destination = selectedDestination()
    const operator = operatorNumber()
    if (!data.complete || !destination || !operator) return ''

    const now = new Date()
    const date = [
      String(now.getDate()).padStart(2, '0'),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getFullYear())
    ].join('')

    return `${subjectPrefix(subject)}${data.name.toUpperCase()} - ${destination} - ${date}${operator} - TRIAGEM`
  }

  function isCompleteOperationalSubject (value) {
    const subject = clean(value)
    return /\bTRIAGEM\b/i.test(subject) &&
      /\b\d{9,12}\s*-\s*TRIAGEM\b/i.test(subject) &&
      /\s-\s[^-]+\s-\s\d/.test(subject)
  }

  function sanitizeOperationalSubject (value) {
    const current = clean(value)
    if (!current || !isCompleteOperationalSubject(current) || !INTERNAL_RQ_LABEL.test(current)) {
      INTERNAL_RQ_LABEL.lastIndex = 0
      return current
    }

    INTERNAL_RQ_LABEL.lastIndex = 0
    return clean(current
      .replace(INTERNAL_RQ_LABEL, ' ')
      .replace(/\s+-\s+-\s+/g, ' - ')
      .replace(/\s{2,}/g, ' '))
  }

  function setNativeValue (field, value) {
    if (!field || clean(field.value || field.textContent) === value) return false

    field.focus?.()
    if ('value' in field) {
      const proto = Object.getPrototypeOf(field)
      const descriptor = proto ? Object.getOwnPropertyDescriptor(proto, 'value') : null
      if (descriptor?.set) descriptor.set.call(field, value)
      else field.value = value
    } else {
      field.textContent = value
    }

    const view = field.ownerDocument.defaultView || window
    field.dispatchEvent(new view.Event('input', { bubbles: true }))
    field.dispatchEvent(new view.Event('change', { bubbles: true }))
    return true
  }

  function setPreparationStatus (message, buttonText) {
    const button = document.querySelector('#spfm-triagem')
    if (button && buttonText) button.textContent = buttonText
    const status = document.querySelector('#spfm-workflow-v3-status') || document.querySelector('#spfm-priority-status')
    if (status) status.textContent = message
  }

  function prepareSubjectOnly () {
    if (subjectPreparationRunning) return false
    subjectPreparationRunning = true

    try {
      const field = findSubjectField()
      if (!field) {
        setPreparationStatus('Não localizei o campo de assunto do OWA.', 'ASSUNTO NÃO LOCALIZADO')
        return false
      }

      const current = clean(field.value || field.textContent)
      const complete = completeTriagemSubject(current)

      if (complete) {
        const changed = setNativeValue(field, complete)
        setPreparationStatus(
          changed
            ? '✓ Assunto preparado no padrão completo de TRIAGEM.'
            : '✓ Assunto já está no padrão completo de TRIAGEM.',
          'TRIAGEM PREPARADA'
        )
        return true
      }

      const partial = partialTriagemSubject(current)
      const changed = setNativeValue(field, partial)
      const data = requesterData()
      setPreparationStatus(
        data.complete
          ? 'TRIAGEM provisória aplicada. O padrão completo será usado quando procedimento e operador estiverem disponíveis.'
          : 'TRIAGEM provisória aplicada. Quando nome + CPF estiverem disponíveis, o assunto poderá ser atualizado para o padrão completo.',
        changed ? 'TRIAGEM PARCIAL' : 'TRIAGEM PARCIAL JÁ APLICADA'
      )
      return true
    } finally {
      window.setTimeout(() => { subjectPreparationRunning = false }, 30)
    }
  }

  function sanitizeNow () {
    scheduled = false
    const field = findSubjectField()
    if (!field) return false

    const current = clean(field.value || field.textContent)
    const sanitized = sanitizeOperationalSubject(current)
    if (!sanitized || sanitized === current) return false

    setNativeValue(field, sanitized)
    console.info('[SEI Protocolistas] Rótulo interno removido do assunto operacional.')
    return true
  }

  function scheduleSanitize () {
    if (scheduled) return
    scheduled = true
    window.setTimeout(sanitizeNow, 0)
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('#spfm-triagem')
    if (!button) return

    // PREPARAR E-MAIL passa a cuidar somente do assunto. Bcc permanece sob a
    // rotina que já está validada e não é tocado por esta política.
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    prepareSubjectOnly()
  }, true)

  document.addEventListener('click', (event) => {
    const control = event.target.closest?.(INSERTION_SELECTOR)
    if (!control) return
    if (control.id === 'spfm-workflow-v3-identification-insert' && control.dataset.ready !== 'true') return

    // Qualquer resposta/exigência inserida já prepara o assunto. Nome + CPF
    // geram o padrão completo; sem eles, preserva o assunto e apenas acrescenta TRIAGEM.
    window.setTimeout(prepareSubjectOnly, 260)
  }, true)

  document.addEventListener('input', (event) => {
    if (event.target?.matches?.('input[name*="subject" i],input[id*="subject" i],input[name*="assunto" i],input[id*="assunto" i],textarea[name*="subject" i],textarea[id*="subject" i]')) {
      scheduleSanitize()
      return
    }

    if (event.target?.matches?.('#spfm-requester-name, #spfm-requester-cpf, #spfm-workflow-v3-requester-name, #spfm-workflow-v3-requester-cpf')) {
      const field = findSubjectField()
      const current = clean(field?.value || field?.textContent)
      if (/\bTRIAGEM\b/i.test(current) && !isCompleteOperationalSubject(current) && requesterData().complete) {
        window.setTimeout(prepareSubjectOnly, 120)
      }
    }
  }, true)

  document.addEventListener('change', (event) => {
    scheduleSanitize()
    if (event.target?.matches?.('#spfm-procedure, #spfm-destination')) {
      const field = findSubjectField()
      const current = clean(field?.value || field?.textContent)
      if (/\bTRIAGEM\b/i.test(current) && !isCompleteOperationalSubject(current) && requesterData().complete) {
        window.setTimeout(prepareSubjectOnly, 100)
      }
    }
  }, true)

  ;[0, 250, 700, 1500].forEach((delay) => window.setTimeout(sanitizeNow, delay))
})()
