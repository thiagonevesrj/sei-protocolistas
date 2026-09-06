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

  function elementText (element) {
    return clean(
      element?.value ||
      element?.getAttribute?.('aria-label') ||
      element?.getAttribute?.('title') ||
      element?.innerText ||
      element?.textContent
    )
  }

  function isHtmlText (value) {
    return /(^|\b)html(\b|$)/i.test(clean(value))
  }

  function isPlainText (value) {
    return /texto\s*simp|plain\s*text|texto\s*sem\s*formata/i.test(clean(value))
  }

  function selectedText (select) {
    return clean(select?.options?.[select.selectedIndex]?.text || select?.value)
  }

  function insideFastMail (element) {
    return Boolean(element?.closest?.(
      '#sei-protocolistas-fast-mail-status, #spfm-navigation-v2, #spfm-workflow-v3'
    ))
  }

  function candidateIsSafeToolbarControl (element) {
    if (!visible(element) || insideFastMail(element) || element.closest?.('#divBdy')) return false
    const rect = element.getBoundingClientRect()
    return rect.top >= 0 && rect.top <= 220 && rect.width > 8 && rect.width <= 320 && rect.height > 8 && rect.height <= 70
  }

  function formatSelect () {
    for (const doc of allDocuments()) {
      const selects = Array.from(doc.querySelectorAll('select')).filter(candidateIsSafeToolbarControl)

      for (const select of selects) {
        const labels = Array.from(select.options || []).map((option) => clean(option.text))
        if (labels.some(isHtmlText) && labels.some(isPlainText)) return select
      }
    }

    return null
  }

  function genericPlainFormatControl () {
    const selectors = 'input,button,a,span,div,td,label'
    const candidates = []

    for (const doc of allDocuments()) {
      for (const element of doc.querySelectorAll(selectors)) {
        if (!candidateIsSafeToolbarControl(element)) continue
        const text = elementText(element)
        if (!/^texto\s*simp(?:les)?\.?$/i.test(text) && !/^plain\s*text$/i.test(text)) continue

        const rect = element.getBoundingClientRect()
        const tagBonus = /^(INPUT|BUTTON|A|TD)$/i.test(element.tagName) ? -30 : 0
        const clickBonus = (
          typeof element.onclick === 'function' ||
          element.hasAttribute?.('onclick') ||
          element.hasAttribute?.('_e_onclick') ||
          element.getAttribute?.('role') === 'button'
        ) ? -20 : 0

        candidates.push({
          element,
          score: Math.round(rect.top * 10 + rect.left / 10 + rect.width + tagBonus + clickBonus)
        })
      }
    }

    candidates.sort((a, b) => a.score - b.score)
    return candidates[0]?.element || null
  }

  function formatControl () {
    return formatSelect() || genericPlainFormatControl()
  }

  function deterministicPlainTextEditor () {
    for (const doc of allDocuments()) {
      const bodyContainer = doc.querySelector('#divBdy')
      if (!bodyContainer || bodyContainer.closest?.('#divHdrMessage')) continue

      const textarea = bodyContainer.querySelector('textarea#txtBdy')
      if (textarea && visible(textarea) && !textarea.disabled && !textarea.readOnly) return textarea
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

  function waitFor (getter, timeout = 5000, interval = 90) {
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

  function nativeClick (element) {
    if (!element) return false
    const target = element.closest?.('a,button,input,[role="button"],td') || element
    const view = target.ownerDocument?.defaultView || window

    try { target.focus?.() } catch (_) {}

    const options = { bubbles: true, cancelable: true, view }
    try { target.dispatchEvent(new view.MouseEvent('mousedown', options)) } catch (_) {}
    try { target.dispatchEvent(new view.MouseEvent('mouseup', options)) } catch (_) {}
    try { target.dispatchEvent(new view.MouseEvent('click', options)) } catch (_) {
      try { target.click?.() } catch (_) {}
    }
    return true
  }

  function nativeControlClickTargets (control) {
    const targets = []
    const add = (element) => {
      if (!element || targets.includes(element) || !candidateIsSafeToolbarControl(element)) return
      targets.push(element)
    }

    add(control)
    add(control.closest?.('a,button,input,[role="button"],td'))
    add(control.parentElement)
    add(control.nextElementSibling)
    add(control.parentElement?.nextElementSibling)

    const parent = control.parentElement
    if (parent) {
      Array.from(parent.children || []).forEach((child) => {
        if (child !== control && /^(IMG|A|BUTTON|INPUT|SPAN|DIV|TD)$/i.test(child.tagName)) add(child)
      })
    }

    return targets
  }

  function visibleHtmlMenuOption (origin) {
    const originRect = origin?.getBoundingClientRect?.()
    const candidates = []

    for (const doc of allDocuments()) {
      for (const element of doc.querySelectorAll('a,button,input,span,div,td,li,label')) {
        if (!visible(element) || insideFastMail(element) || element.closest?.('#divBdy')) continue
        if (!/^html$/i.test(elementText(element))) continue

        const rect = element.getBoundingClientRect()
        if (rect.width < 8 || rect.height < 8 || rect.width > 360 || rect.height > 100) continue

        let score = rect.top * 5 + rect.left / 20 + rect.width
        if (originRect) {
          score = Math.abs(rect.left - originRect.left) +
            Math.abs(rect.top - originRect.bottom) * 2 +
            Math.max(0, rect.width - 160)
        }

        if (/^(A|BUTTON|INPUT|TD|LI)$/i.test(element.tagName)) score -= 40
        if (
          typeof element.onclick === 'function' ||
          element.hasAttribute?.('onclick') ||
          element.hasAttribute?.('_e_onclick') ||
          element.getAttribute?.('role') === 'button'
        ) score -= 25

        candidates.push({ element, score })
      }
    }

    candidates.sort((a, b) => a.score - b.score)
    return candidates[0]?.element || null
  }

  async function triggerFormatByNativeUi (control) {
    const targets = nativeControlClickTargets(control)

    for (const target of targets) {
      nativeClick(target)

      const htmlOption = await waitFor(() => visibleHtmlMenuOption(control), 850, 50)
      if (!htmlOption) continue

      nativeClick(htmlOption)

      const editor = await waitFor(deterministicHtmlEditor, 5200, 90)
      if (editor) return editor
    }

    return null
  }

  function dispatch (element, type) {
    const view = element?.ownerDocument?.defaultView || window
    element?.dispatchEvent(new view.Event(type, { bubbles: true, cancelable: true }))
  }

  async function triggerSelectFormatChange (select) {
    const htmlOption = Array.from(select.options || []).find((option) => isHtmlText(option.text))
    if (!htmlOption) return null

    const view = select.ownerDocument?.defaultView || window
    const optionIndex = Array.from(select.options || []).indexOf(htmlOption)

    const apply = () => {
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

      dispatch(select, 'change')
      select.blur?.()
    }

    apply()
    let editor = await waitFor(deterministicHtmlEditor, 1000, 60)
    if (editor) return editor

    apply()
    editor = await waitFor(deterministicHtmlEditor, 4800, 90)
    return editor || null
  }

  async function ensureHtmlComposer () {
    if (preparing) return preparing

    preparing = (async () => {
      lastPrepareAttempt = Date.now()

      const existingEditor = deterministicHtmlEditor()
      if (existingEditor) return true
      if (!deterministicPlainTextEditor()) return false

      const control = await waitFor(formatControl, 1800, 80)
      if (!control) return false

      setStatus('FAST MAIL — preparando e-mail formatado…')

      let editor = null
      if (control.tagName === 'SELECT') {
        editor = await triggerSelectFormatChange(control)
      } else {
        editor = await triggerFormatByNativeUi(control)
        if (!editor) {
          const select = formatSelect()
          if (select) editor = await triggerSelectFormatChange(select)
        }
      }

      if (editor) {
        setStatus('FAST MAIL — e-mail formatado pronto.')
        return true
      }

      return false
    })()

    try {
      return await preparing
    } finally {
      preparing = null
    }
  }

  function isInsertionControl (target) {
    if (!(target instanceof Element)) return null
    return target.closest(
      '#spfm-insert-script, #spfm-insert-requirement, #spfm-insert-process-response, #spfm-baixa-direct-insert, #spfm-workflow-v3-identification-insert'
    )
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

  async function normalizeWhenPanelAppears () {
    if (!fastMailPanelExists()) return false
    if (deterministicHtmlEditor()) return true
    if (!deterministicPlainTextEditor()) return false
    return ensureHtmlComposer()
  }

  document.addEventListener('click', async (event) => {
    const control = isInsertionControl(event.target)
    if (!control) return

    if (bypass.has(control)) {
      bypass.delete(control)
      return
    }

    if (deterministicHtmlEditor()) return
    if (!deterministicPlainTextEditor()) return

    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()

    const ready = await ensureHtmlComposer()
    if (!ready) {
      setStatus('HTML não foi ativado pelo OWA. Inserindo em Texto simples para não bloquear o atendimento.')
    }

    bypass.add(control)
    control.click()
  }, true)

  document.addEventListener('click', (event) => {
    const control = event.target.closest?.(
      '#spfm-priority-missing, #spfm-priority-reply, .spfm-workflow-v3-service-button, [data-spfm-workflow-stage], #spfm-v2-orientation-open, #spfm-v2-identification-open'
    )
    if (!control) return
    window.setTimeout(() => ensureHtmlComposer().catch(() => {}), 80)
  }, true)

  const observer = new MutationObserver(() => {
    if (scheduled) return
    scheduled = true
    window.setTimeout(() => {
      scheduled = false
      formatPendingResponses()
    }, 120)
  })

  observer.observe(document.documentElement, { childList: true, subtree: true })

  window.setInterval(() => {
    formatPendingResponses()
    if (!fastMailPanelExists()) return
    if (deterministicHtmlEditor()) return
    if (!deterministicPlainTextEditor()) return
    if (preparing || Date.now() - lastPrepareAttempt < 2200) return
    ensureHtmlComposer().catch(() => {})
  }, 900)

  window.setTimeout(() => normalizeWhenPanelAppears().catch(() => {}), 250)
  window.setTimeout(() => normalizeWhenPanelAppears().catch(() => {}), 1200)
  window.setTimeout(formatPendingResponses, 400)
})()
