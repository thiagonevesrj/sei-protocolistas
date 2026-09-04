(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const INTERNAL_RQ_LABEL = /\s*⚡?\s*REQUERIMENTO\s+R[ÁA]PIDO\b/gi
  let scheduled = false

  function clean (value) {
    return String(value || '').replace(/\s+/g, ' ').trim()
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

  function isOperationalSubject (value) {
    const subject = clean(value)
    return /\b(?:TRIAGEM|FECHADO)\b/i.test(subject) && /\b\d{7,12}\b/.test(subject)
  }

  function sanitizeOperationalSubject (value) {
    const current = clean(value)
    if (!current || !isOperationalSubject(current) || !INTERNAL_RQ_LABEL.test(current)) {
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

  document.addEventListener('input', (event) => {
    if (event.target?.matches?.('input[name*="subject" i],input[id*="subject" i],input[name*="assunto" i],input[id*="assunto" i],textarea[name*="subject" i],textarea[id*="subject" i]')) {
      scheduleSanitize()
    }
  }, true)

  document.addEventListener('change', scheduleSanitize, true)

  ;[0, 250, 700, 1500].forEach((delay) => window.setTimeout(sanitizeNow, delay))
})()
