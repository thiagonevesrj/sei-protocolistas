(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  let preparing = null
  let scheduled = false
  let lastAttemptAt = 0
  const RETRY_COOLDOWN = 3500

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

  function visible (element) {
    if (!element) return false
    const view = element.ownerDocument?.defaultView
    const style = view?.getComputedStyle(element)
    if (!style || style.display === 'none' || style.visibility === 'hidden') return false
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }

  function selectedText (select) {
    return clean(select?.options?.[select.selectedIndex]?.text || select?.value)
  }

  function isHtmlText (value) {
    return /(^|\b)html(\b|$)/i.test(clean(value))
  }

  function isPlainText (value) {
    return /texto\s*simp|plain\s*text|texto\s*sem\s*formata/i.test(clean(value))
  }

  function formatSelect () {
    for (const doc of allDocuments()) {
      const selects = Array.from(doc.querySelectorAll('select'))
      for (const select of selects) {
        const labels = Array.from(select.options || []).map((option) => clean(option.text))
        if (labels.some(isHtmlText) && (labels.some(isPlainText) || isPlainText(selectedText(select)))) {
          return select
        }
      }
    }
    return null
  }

  function deterministicHtmlEditor () {
    for (const doc of allDocuments()) {
      const bodyContainer = doc.querySelector('#divBdy')
      if (!bodyContainer || bodyContainer.closest?.('#divHdrMessage')) continue

      const frame = bodyContainer.querySelector('iframe#ifBdy')
      if (!frame || !visible(frame) || frame.closest?.('#divHdrMessage')) continue

      try {
        const htmlDocument = frame.contentDocument
        const htmlBody = htmlDocument?.body
        const editable = htmlDocument?.designMode?.toLowerCase() === 'on' ||
          htmlBody?.isContentEditable ||
          htmlBody?.getAttribute?.('contenteditable') === 'true'
        if (htmlBody && editable) return htmlBody
      } catch (_) {}
    }
    return null
  }

  function fastMailPanelExists () {
    return Boolean(document.querySelector(
      '#sei-protocolistas-fast-mail-status, #spfm-navigation-v2, #spfm-workflow-v3'
    ))
  }

  function dispatch (element, type) {
    const view = element?.ownerDocument?.defaultView || window
    element?.dispatchEvent(new view.Event(type, { bubbles: true, cancelable: true }))
  }

  function waitFor (getter, timeout = 5200, interval = 90) {
    return new Promise((resolve) => {
      const started = Date.now()
      const timer = window.setInterval(() => {
        const result = getter()
        if (result || Date.now() - started >= timeout) {
          window.clearInterval(timer)
          resolve(result || null)
        }
      }, interval)
    })
  }

  function applyHtmlOption (select, htmlOption) {
    if (!select || !htmlOption) return false

    const optionIndex = Array.from(select.options || []).indexOf(htmlOption)
    const view = select.ownerDocument?.defaultView || window

    select.focus?.()
    htmlOption.selected = true
    select.value = htmlOption.value
    if (optionIndex >= 0) select.selectedIndex = optionIndex

    dispatch(select, 'input')

    if (typeof select.onchange === 'function') {
      try {
        select.onchange.call(select, new view.Event('change', { bubbles: true, cancelable: true }))
      } catch (_) {}
    }

    // O OWA legado possui versões em que o handler está registrado fora da
    // propriedade onchange. Por isso o change bubbling também é obrigatório.
    dispatch(select, 'change')
    dispatch(select, 'blur')
    return true
  }

  async function tryHtmlInBackground (force = false) {
    if (deterministicHtmlEditor()) return true
    if (preparing) return preparing
    if (!force && Date.now() - lastAttemptAt < RETRY_COOLDOWN) return false

    preparing = (async () => {
      lastAttemptAt = Date.now()
      const select = formatSelect()
      if (!select) return false

      // Se o seletor já mostra HTML, o OWA pode ainda estar terminando a troca
      // do textarea pelo iframe. Não revertemos o seletor: apenas aguardamos.
      if (isHtmlText(selectedText(select))) {
        return Boolean(await waitFor(deterministicHtmlEditor, 6000, 90))
      }

      if (!isPlainText(selectedText(select))) return false

      const htmlOption = Array.from(select.options || []).find((option) => isHtmlText(option.text))
      if (!htmlOption) return false

      applyHtmlOption(select, htmlOption)

      let editor = await waitFor(deterministicHtmlEditor, 3000, 90)
      if (editor) return true

      // Alguns builds do OWA aplicam a mudança somente após uma segunda
      // notificação, quando a tela de resposta já terminou de inicializar.
      applyHtmlOption(select, htmlOption)
      editor = await waitFor(deterministicHtmlEditor, 4200, 90)
      return Boolean(editor)
    })()

    try {
      return await preparing
    } finally {
      preparing = null
    }
  }

  function primeHtmlSoon (delay = 80, force = false) {
    window.setTimeout(() => {
      if (!fastMailPanelExists()) return
      tryHtmlInBackground(force).catch(() => {})
    }, delay)
  }

  function cloneLineContainer (doc, nodes) {
    const holder = doc.createElement('span')
    nodes.forEach((node) => holder.appendChild(node.cloneNode(true)))
    return holder
  }

  function firstTextNode (node) {
    const showText = node.ownerDocument?.defaultView?.NodeFilter?.SHOW_TEXT || 4
    return node.ownerDocument.createTreeWalker(node, showText).nextNode()
  }

  function stripBulletMarker (holder) {
    const textNode = firstTextNode(holder)
    if (textNode) textNode.nodeValue = String(textNode.nodeValue || '').replace(/^\s*[-•·]\s+/, '')
  }

  function normalizedHeadingText (value) {
    return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  }

  function lineKind (text) {
    const normalized = normalizedHeadingText(text)
    if (!normalized) return 'blank'
    if (/^[-•·]\s+/.test(text.trim())) return 'bullet'
    if (/^(atencao|importante)\b/.test(normalized)) return 'alert'
    if (/^atenciosamente[,.]?$/.test(normalized)) return 'signature'
    const headingPrefix = /^(observacoes?|documentacao|documentos?|formulario|taxa|contato|canais?|dados do processo|documentacao especifica|documentacao pessoa|documentacao representacao)\b/
    if (text.length <= 110 && (headingPrefix.test(normalized) || /:$/.test(text.trim()))) return 'heading'
    return 'paragraph'
  }

  function styleLinks (root) {
    root.querySelectorAll('a[href]').forEach((link) => {
      link.style.color = '#0b57d0'
      link.style.textDecoration = 'underline'
      link.style.fontWeight = '600'
      link.style.wordBreak = 'break-word'
    })
  }

  function presentCatalogScript (root) {
    if (!root || root.dataset.spfmPresented === 'true') return

    const doc = root.ownerDocument
    const lines = []
    let current = []

    Array.from(root.childNodes).forEach((node) => {
      if (node.nodeName === 'BR') {
        lines.push(current)
        current = []
      } else current.push(node)
    })
    lines.push(current)

    const fragment = doc.createDocumentFragment()
    let activeList = null

    lines.forEach((nodes) => {
      const holder = cloneLineContainer(doc, nodes)
      const text = clean(holder.textContent)
      const kind = lineKind(text)

      if (kind === 'blank') {
        activeList = null
        return
      }

      if (kind === 'bullet') {
        if (!activeList) {
          activeList = doc.createElement('ul')
          activeList.style.margin = '4px 0 16px 22px'
          activeList.style.padding = '0'
          fragment.appendChild(activeList)
        }
        stripBulletMarker(holder)
        const item = doc.createElement('li')
        item.style.margin = '0 0 7px 0'
        while (holder.firstChild) item.appendChild(holder.firstChild)
        activeList.appendChild(item)
        return
      }

      activeList = null
      const block = doc.createElement(kind === 'paragraph' || kind === 'signature' ? 'p' : 'div')
      while (holder.firstChild) block.appendChild(holder.firstChild)

      if (kind === 'alert') {
        block.style.margin = '16px 0'
        block.style.padding = '11px 13px'
        block.style.background = '#fff8e6'
        block.style.border = '1px solid #ead39a'
        block.style.borderLeft = '4px solid #c69214'
        block.style.borderRadius = '4px'
        block.style.fontWeight = '700'
        block.style.color = '#332600'
      } else if (kind === 'heading') {
        block.style.margin = '18px 0 9px 0'
        block.style.padding = '8px 10px'
        block.style.background = '#f2f6f9'
        block.style.borderLeft = '4px solid #174a7e'
        block.style.fontWeight = '700'
        block.style.color = '#17324d'
      } else if (kind === 'signature') {
        block.style.margin = '22px 0 6px 0'
        block.style.paddingTop = '12px'
        block.style.borderTop = '1px solid #d8dde3'
        block.style.color = '#34495e'
      } else {
        block.style.margin = '0 0 12px 0'
      }

      fragment.appendChild(block)
    })

    root.replaceChildren(fragment)
    root.dataset.spfmPresented = 'true'
    root.style.fontFamily = 'Arial, Segoe UI, sans-serif'
    root.style.fontSize = '14px'
    root.style.lineHeight = '1.58'
    root.style.color = '#1f2933'
    root.style.maxWidth = '900px'
    root.style.padding = '14px 4px 2px 0'
    root.style.borderTop = '3px solid #174a7e'
    styleLinks(root)
  }

  function presentStructuredResponse (root) {
    if (!root || root.dataset.spfmPresented === 'true') return
    root.dataset.spfmPresented = 'true'
    root.style.fontFamily = 'Arial, Segoe UI, sans-serif'
    root.style.fontSize = '14px'
    root.style.lineHeight = '1.58'
    root.style.color = '#1f2933'
    root.style.maxWidth = '900px'
    root.style.paddingTop = '12px'
    styleLinks(root)
  }

  function formatPendingResponses () {
    for (const doc of allDocuments()) {
      doc.querySelectorAll('[data-sei-protocolistas="catalog-script"]').forEach(presentCatalogScript)
      doc.querySelectorAll(
        '[data-sei-protocolistas="missing-documents-requirement"], [data-sei-protocolistas="process-completed-response"], [data-sei-protocolistas="presential-missing-documents"]'
      ).forEach(presentStructuredResponse)
    }
  }

  function scheduleBackgroundPreparation () {
    if (scheduled) return
    scheduled = true
    window.setTimeout(() => {
      scheduled = false
      formatPendingResponses()
      if (fastMailPanelExists()) tryHtmlInBackground().catch(() => {})
    }, 180)
  }

  // Prepara HTML antes do clique final do protocolista. Ações como COBRAR
  // DOCUMENTOS dão tempo suficiente ao OWA para trocar textarea -> iframe
  // enquanto o operador confere dados e marca o checklist.
  document.addEventListener('click', (event) => {
    const control = event.target.closest?.(
      '#spfm-priority-missing, #spfm-priority-reply, .spfm-workflow-v3-service-button, [data-spfm-workflow-stage], #spfm-v2-orientation-open, #spfm-v2-identification-open'
    )
    if (!control) return
    primeHtmlSoon(70, true)
  }, true)

  const observer = new MutationObserver(scheduleBackgroundPreparation)
  observer.observe(document.documentElement, { childList: true, subtree: true })

  window.setTimeout(() => {
    formatPendingResponses()
    if (fastMailPanelExists()) tryHtmlInBackground(true).catch(() => {})
  }, 350)

  window.setTimeout(() => {
    if (fastMailPanelExists()) tryHtmlInBackground(true).catch(() => {})
  }, 2200)

  window.setInterval(formatPendingResponses, 1000)
})()
