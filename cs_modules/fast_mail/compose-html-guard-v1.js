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
        const hasHtml = labels.some(isHtmlText)
        const hasPlain = labels.some(isPlainText)
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
      if (doc.designMode?.toLowerCase() === 'on' && doc.body) elements.push(doc.body)

      for (const element of elements) {
        if (!visible(element)) continue
        if (element.closest?.('#spfm-navigation-v2, #sei-protocolistas-fast-mail-status')) continue
        if (element.matches?.('input,textarea')) continue

        const rect = element.getBoundingClientRect()
        const area = rect.width * rect.height
        if (rect.width < 300 || rect.height < 80 || area < 24000) continue

        const text = descriptor(element)
        if (/(^|\b)(assunto|subject|recipient|destinat|bcc|cc|para|to)(\b|$)/i.test(text)) continue

        candidates.push({
          element,
          score: area + (element.innerText?.length || 0)
        })
      }
    }

    candidates.sort((a, b) => b.score - a.score)
    return candidates[0]?.element || null
  }

  function fastMailTarget (target) {
    if (!(target instanceof Element)) return null
    return target.closest('#sei-protocolistas-fast-mail-status, #spfm-navigation-v2, [id^="spfm-"]')
  }

  function setStatus (message) {
    const targets = [
      document.querySelector('#spfm-script-status'),
      document.querySelector('#spfm-priority-status'),
      document.querySelector('#spfm-v2-status'),
      document.querySelector('#spfm-workflow-v3-status'),
      document.querySelector('#spfm-body-status')
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
        return Boolean(await waitFor(() => safeHtmlEditor(), 1800, 80))
      }

      if (isHtmlText(selectedText(select))) {
        return Boolean(await waitFor(() => safeHtmlEditor(), 2200, 80))
      }

      const htmlOption = Array.from(select.options || []).find((option) => isHtmlText(option.text))
      if (!htmlOption) return false

      setStatus('FAST MAIL — PREPARANDO O EDITOR DO E-MAIL…')

      select.focus?.()
      select.value = htmlOption.value
      select.selectedIndex = Array.from(select.options || []).indexOf(htmlOption)
      dispatch(select, 'input')
      dispatch(select, 'change')
      select.blur?.()

      const editor = await waitFor(() => {
        if (!isHtmlText(selectedText(select))) return null
        return safeHtmlEditor()
      }, 5000, 100)

      if (editor) setStatus('FAST MAIL — EDITOR PRONTO.')
      return Boolean(editor)
    })()

    try {
      return await preparing
    } finally {
      preparing = null
    }
  }

  async function normalizeWhenPanelAppears () {
    const panel = document.querySelector('#sei-protocolistas-fast-mail-status, #spfm-navigation-v2')
    if (!panel) return false

    const select = formatSelect()
    if (!select || !isPlainText(selectedText(select))) return true

    return ensureHtmlComposer()
  }

  document.addEventListener('click', async (event) => {
    const control = event.target?.closest?.('button,a,input,label,[role="button"]')
    if (!control || !fastMailTarget(control)) return

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
      setStatus('SEGURANÇA: não foi possível preparar o corpo correto do e-mail. A ação foi bloqueada.')
      return
    }

    bypass.add(control)
    control.click()
  }, true)

  let scheduled = false
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
