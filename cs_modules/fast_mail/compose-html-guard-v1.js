(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const INSERT_SELECTOR = [
    '#spfm-insert-script',
    '#spfm-insert-requirement',
    '#spfm-insert-process-response'
  ].join(', ')

  const bypass = new WeakSet()
  const running = new WeakSet()

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

  function formatSelect () {
    for (const doc of allDocuments()) {
      const selects = Array.from(doc.querySelectorAll('select')).filter(visible)
      for (const select of selects) {
        const labels = Array.from(select.options || []).map((option) => clean(option.text))
        const hasHtml = labels.some((label) => /^html$/i.test(label))
        const hasPlain = labels.some((label) => /texto\s*simples|plain\s*text/i.test(label))
        if (hasHtml && hasPlain) return select
      }
    }
    return null
  }

  function descriptor (element) {
    return clean([
      element?.id,
      element?.className,
      element?.getAttribute?.('name'),
      element?.getAttribute?.('aria-label'),
      element?.getAttribute?.('title'),
      element?.getAttribute?.('placeholder')
    ].filter(Boolean).join(' ')).toLowerCase()
  }

  function safeHtmlEditor () {
    const candidates = []

    for (const doc of allDocuments()) {
      const elements = Array.from(doc.querySelectorAll('[contenteditable="true"], body[contenteditable="true"]'))
      for (const element of elements) {
        if (!visible(element)) continue
        if (element.closest?.('#spfm-navigation-v2, #sei-protocolistas-fast-mail-status')) continue

        const rect = element.getBoundingClientRect()
        if (rect.width < 300 || rect.height < 80) continue

        const text = descriptor(element)
        if (/(^|\b)(assunto|subject|recipient|destinat|bcc|cc|para|to)(\b|$)/i.test(text)) continue

        candidates.push({ element, score: (rect.width * rect.height) + (element.innerText?.length || 0) })
      }
    }

    candidates.sort((a, b) => b.score - a.score)
    return candidates[0]?.element || null
  }

  function setStatus (message) {
    const targets = [
      document.querySelector('#spfm-script-status'),
      document.querySelector('#spfm-priority-status'),
      document.querySelector('#spfm-v2-status'),
      document.querySelector('#spfm-workflow-v3-status')
    ].filter(Boolean)

    targets.forEach((target) => { target.textContent = message })
  }

  function dispatch (element, type) {
    const view = element?.ownerDocument?.defaultView || window
    element?.dispatchEvent(new view.Event(type, { bubbles: true }))
  }

  function waitFor (getter, timeout = 3500, interval = 100) {
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
    const select = formatSelect()
    if (!select) return Boolean(safeHtmlEditor())

    if (/^html$/i.test(selectedText(select))) {
      return Boolean(await waitFor(() => safeHtmlEditor(), 1800, 80))
    }

    const htmlOption = Array.from(select.options || []).find((option) => /^html$/i.test(clean(option.text)))
    if (!htmlOption) return false

    setStatus('FAST MAIL — PREPARANDO O CORPO DO E-MAIL…')

    select.value = htmlOption.value
    dispatch(select, 'input')
    dispatch(select, 'change')

    const editor = await waitFor(() => {
      if (!/^html$/i.test(selectedText(select))) return null
      return safeHtmlEditor()
    })

    return Boolean(editor)
  }

  document.addEventListener('click', async (event) => {
    const button = event.target?.closest?.(INSERT_SELECTOR)
    if (!button) return

    if (bypass.has(button)) {
      bypass.delete(button)
      return
    }

    const select = formatSelect()
    const plainText = select && /texto\s*simples|plain\s*text/i.test(selectedText(select))
    if (!plainText) return

    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()

    if (running.has(button)) return
    running.add(button)

    try {
      const ready = await ensureHtmlComposer()
      if (!ready) {
        setStatus('SEGURANÇA: não foi possível localizar o corpo correto do e-mail. Nada foi inserido.')
        return
      }

      setStatus('FAST MAIL — CORPO DO E-MAIL PRONTO. INSERINDO RESPOSTA…')
      bypass.add(button)
      button.click()
    } finally {
      running.delete(button)
    }
  }, true)
})()
