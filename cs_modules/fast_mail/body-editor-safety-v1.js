(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const api = typeof browser === 'undefined' ? chrome : browser
  const SCRIPT_CATALOG_PATH = 'data/catalogo-scripts.json'
  const HISTORY_SEPARATOR = '----- HISTÓRICO DE MENSAGENS ANTERIORES -----'

  let scripts = []

  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim()

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

  function isVisible (element) {
    if (!element) return false
    const view = element.ownerDocument?.defaultView
    const style = view?.getComputedStyle(element)
    if (!style || style.display === 'none' || style.visibility === 'hidden') return false
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }

  function fieldDescriptor (field) {
    return clean([
      field?.name,
      field?.id,
      field?.className,
      field?.getAttribute?.('aria-label'),
      field?.getAttribute?.('title'),
      field?.getAttribute?.('placeholder')
    ].filter(Boolean).join(' ')).toLowerCase()
  }

  function isForbiddenComposeField (field) {
    if (!field) return true
    if (field.closest?.('#sei-protocolistas-fast-mail-status')) return true
    if (field.closest?.('#spfm-navigation-v2')) return true

    const descriptor = fieldDescriptor(field)
    if (/(^|\b)(subject|assunto|recipient|destinat|bcc|cc)(\b|$)/i.test(descriptor)) return true
    if (/(^|\b)(to|para)(\b|$)/i.test(descriptor)) return true

    return false
  }

  function plainTextModeActive () {
    for (const doc of allDocuments()) {
      const selects = Array.from(doc.querySelectorAll('select')).filter(isVisible)
      for (const select of selects) {
        const selectedText = clean(select.options?.[select.selectedIndex]?.text || select.value)
        if (/texto\s*simples|plain\s*text/i.test(selectedText)) return true
      }
    }
    return false
  }

  function findSafePlainTextBody () {
    const candidates = []

    for (const doc of allDocuments()) {
      const textareas = Array.from(doc.querySelectorAll('textarea')).filter(isVisible)
      for (const textarea of textareas) {
        if (isForbiddenComposeField(textarea)) continue

        const rect = textarea.getBoundingClientRect()
        if (rect.width < 360 || rect.height < 120) continue

        const area = rect.width * rect.height
        const score = area + Math.min(String(textarea.value || '').length, 10000)
        candidates.push({ textarea, score, rect })
      }
    }

    candidates.sort((a, b) => b.score - a.score)
    return candidates[0]?.textarea || null
  }

  function selectedScript () {
    const id = document.querySelector('#spfm-script-result')?.value || ''
    return scripts.find((script) => script.id === id) || null
  }

  function markdownToPlainText (source) {
    return String(source || '')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\)/g, '$1: $2')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/^#{1,6}\s*/gm, '')
      .replace(/\\([_*\[\]()])/g, '$1')
      .replace(/\u200c/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  function setStatus (message) {
    const v3 = document.querySelector('#spfm-workflow-v3-status')
    const v2 = document.querySelector('#spfm-v2-status')
    const native = document.querySelector('#spfm-priority-status')
    if (v3) v3.textContent = message
    if (v2) v2.textContent = message
    if (native) native.textContent = message
  }

  function dispatchFieldEvents (field) {
    const view = field.ownerDocument?.defaultView || window
    ;['input', 'change', 'keyup', 'blur'].forEach((eventName) => {
      field.dispatchEvent(new view.Event(eventName, { bubbles: true }))
    })
  }

  function insertPlainTextResponse (textarea, script) {
    const response = markdownToPlainText(script?.body)
    if (!response) return false

    const previous = String(textarea.value || '')
    const next = previous.trim()
      ? `${response}\n\n${HISTORY_SEPARATOR}\n\n${previous}`
      : response

    textarea.focus()
    textarea.value = next
    dispatchFieldEvents(textarea)
    setStatus('RESPOSTA INSERIDA NO CORPO DO E-MAIL — confira antes de enviar.')
    return true
  }

  function handleInsertCapture (event) {
    const button = event.target?.closest?.('#spfm-insert-script')
    if (!button) return
    if (!plainTextModeActive()) return

    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()

    const script = selectedScript()
    if (!script) {
      setStatus('Selecione uma resposta antes de inserir.')
      return
    }

    const body = findSafePlainTextBody()
    if (!body) {
      setStatus('SEGURANÇA: corpo do e-mail não localizado. Nada foi inserido.')
      return
    }

    insertPlainTextResponse(body, script)
  }

  async function init () {
    try {
      const response = await fetch(api.runtime.getURL(SCRIPT_CATALOG_PATH))
      if (response.ok) {
        const data = await response.json()
        scripts = Array.isArray(data?.scripts) ? data.scripts : []
      }
    } catch (error) {
      console.warn('[SEI Protocolistas] Catálogo indisponível para proteção do corpo:', error)
    }

    document.addEventListener('click', handleInsertCapture, true)
  }

  init()
})()
