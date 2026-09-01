(() => {
  'use strict'

  const CONTEXT_KEY = 'cliqueProtocolistaContexto'
  const REGISTRY_KEY = 'fastProcProcessos'
  const PENDING_KEY = 'fastProcRequerimentoPendente'
  const MAX_ACTIVE_CONTEXT_AGE = 2 * 60 * 60 * 1000
  const MAX_PENDING_AGE = 15 * 60 * 1000
  const RESCUE_DELAY = 15500
  const QUICK_REQUEST_LABEL = 'REQUERIMENTO RÁPIDO'
  const QUICK_REQUEST_LOADING_LABEL = 'ABRINDO...'

  const browserApi =
    window.currentBrowser ||
    (typeof chrome !== 'undefined' ? chrome : browser)

  function getAction () {
    return new URLSearchParams(window.location.search).get('acao') || ''
  }

  function storageGet (keys) {
    return new Promise((resolve, reject) => {
      let finished = false
      const finish = (callback, value) => {
        if (finished) return
        finished = true
        callback(value)
      }

      try {
        const result = browserApi.storage.local.get(keys, (items) => {
          const error = browserApi.runtime?.lastError
          if (error) finish(reject, error)
          else finish(resolve, items || {})
        })

        if (result && typeof result.then === 'function') {
          result.then(
            (items) => finish(resolve, items || {}),
            (error) => finish(reject, error)
          )
        }
      } catch (error) {
        finish(reject, error)
      }
    })
  }

  function storageSet (items) {
    return new Promise((resolve, reject) => {
      let finished = false
      const finish = (callback, value) => {
        if (finished) return
        finished = true
        callback(value)
      }

      try {
        const result = browserApi.storage.local.set(items, () => {
          const error = browserApi.runtime?.lastError
          if (error) finish(reject, error)
          else finish(resolve)
        })

        if (result && typeof result.then === 'function') {
          result.then(
            () => finish(resolve),
            (error) => finish(reject, error)
          )
        }
      } catch (error) {
        finish(reject, error)
      }
    })
  }

  function getAvailableUrls () {
    const urls = [window.location.href]

    try {
      if (window.parent && window.parent !== window) {
        urls.push(window.parent.location.href)
      }
    } catch (error) {}

    try {
      if (window.top) urls.push(window.top.location.href)
    } catch (error) {}

    return [...new Set(urls)]
  }

  function extractProcessId () {
    for (const value of getAvailableUrls()) {
      try {
        const url = new URL(value, window.location.href)
        const processId = url.searchParams.get('id_procedimento')
        if (processId) return processId
      } catch (error) {}
    }

    return ''
  }

  function decodeSeiUrl (value) {
    let result = String(value || '')
      .replace(/\\u0026|\\x26/gi, '&')
      .replace(/\\\//g, '/')

    for (let i = 0; i < 3; i++) {
      const previous = result
      result = result
        .replace(/&amp;|&#38;|&#x26;/gi, '&')
        .replace(/&quot;|&#34;|&#x22;/gi, '"')
      if (result === previous) break
    }

    return result
  }

  function extractAttribute (attributes, name) {
    const expression = new RegExp(
      `\\b${name}\\s*=\\s*(["'])(.*?)\\1`,
      'i'
    )
    const match = expression.exec(attributes || '')
    return match ? decodeSeiUrl(match[2]) : ''
  }

  function findPublishedIncludeAction () {
    const scripts = Array.from(document.getElementsByTagName('script'))

    for (const script of scripts) {
      const content = script.innerHTML || script.textContent || ''
      if (!/Nos\[0\]\.acoes/.test(content)) continue

      const anchorRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
      let anchor

      while ((anchor = anchorRegex.exec(content)) !== null) {
        const href = extractAttribute(anchor[1], 'href')
        if (!href || !/acao=documento_escolher_tipo(?:&|$)/i.test(href)) {
          continue
        }

        return {
          href,
          target: extractAttribute(anchor[1], 'target')
        }
      }
    }

    return null
  }

  function findLiveIncludeLink () {
    return Array.from(document.querySelectorAll('a')).find((anchor) => {
      if (anchor.offsetParent === null) return false
      const source = [
        anchor.getAttribute('href'),
        anchor.getAttribute('onclick'),
        anchor.title,
        anchor.querySelector('img')?.title
      ].filter(Boolean).join(' ')
      return /documento_escolher_tipo|incluir documento/i.test(source)
    }) || null
  }

  function findToolbar () {
    return document.querySelector(
      '#divArvoreAcoes.barraBotoesSEI, #divArvoreAcoes'
    )
  }

  function createRqButton () {
    const button = document.createElement('button')
    button.id = 'sp-fast-proc-rq'
    button.type = 'button'
    button.title = 'Requerimento rápido'
    button.setAttribute('aria-label', 'Requerimento rápido')
    button.setAttribute('data-sp-rq-rescue', 'true')

    const bolt = document.createElement('span')
    bolt.className = 'sp-fast-proc-rq__bolt'
    bolt.textContent = '⚡'

    const text = document.createElement('span')
    text.className = 'sp-fast-proc-rq__text'
    text.textContent = QUICK_REQUEST_LABEL

    button.append(bolt, text)
    return button
  }

  function resetRqButton (button) {
    if (!button?.isConnected) return
    button.disabled = false
    button.classList.remove('sp-fast-proc-rq--loading')
    const text = button.querySelector('.sp-fast-proc-rq__text')
    if (text) text.textContent = QUICK_REQUEST_LABEL
  }

  function clickNativeElement (element) {
    element.scrollIntoView({ block: 'center' })
    element.focus?.()
    element.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      view: window
    }))
    element.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      view: window
    }))
    element.click()
  }

  function openPublishedAction (publishedAction) {
    const href = new URL(publishedAction.href, window.location.href).href
    const target = publishedAction.target || 'ifrVisualizacao'

    try {
      const targetFrame = window.parent?.frames?.[target]
      if (targetFrame) {
        targetFrame.location.href = href
        return
      }
    } catch (error) {}

    window.open(href, target)
  }

  function isRecentContext (context) {
    return Boolean(
      context &&
      context.createdAt &&
      Date.now() - context.createdAt <= MAX_ACTIVE_CONTEXT_AGE
    )
  }

  async function rescueRq () {
    if (document.querySelector('#sp-fast-proc-rq')) return

    const processId = extractProcessId()
    if (!processId) return

    const stored = await storageGet([CONTEXT_KEY, REGISTRY_KEY])
    const registry = stored[REGISTRY_KEY] || {}
    const activeContext = stored[CONTEXT_KEY]
    const context =
      registry[processId] ||
      (isRecentContext(activeContext) &&
      (!activeContext.processoId || activeContext.processoId === processId)
        ? activeContext
        : null)

    if (!context) return

    const publishedAction = findPublishedIncludeAction()
    const toolbar = findToolbar()
    if (!publishedAction || !toolbar) {
      console.warn(
        '[FAST PROC RQ] Resgate indisponível: ação ou barra nativa não localizada.'
      )
      return
    }

    if (document.querySelector('#sp-fast-proc-rq')) return

    const button = createRqButton()
    button.addEventListener('click', async () => {
      button.disabled = true
      button.classList.add('sp-fast-proc-rq--loading')
      const text = button.querySelector('.sp-fast-proc-rq__text')
      if (text) text.textContent = QUICK_REQUEST_LOADING_LABEL

      try {
        const now = Date.now()
        const latest = await storageGet([CONTEXT_KEY, REGISTRY_KEY])
        const latestRegistry = latest[REGISTRY_KEY] || registry
        const latestContext =
          latestRegistry[processId] ||
          latest[CONTEXT_KEY] ||
          context

        const nextContext = {
          ...latestContext,
          processoId: processId,
          createdAt: latestContext.createdAt || now,
          expiresAt: now + 60 * 60 * 1000,
          documentoPresencialPendente: true,
          requerimentoRapidoPendente: true
        }

        latestRegistry[processId] = nextContext

        await storageSet({
          [CONTEXT_KEY]: nextContext,
          [REGISTRY_KEY]: latestRegistry,
          [PENDING_KEY]: {
            processoId: processId,
            createdAt: now,
            expiresAt: now + MAX_PENDING_AGE
          }
        })

        const liveLink = findLiveIncludeLink()
        if (liveLink) clickNativeElement(liveLink)
        else openPublishedAction(publishedAction)

        window.setTimeout(() => resetRqButton(button), 12000)
      } catch (error) {
        console.warn('[FAST PROC RQ] Falha no resgate:', error)
        resetRqButton(button)
      }
    })

    const firstAction = toolbar.querySelector('a, button')
    if (firstAction) toolbar.insertBefore(button, firstAction)
    else toolbar.appendChild(button)

    console.info(
      '[FAST PROC RQ] Resgate ativado após o fluxo nativo não inserir o botão.'
    )
  }

  if (getAction() !== 'arvore_visualizar') return

  window.setTimeout(() => {
    rescueRq().catch((error) => {
      console.warn('[FAST PROC RQ] Falha ao executar resgate:', error)
    })
  }, RESCUE_DELAY)
})()
