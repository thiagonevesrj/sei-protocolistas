(() => {
  'use strict'

  if (window.top !== window) return

  const api = typeof browser === 'undefined' ? chrome : browser
  const HANDOFF_KEY = 'fastMailFastProcHandoff'
  const MAX_AGE = 15 * 60 * 1000

  const storageGet = (key) => new Promise((resolve, reject) => {
    const result = api.storage.local.get(key, (items) => {
      const error = api.runtime?.lastError
      if (error) reject(error)
      else resolve(items || {})
    })
    if (result?.then) result.then(resolve, reject)
  })

  function action () {
    return new URLSearchParams(location.search).get('acao') || ''
  }

  function findStartProcessLink () {
    const exact = document.querySelector(
      'a[href*="acao=procedimento_escolher_tipo"],a[href*="acao=procedimento_iniciar"]'
    )
    if (exact) return exact

    return Array.from(document.querySelectorAll('a,button,[role="button"]')).find((element) =>
      /iniciar\s+processo/i.test(String(element.textContent || element.title || ''))
    ) || null
  }

  async function continueHandoff () {
    const handoff = (await storageGet(HANDOFF_KEY))[HANDOFF_KEY]
    if (!handoff || handoff.source !== 'fast-mail') return

    const expired = !handoff.createdAt || Date.now() - handoff.createdAt > MAX_AGE ||
      (handoff.expiresAt && Date.now() > handoff.expiresAt)
    if (expired) return

    if (/\/sip\/login\.php/i.test(location.pathname)) return
    if (['procedimento_escolher_tipo', 'procedimento_gerar'].includes(action())) return

    const start = findStartProcessLink()
    if (start) {
      start.click()
      return
    }

    const observer = new MutationObserver(() => {
      const link = findStartProcessLink()
      if (!link) return
      observer.disconnect()
      link.click()
    })

    observer.observe(document.documentElement, { childList: true, subtree: true })
    window.setTimeout(() => observer.disconnect(), 15000)
  }

  continueHandoff().catch((error) => {
    console.error('[SEI Protocolistas] Falha ao localizar Iniciar Processo:', error)
  })
})()
