(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const bypass = new WeakSet()
  let preparing = null
  let scheduled = false
  let lastPrepareAttempt = 0

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
      const selects = Array.from(doc.querySelectorAll('select')).filter(visible)

      for (const select of selects) {
        const labels = Array.from(select.options || []).map((option) => clean(option.text))
        if (labels.some(isHtmlText) && labels.some(isPlainText)) return select
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

  function setStatus (message) {
    const targets = [
      document.querySelector('#spfm-script-status'),
      document.querySelector('#spfm-priority-status'),
      document.querySelector('#spfm-v2-status'),
      document.querySelector('#spfm-workflow-v3-status'),
      document.querySelector('#spfm-body-status'),
      document.querySelector('#spfm-process-response-status')
    ].filter(Boolean)

    targets.forEach((target) => { target.textContent = message })
  }

  function dispatch (element, type) {
    const view = element?.ownerDocument?.defaultView || window
    element?.dispatchEvent(new view.Event(type, { bubbles: true, cancelable: false }))
  }

  function waitFor (getter, timeout = 5000, interval = 100) {
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

  async function ensureHtmlComposer () {
    if (preparing) return preparing

    preparing = (async () => {
      lastPrepareAttempt = Date.now()
      const select = await waitFor(() => formatSelect(), 2500, 80)

      if (!select) {
        return Boolean(await waitFor(() => deterministicHtmlEditor(), 1800, 80))
      }

      if (isHtmlText(selectedText(select))) {
        return Boolean(await waitFor(() => deterministicHtmlEditor(), 2500, 80))
      }

      const htmlOption = Array.from(select.options || []).find((option) => isHtmlText(option.text))
      if (!htmlOption) return false

      setStatus('FAST MAIL — preparando e-mail formatado…')

      select.focus?.()
      select.value = htmlOption.value
      select.selectedIndex = Array.from(select.options || []).indexOf(htmlOption)
      dispatch(select, 'input')
      dispatch(select, 'change')
      select.blur?.()

      const editor = await waitFor(() => {
        if (!isHtmlText(selectedText(select))) return null
        return deterministicHtmlEditor()
      }, 6000, 100)

      if (editor) setStatus('FAST MAIL — e-mail formatado pronto.')
      return Boolean(editor)
    })()

    try {
      return await preparing
    } finally {
      preparing = null
    }
  }

  function fastMailPanelExists () {
    return Boolean(document.querySelector(
      '#sei-protocolistas-fast-mail-status, #spfm-navigation-v2, #spfm-workflow-v3'
    ))
  }

  function isInsertionControl (target) {
    if (!(target instanceof Element)) return null
    return target.closest(
      '#spfm-insert-script, #spfm-insert-requirement, #spfm-insert-process-response, #spfm-baixa-direct-insert'
    )
  }

  function cloneLineContainer (doc, nodes) {
    const holder = doc.createElement('span')
    nodes.forEach((node) => holder.appendChild(node.cloneNode(true)))
    return holder
  }

  function firstTextNode (node) {
    const walker = node.ownerDocument.createTreeWalker(node, NodeFilter.SHOW_TEXT)
    return walker.nextNode()
  }

  function stripBulletMarker (holder) {
    const textNode = firstTextNode(holder)
    if (!textNode) return
    textNode.nodeValue = String(textNode.nodeValue || '').replace(/^\s*[-•·]\s+/, '')
  }

  function normalizedHeadingText (value) {
    return clean(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
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
    const sourceNodes = Array.from(root.childNodes)
    const lines = []
    let current = []

    sourceNodes.forEach((node) => {
      if (node.nodeName === 'BR') {
        lines.push(current)
        current = []
      } else {
        current.push(node)
      }
    })
    lines.push(current)

    const fragment = doc.createDocumentFragment()
    let activeList = null

    const closeList = () => { activeList = null }

    lines.forEach((nodes) => {
      const holder = cloneLineContainer(doc, nodes)
      const text = clean(holder.textContent)
      const kind = lineKind(text)

      if (kind === 'blank') {
        closeList()
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
        item.style.paddingLeft = '2px'
        while (holder.firstChild) item.appendChild(holder.firstChild)
        activeList.appendChild(item)
        return
      }

      closeList()

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

  async function normalizeWhenPanelAppears () {
    if (!fastMailPanelExists()) return false

    const select = formatSelect()
    if (!select || !isPlainText(selectedText(select))) return true

    return ensureHtmlComposer()
  }

  document.addEventListener('click', async (event) => {
    const control = isInsertionControl(event.target)
    if (!control) return

    if (bypass.has(control)) {
      bypass.delete(control)
      return
    }

    const select = formatSelect()
    if (!select || !isPlainText(selectedText(select))) return

    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()

    const ready = await ensureHtmlComposer()
    if (!ready) {
      setStatus('Não foi possível preparar o e-mail com formatação. Nada foi inserido.')
      return
    }

    bypass.add(control)
    control.click()
  }, true)

  const observer = new MutationObserver(() => {
    if (scheduled) return
    scheduled = true
    window.setTimeout(() => {
      scheduled = false
      normalizeWhenPanelAppears().catch(() => {})
      formatPendingResponses()
    }, 120)
  })

  observer.observe(document.documentElement, { childList: true, subtree: true })

  window.setInterval(() => {
    formatPendingResponses()

    if (!fastMailPanelExists()) return
    const select = formatSelect()
    if (!select || !isPlainText(selectedText(select))) return
    if (preparing || Date.now() - lastPrepareAttempt < 1600) return
    ensureHtmlComposer().catch(() => {})
  }, 700)

  window.setTimeout(() => normalizeWhenPanelAppears().catch(() => {}), 250)
  window.setTimeout(() => normalizeWhenPanelAppears().catch(() => {}), 900)
  window.setTimeout(formatPendingResponses, 400)
})()
