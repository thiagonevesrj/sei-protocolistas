(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const DOUBLE_CLICK_WINDOW = 1500
  let lastAllowedAt = 0
  let lastScriptId = ''

  function clean (value) {
    return String(value || '').replace(/\s+/g, ' ').trim()
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

  function safeHtmlEditor () {
    for (const doc of allDocuments()) {
      const bodyContainer = doc.querySelector('#divBdy')
      const frame = bodyContainer?.querySelector('iframe#ifBdy')
      if (!bodyContainer || !frame) continue
      if (bodyContainer.closest?.('#divHdrMessage') || frame.closest?.('#divHdrMessage')) continue

      try {
        const frameDocument = frame.contentDocument
        const body = frameDocument?.body
        const editable = frameDocument?.designMode?.toLowerCase() === 'on' ||
          body?.isContentEditable ||
          body?.getAttribute?.('contenteditable') === 'true'
        if (body && editable) return body
      } catch (_) {}
    }

    return null
  }

  function selectedScriptId () {
    return clean(document.querySelector('#spfm-script-result')?.value)
  }

  function setStatus (message) {
    const targets = [
      document.querySelector('#spfm-script-status'),
      document.querySelector('#spfm-priority-status'),
      document.querySelector('#spfm-workflow-v3-status')
    ].filter(Boolean)

    targets.forEach((target) => { target.textContent = message })
  }

  function releaseHistoricalScriptMarkers (editor) {
    if (!editor) return

    editor.querySelectorAll('[data-sei-protocolistas="catalog-script"]').forEach((node) => {
      node.removeAttribute('data-sei-protocolistas')
      node.removeAttribute('data-script-id')
    })
  }

  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('#spfm-insert-script')
    if (!button) return

    const scriptId = selectedScriptId()
    const now = Date.now()

    if (scriptId && scriptId === lastScriptId && now - lastAllowedAt < DOUBLE_CLICK_WINDOW) {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      setStatus('Clique duplicado ignorado — a resposta acabou de ser inserida.')
      return
    }

    // Uma resposta antiga na mesma conversa nunca deve impedir uma nova orientação.
    // Antes da inserção, retiramos apenas os marcadores técnicos das respostas já
    // existentes no histórico. O texto do histórico permanece absolutamente intacto.
    releaseHistoricalScriptMarkers(safeHtmlEditor())

    lastScriptId = scriptId
    lastAllowedAt = now
  }, true)
})()
