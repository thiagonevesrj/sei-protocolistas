(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const DOUBLE_CLICK_WINDOW = 1500
  const recentInsertions = new WeakMap()
  const currentResponses = new WeakSet()

  function bodyContent (editor) {
    return editor.tagName === 'TEXTAREA' ? editor.value : editor.innerHTML
  }

  // Estado efêmero do editor atual. Nunca deduzir atendimento pelo histórico.
  function isDuplicate (editor, responseHtml) {
    const recent = recentInsertions.get(editor)
    return Boolean(recent && recent.html === responseHtml &&
      Date.now() - recent.at < DOUBLE_CLICK_WINDOW &&
      recent.content === bodyContent(editor))
  }

  function releaseHistoricalMarkers (editor) {
    editor.querySelectorAll?.('[data-sei-protocolistas]').forEach((node) => {
      node.removeAttribute('data-sei-protocolistas')
      node.removeAttribute('data-script-id')
    })
  }

  function recordInsertion (editor, responseHtml) {
    recentInsertions.set(editor, { html: responseHtml, at: Date.now(), content: bodyContent(editor) })
    editor.querySelectorAll?.('[data-sei-protocolistas]').forEach((node) => currentResponses.add(node))
  }

  function recordPresentation (editor, previousContent) {
    const recent = recentInsertions.get(editor)
    if (recent && recent.content === previousContent) recent.content = bodyContent(editor)
  }

  window.spFastMailRepeatGuard = {
    isDuplicate,
    releaseHistoricalMarkers,
    recordInsertion,
    recordPresentation,
    isCurrentResponse: (node) => currentResponses.has(node)
  }
})()
