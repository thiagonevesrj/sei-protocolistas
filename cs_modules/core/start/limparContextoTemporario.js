(() => {
  'use strict'

  const browserApi = typeof browser === 'undefined' ? chrome : browser
  const DRAFT_KEY = 'cliqueProtocolistaRascunho'
  const CONTEXT_KEY = 'cliqueProtocolistaContexto'
  const MAX_DRAFT_AGE = 15 * 60 * 1000

  function storageGet (keys) {
    return new Promise((resolve, reject) => {
      const result = browserApi.storage.local.get(keys, (items) => {
        const lastError = browserApi.runtime?.lastError
        if (lastError) reject(lastError)
        else resolve(items)
      })

      if (result && typeof result.then === 'function') {
        result.then(resolve, reject)
      }
    })
  }

  function storageRemove (keys) {
    return new Promise((resolve, reject) => {
      const result = browserApi.storage.local.remove(keys, () => {
        const lastError = browserApi.runtime?.lastError
        if (lastError) reject(lastError)
        else resolve()
      })

      if (result && typeof result.then === 'function') {
        result.then(resolve, reject)
      }
    })
  }

  async function cleanup () {
    try {
      const stored = await storageGet([DRAFT_KEY, CONTEXT_KEY])
      const now = Date.now()
      const keysToRemove = []
      const draft = stored[DRAFT_KEY]
      const context = stored[CONTEXT_KEY]

      if (draft && (!draft.createdAt || now - draft.createdAt > MAX_DRAFT_AGE)) {
        keysToRemove.push(DRAFT_KEY)
      }
      if (context && (!context.expiresAt || now > context.expiresAt)) {
        keysToRemove.push(CONTEXT_KEY)
      }

      if (keysToRemove.length) await storageRemove(keysToRemove)
    } catch (error) {
      console.warn('[SEI Protocolistas] Falha ao limpar dados temporários:', error)
    }
  }

  cleanup()
})()
