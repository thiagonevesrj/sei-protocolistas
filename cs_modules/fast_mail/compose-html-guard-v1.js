(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const bypass = new WeakSet()
  let preparing = null
  let scheduled = false

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
      }, 5500, 100)

      if (editor) setStatus('FAST MAIL — e-mail formatado pronto.')
      return Boolean(editor)
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
      '#spfm-insert-script, #spfm-insert-requirement, #spfm-insert-process-response, #spfm-baixa-direct-insert'
    )
  }

  async function normalizeWhenPanelAppears () {
    const panel = document.querySelector('#sei-protocolistas-fast-mail-status, #spfm-navigation-v2')
    if (!panel) return false

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
    }, 120)
  })

  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.setTimeout(() => normalizeWhenPanelAppears().catch(() => {}), 250)
  window.setTimeout(() => normalizeWhenPanelAppears().catch(() => {}), 900)
})()
