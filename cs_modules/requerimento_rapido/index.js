(() => {
  'use strict'

  const CONTEXT_KEY = 'cliqueProtocolistaContexto'
  const REGISTRY_KEY = 'fastProcProcessos'
  const PENDING_KEY = 'fastProcRequerimentoPendente'

  const MAX_ACTIVE_CONTEXT_AGE = 2 * 60 * 60 * 1000
  const MAX_REGISTRY_AGE = 180 * 24 * 60 * 60 * 1000
  const MAX_PENDING_AGE = 15 * 60 * 1000
  const QUICK_REQUEST_LABEL = 'REQUERIMENTO RÁPIDO'
  const QUICK_REQUEST_LOADING_LABEL = 'ABRINDO...'

  const browserApi =
    window.currentBrowser ||
    (typeof chrome !== 'undefined' ? chrome : browser)

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function getAction() {
    return new URLSearchParams(
      window.location.search
    ).get('acao') || ''
  }

  function storageGet(keys) {
    return new Promise((resolve, reject) => {
      let finished = false

      const finish = (callback, value) => {
        if (finished) return
        finished = true
        callback(value)
      }

      try {
        const result =
          browserApi.storage.local.get(
            keys,
            (items) => {
              const error =
                browserApi.runtime?.lastError

              if (error) {
                finish(reject, error)
              } else {
                finish(resolve, items || {})
              }
            }
          )

        if (
          result &&
          typeof result.then === 'function'
        ) {
          result.then(
            (items) =>
              finish(resolve, items || {}),
            (error) =>
              finish(reject, error)
          )
        }
      } catch (error) {
        finish(reject, error)
      }
    })
  }

  function storageSet(items) {
    return new Promise((resolve, reject) => {
      let finished = false

      const finish = (callback, value) => {
        if (finished) return
        finished = true
        callback(value)
      }

      try {
        const result =
          browserApi.storage.local.set(
            items,
            () => {
              const error =
                browserApi.runtime?.lastError

              if (error) {
                finish(reject, error)
              } else {
                finish(resolve)
              }
            }
          )

        if (
          result &&
          typeof result.then === 'function'
        ) {
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

  function storageRemove(keys) {
    return new Promise((resolve, reject) => {
      let finished = false

      const finish = (callback, value) => {
        if (finished) return
        finished = true
        callback(value)
      }

      try {
        const result =
          browserApi.storage.local.remove(
            keys,
            () => {
              const error =
                browserApi.runtime?.lastError

              if (error) {
                finish(reject, error)
              } else {
                finish(resolve)
              }
            }
          )

        if (
          result &&
          typeof result.then === 'function'
        ) {
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

  function waitFor(
    testFunction,
    timeout = 10000,
    interval = 250
  ) {
    const startedAt = Date.now()

    return new Promise((resolve, reject) => {
      const check = () => {
        let result = null

        try {
          result = testFunction()
        } catch (error) {
          result = null
        }

        if (result) {
          resolve(result)
          return
        }

        if (Date.now() - startedAt >= timeout) {
          reject(
            new Error(
              'O SEI não respondeu dentro do prazo.'
            )
          )
          return
        }

        window.setTimeout(check, interval)
      }

      check()
    })
  }

  function getAvailableUrls() {
    const urls = [window.location.href]

    try {
      if (
        window.parent &&
        window.parent !== window
      ) {
        urls.push(window.parent.location.href)
      }
    } catch (error) {}

    try {
      if (window.top) {
        urls.push(window.top.location.href)
      }
    } catch (error) {}

    return [...new Set(urls)]
  }

  function extractProcessId(extraUrl = '') {
    const urls = [
      extraUrl,
      ...getAvailableUrls()
    ].filter(Boolean)

    for (const value of urls) {
      try {
        const url = new URL(
          value,
          window.location.href
        )

        const processId =
          url.searchParams.get(
            'id_procedimento'
          )

        if (processId) {
          return processId
        }
      } catch (error) {}
    }

    return ''
  }

  function describeAnchor(anchor) {
    const image = anchor?.querySelector('img')

    return normalize([
      anchor?.textContent,
      anchor?.innerText,
      anchor?.title,
      anchor?.getAttribute('aria-label'),
      anchor?.getAttribute('href'),
      anchor?.getAttribute('onclick'),
      image?.alt,
      image?.title,
      image?.getAttribute('src')
    ].join(' '))
  }

  function findProcessToolbar() {
    const candidates = []

    Array.from(
      document.querySelectorAll(
        'div, td, span, nav'
      )
    ).forEach((container) => {
      if (container.offsetParent === null) {
        return
      }

      const anchors = Array.from(
        container.querySelectorAll('a')
      ).filter((anchor) => {
        return (
          anchor.offsetParent !== null &&
          anchor.querySelector('img')
        )
      })

      if (
        anchors.length < 8 ||
        anchors.length > 45
      ) {
        return
      }

      const rectangle =
        container.getBoundingClientRect()

      if (
        rectangle.width < 300 ||
        rectangle.height > 100
      ) {
        return
      }

      candidates.push({
        container,
        anchors,
        rectangle
      })
    })

    candidates.sort((first, second) => {
      if (
        first.rectangle.height !==
        second.rectangle.height
      ) {
        return (
          first.rectangle.height -
          second.rectangle.height
        )
      }

      return (
        second.anchors.length -
        first.anchors.length
      )
    })

    return candidates[0] || null
  }

  function findIncludeDocumentLink() {
    const anchors = Array.from(
      document.querySelectorAll('a')
    ).filter(
      (anchor) =>
        anchor.offsetParent !== null
    )

    const exactMatch = anchors.find(
      (anchor) => {
        const description =
          describeAnchor(anchor)

        return (
          description.includes(
            'documento escolher tipo'
          ) ||
          description.includes(
            'incluir documento'
          )
        )
      }
    )

    if (exactMatch) {
      return exactMatch
    }

    const toolbar =
      findProcessToolbar()

    return toolbar?.anchors[0] || null
  }

  function extractProcessIdFromElement(element) {
    const source = [
      element?.getAttribute?.('href'),
      element?.getAttribute?.('onclick'),
      window.location.href
    ].filter(Boolean).join(' ')

    const match = source.match(
      /id_procedimento(?:=|%3D)(\d+)/i
    )

    if (match) {
      return match[1]
    }

    return extractProcessId(
      element?.href || ''
    )
  }

  function isRecentContext(context) {
    return Boolean(
      context &&
      context.createdAt &&
      Date.now() - context.createdAt <=
        MAX_ACTIVE_CONTEXT_AGE
    )
  }

  function cleanRegistry(registry) {
    const cleaned = {}
    const now = Date.now()

    Object.entries(registry || {})
      .forEach(([processId, context]) => {
        if (
          context &&
          context.createdAt &&
          now - context.createdAt <=
            MAX_REGISTRY_AGE
        ) {
          cleaned[processId] = context
        }
      })

    return cleaned
  }

  async function getFastProcContext(
    processId
  ) {
    const stored = await storageGet([
      CONTEXT_KEY,
      REGISTRY_KEY
    ])

    const activeContext =
      stored[CONTEXT_KEY]

    const registry = cleanRegistry(
      stored[REGISTRY_KEY] || {}
    )

    let context = registry[processId]

    if (
      !context &&
      isRecentContext(activeContext) &&
      (
        !activeContext.processoId ||
        activeContext.processoId === processId
      )
    ) {
      context = {
        ...activeContext,
        processoId: processId,
        expiresAt:
          Date.now() + 60 * 60 * 1000
      }

      registry[processId] = context

      await storageSet({
        [CONTEXT_KEY]: context,
        [REGISTRY_KEY]: registry
      })
    } else {
      await storageSet({
        [REGISTRY_KEY]: registry
      })
    }

    return {
      context,
      registry
    }
  }

  function createRqButton() {
    const button =
      document.createElement('button')

    button.id = 'sp-fast-proc-rq'
    button.type = 'button'
    button.title = 'Requerimento rápido'
    button.setAttribute(
      'aria-label',
      'Requerimento rápido'
    )

    const bolt =
      document.createElement('span')

    bolt.className =
      'sp-fast-proc-rq__bolt'
    bolt.textContent = '⚡'

    const text =
      document.createElement('span')

    text.className =
      'sp-fast-proc-rq__text'
    text.textContent = QUICK_REQUEST_LABEL

    button.append(bolt, text)

    return button
  }

  function resetRqButton (button) {
    if (!button?.isConnected) {
      return
    }

    button.disabled = false

    button.classList.remove(
      'sp-fast-proc-rq--loading'
    )

    button.querySelector(
      '.sp-fast-proc-rq__text'
    ).textContent = QUICK_REQUEST_LABEL
  }

  function removeDuplicateRqButtons () {
    const buttons = Array.from(
      document.querySelectorAll(
        '#sp-fast-proc-rq'
      )
    )

    buttons.slice(1).forEach((button) => {
      button.remove()
    })
  }

  function clickNativeElement(element) {
    if (!element) {
      throw new Error(
        'O botão nativo Incluir Documento não foi localizado.'
      )
    }

    element.scrollIntoView({
      block: 'center'
    })

    element.focus?.()

    element.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window
      })
    )

    element.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window
      })
    )

    element.click()
  }

  async function insertRqButton() {
    if (
      document.querySelector(
        '#sp-fast-proc-rq'
      )
    ) {
      return
    }

    const currentProcessId =
      extractProcessId()

    let context = null
    let registry = null

    if (currentProcessId) {
      const fastProcData =
        await getFastProcContext(
          currentProcessId
        )

      context = fastProcData.context
      registry = fastProcData.registry

      if (!context) {
        console.log(
          '[FAST PROC RQ] Processo não identificado como FAST PROC.'
        )
        return
      }
    }

    const target = await waitFor(
      () => {
        const includeLink =
          findIncludeDocumentLink()

        if (!includeLink) {
          return null
        }

        return {
          includeLink,
          parent:
            includeLink.parentElement
        }
      },
      15000,
      250
    )

    const includeLink =
      target.includeLink

    const processId =
      currentProcessId ||
      extractProcessIdFromElement(
        includeLink
      )

    if (!processId) {
      console.warn(
        '[FAST PROC RQ] ID do processo não localizado.'
      )
      return
    }

    if (!context || !registry) {
      const fastProcData =
        await getFastProcContext(
          processId
        )

      context = fastProcData.context
      registry = fastProcData.registry
    }

    if (!context) {
      console.log(
        '[FAST PROC RQ] Processo não identificado como FAST PROC.'
      )
      return
    }

    /*
     * Duas cópias da extensão podem iniciar a busca ao mesmo tempo.
     * Revalidar aqui evita que ambas insiram o botão após o waitFor.
     */
    if (
      document.querySelector(
        '#sp-fast-proc-rq'
      )
    ) {
      removeDuplicateRqButtons()
      return
    }

    const button =
      createRqButton()

    browserApi.storage?.onChanged
      ?.addListener((changes, areaName) => {
        if (
          areaName === 'local' &&
          changes[PENDING_KEY] &&
          !changes[PENDING_KEY].newValue
        ) {
          resetRqButton(button)
        }
      })

    button.addEventListener(
      'click',
      async () => {
        button.disabled = true

        button.classList.add(
          'sp-fast-proc-rq--loading'
        )

        button.querySelector(
          '.sp-fast-proc-rq__text'
        ).textContent =
          QUICK_REQUEST_LOADING_LABEL

        try {
          const now = Date.now()

          const activeContext = {
            ...context,
            processoId: processId,
            createdAt:
              context.createdAt || now,
            expiresAt:
              now + 60 * 60 * 1000,
            documentoPresencialPendente:
              true,
            requerimentoRapidoPendente:
              true
          }

          registry[processId] =
            activeContext

          await storageSet({
            [CONTEXT_KEY]:
              activeContext,
            [REGISTRY_KEY]:
              registry,
            [PENDING_KEY]: {
              processoId: processId,
              createdAt: now,
              expiresAt:
                now + MAX_PENDING_AGE
            }
          })

          clickNativeElement(
            includeLink
          )

          window.setTimeout(
            () => resetRqButton(button),
            12000
          )
        } catch (error) {
          console.error(
            '[FAST PROC RQ] Falha ao abrir Requerimento:',
            error
          )

          window.alert(
            `FAST PROC RQ: ${
              error.message || error
            }`
          )

          resetRqButton(button)
        }
      }
    )

    target.parent.insertBefore(
      button,
      includeLink
    )

    removeDuplicateRqButtons()
  }

  function findExternalOption() {
    const candidates = Array.from(
      document.querySelectorAll(
        'a, button, [role="button"], ' +
        '[onclick], [data-url]'
      )
    )

    return candidates.find(
      (element) =>
        normalize(
          element.textContent ||
          element.innerText ||
          ''
        ) === 'externo'
    ) || null
  }

  async function openExternalDocument() {
    const stored = await storageGet(
      PENDING_KEY
    )

    const pending =
      stored[PENDING_KEY]

    if (
      !pending ||
      !pending.createdAt ||
      Date.now() > pending.expiresAt
    ) {
      if (pending) {
        await storageRemove(
          PENDING_KEY
        )
      }

      return
    }

    const currentProcessId =
      extractProcessId()

    if (
      currentProcessId &&
      pending.processoId &&
      currentProcessId !==
        pending.processoId
    ) {
      return
    }

    const externalOption =
      await waitFor(
        findExternalOption,
        10000,
        250
      )

    externalOption.scrollIntoView({
      block: 'center'
    })

    externalOption.focus?.()

    externalOption.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window
      })
    )

    externalOption.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window
      })
    )

    externalOption.click()
  }

  async function finishRequestFlow() {
    const stored = await storageGet(
      PENDING_KEY
    )

    const pending =
      stored[PENDING_KEY]

    if (!pending) {
      return
    }

    window.setTimeout(() => {
      storageRemove(PENDING_KEY)
        .catch((error) => {
          console.warn(
            '[FAST PROC RQ] Falha ao limpar fluxo:',
            error
          )
        })
    }, 8000)
  }

  const action = getAction()

  const duplicateObserver =
    new MutationObserver(
      removeDuplicateRqButtons
    )

  duplicateObserver.observe(
    document.documentElement,
    {
      childList: true,
      subtree: true
    }
  )

  if (action === 'arvore_visualizar') {
    insertRqButton().catch((error) => {
      console.warn(
        '[FAST PROC RQ] Botão não inserido:',
        error
      )
    })
  }

  if (
    action === 'documento_escolher_tipo'
  ) {
    openExternalDocument().catch(
      (error) => {
        console.error(
          '[FAST PROC RQ] Falha ao escolher Externo:',
          error
        )

        window.alert(
          `FAST PROC RQ: ${
            error.message || error
          }`
        )
      }
    )
  }

  /*
   * A pendência do RQ é removida somente depois que
   * o autopreenchimento do documento for concluído.
   */
})()
