(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const bypass = new WeakSet()
  let preparing = null

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
    return await waitFor(deterministicHtmlEditor, 4800, 90)
  }

  async function ensureHtmlComposer () {
    if (preparing) return preparing

    preparing = (async () => {
      const existingEditor = deterministicHtmlEditor()
      if (existingEditor) return true
      if (!deterministicPlainTextEditor()) return false

      setStatus('FAST MAIL — preparando e-mail formatado…')

      // Caminho principal validado: reproduzir a interação humana do OWA.
      const nativeControl = await waitFor(genericPlainFormatControl, 1800, 80)
      if (nativeControl) {
        const nativeEditor = await triggerFormatByNativeUi(nativeControl)
        if (nativeEditor) {
          setStatus('FAST MAIL — e-mail formatado pronto.')
          return true
        }
      }

      // Fallback de segurança documentado: nunca é o caminho principal.
      const select = formatSelect()
      if (select) {
        if (isHtmlText(selectedText(select))) {
          const editor = await waitFor(deterministicHtmlEditor, 1800, 80)
          if (editor) return true
        } else if (isPlainText(selectedText(select))) {
          const editor = await triggerSelectFormatChange(select)
          if (editor) {
            setStatus('FAST MAIL — e-mail formatado pronto.')
            return true
          }
        }
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

  // ÚNICO gatilho de preparação HTML: o clique final de inserção.
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
})()
