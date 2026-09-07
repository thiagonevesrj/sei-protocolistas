(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const INSERT_SELECTOR = [
    '#spfm-insert-script',
    '#spfm-insert-requirement',
    '#spfm-insert-process-response',
    '#spfm-baixa-direct-insert',
    '#spfm-workflow-v3-identification-insert'
  ].join(', ')

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

  function insideFastMail (element) {
    return Boolean(element?.closest?.(
      '#sei-protocolistas-fast-mail-status, #spfm-navigation-v2, #spfm-workflow-v3'
    ))
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

  function bodyContainerIn (doc) {
    const container = doc.querySelector('#divBdy')
    if (!container || container.closest?.('#divHdrMessage')) return null
    return container
  }

  function plainTextEditor () {
    for (const doc of allDocuments()) {
      const container = bodyContainerIn(doc)
      if (!container) continue
      const textarea = container.querySelector('textarea#txtBdy')
      if (textarea && visible(textarea) && !textarea.disabled && !textarea.readOnly) return textarea
    }
    return null
  }

  function htmlEditor () {
    for (const doc of allDocuments()) {
      const container = bodyContainerIn(doc)
      if (!container) continue
      const frame = container.querySelector('iframe#ifBdy')
      if (!frame || !visible(frame)) continue

      try {
        const htmlDocument = frame.contentDocument
        const body = htmlDocument?.body
        const editable = htmlDocument?.designMode?.toLowerCase() === 'on' ||
          body?.isContentEditable ||
          body?.getAttribute?.('contenteditable') === 'true'
        if (body && editable) return body
      } catch (_) {}
    }
    return null
  }

  function formatSelect () {
    const candidates = []

    for (const doc of allDocuments()) {
      for (const select of doc.querySelectorAll('select')) {
        if (!visible(select) || insideFastMail(select) || select.closest?.('#divBdy')) continue

        const labels = Array.from(select.options || []).map((option) => clean(option.text))
        if (!labels.some(isHtmlText) || !labels.some(isPlainText)) continue

        const rect = select.getBoundingClientRect()
        if (rect.top < 0 || rect.top > 240 || rect.width < 20 || rect.width > 360) continue
        candidates.push(select)
      }
    }

    return candidates[0] || null
  }

  function setStatus (message) {
    ;[
      '#spfm-script-status',
      '#spfm-priority-status',
      '#spfm-v2-status',
      '#spfm-workflow-v3-status',
      '#spfm-body-status',
      '#spfm-process-response-status'
    ].forEach((selector) => {
      const target = document.querySelector(selector)
      if (target) target.textContent = message
    })
  }

  function waitForEditorState (timeout = 5200, interval = 80) {
    return new Promise((resolve) => {
      const started = Date.now()
      const timer = window.setInterval(() => {
        const html = htmlEditor()
        if (html) {
          window.clearInterval(timer)
          resolve('html')
          return
        }

        if (Date.now() - started >= timeout) {
          window.clearInterval(timer)
          resolve(plainTextEditor() ? 'plain' : 'none')
        }
      }, interval)
    })
  }

  async function activateHtmlOnce () {
    if (htmlEditor()) return 'html'
    if (!plainTextEditor()) return 'none'

    const select = formatSelect()
    if (!select) return 'plain'

    if (isHtmlText(selectedText(select))) {
      return await waitForEditorState(2400, 80)
    }

    if (!isPlainText(selectedText(select))) return 'plain'

    const options = Array.from(select.options || [])
    const htmlOption = options.find((option) => isHtmlText(option.text))
    if (!htmlOption) return 'plain'

    const htmlIndex = options.indexOf(htmlOption)
    const view = select.ownerDocument?.defaultView || window

    setStatus('FAST MAIL — ativando HTML no OWA…')

    // UMA única transição. O OWA legado já possui o handler responsável por
    // trocar textarea#txtBdy pelo iframe#ifBdy. Não disparamos input, não
    // repetimos change e não fazemos nova tentativa automática.
    select.focus?.()
    htmlOption.selected = true
    select.value = htmlOption.value
    if (htmlIndex >= 0) select.selectedIndex = htmlIndex

    if (typeof select.onchange === 'function') {
      try {
        select.onchange.call(
          select,
          new view.Event('change', { bubbles: true, cancelable: true })
        )
      } catch (_) {
        return 'plain'
      }
    } else {
      try {
        select.dispatchEvent(new view.Event('change', { bubbles: true, cancelable: true }))
      } catch (_) {
        return 'plain'
      }
    }

    return await waitForEditorState()
  }

  document.addEventListener('click', async (event) => {
    const button = event.target?.closest?.(INSERT_SELECTOR)
    if (!button) return

    if (bypass.has(button)) {
      bypass.delete(button)
      return
    }

    if (htmlEditor()) return
    if (!plainTextEditor()) return

    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()

    if (preparing) return
    preparing = button

    try {
      const state = await activateHtmlOnce()

      if (state === 'html') {
        setStatus('FAST MAIL — HTML ativo. Inserindo resposta…')
      } else if (state === 'plain') {
        setStatus('OWA permaneceu em Texto simples. Inserindo com segurança.')
      } else {
        setStatus('SEGURANÇA: o corpo do e-mail não ficou disponível. Nada foi inserido.')
        return
      }

      bypass.add(button)
      button.click()
    } finally {
      preparing = null
    }
  }, true)
})()
