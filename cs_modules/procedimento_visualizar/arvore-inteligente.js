(() => {
  'use strict'

  const MENU_ID = 'sp-arvore-context-menu'
  const DIALOG_ID = 'sp-arvore-rename-dialog'
  const TOAST_ID = 'sp-arvore-toast'
  const ACTION_PATTERN = /documento_(?:alterar|alterar_recebido)/i
  const WAIT_TIMEOUT = 7000

  let selectedAnchor = null

  function cleanText (value) {
    return String(value || '').replace(/\s+/g, ' ').trim()
  }

  function normalizeSeiUrl (value) {
    return String(value || '')
      .replace(/\\u0026|\\x26/gi, '&')
      .replace(/\\\//g, '/')
      .replace(/&amp;|&#38;|&#x26;/gi, '&')
      .replace(/&quot;|&#34;|&#x22;/gi, '"')
      .trim()
  }

  function absoluteUrl (value) {
    try {
      return new URL(normalizeSeiUrl(value), window.location.href).href
    } catch (error) {
      return ''
    }
  }

  function documentIdFromUrl (value) {
    try {
      return new URL(absoluteUrl(value)).searchParams.get('id_documento') || ''
    } catch (error) {
      return ''
    }
  }

  function isDocumentAnchor (element) {
    if (!(element instanceof Element)) return null
    const anchor = element.closest('a[target$="Visualizacao"], a[target="ifrVisualizacao"]')
    if (!anchor) return null
    const href = anchor.getAttribute('href') || ''
    if (!documentIdFromUrl(href)) return null
    return anchor
  }

  function hideMenu () {
    document.getElementById(MENU_ID)?.remove()
  }

  function hideDialog () {
    document.getElementById(DIALOG_ID)?.remove()
  }

  function showToast (message, type = '') {
    document.getElementById(TOAST_ID)?.remove()
    const toast = document.createElement('div')
    toast.id = TOAST_ID
    toast.className = type ? `sp-arvore-toast is-${type}` : 'sp-arvore-toast'
    toast.textContent = message
    document.body.appendChild(toast)
    window.setTimeout(() => toast.remove(), 4200)
  }

  function fitToViewport (element, clientX, clientY) {
    const margin = 8
    const rect = element.getBoundingClientRect()
    const left = Math.min(clientX, window.innerWidth - rect.width - margin)
    const top = Math.min(clientY, window.innerHeight - rect.height - margin)
    element.style.left = `${Math.max(margin, left)}px`
    element.style.top = `${Math.max(margin, top)}px`
  }

  function showContextMenu (anchor, event) {
    hideMenu()
    hideDialog()
    selectedAnchor = anchor

    const menu = document.createElement('div')
    menu.id = MENU_ID
    menu.className = 'sp-arvore-context-menu'
    menu.setAttribute('role', 'menu')

    const title = document.createElement('div')
    title.className = 'sp-arvore-context-title'
    title.textContent = cleanText(anchor.textContent) || 'Documento'

    const rename = document.createElement('button')
    rename.type = 'button'
    rename.className = 'sp-arvore-context-action'
    rename.textContent = 'Renomear na árvore…'
    rename.addEventListener('click', (clickEvent) => {
      clickEvent.preventDefault()
      clickEvent.stopPropagation()
      showRenameDialog(anchor, event.clientX, event.clientY)
    })

    menu.append(title, rename)
    document.body.appendChild(menu)
    fitToViewport(menu, event.clientX, event.clientY)
    rename.focus()
  }

  function showRenameDialog (anchor, clientX, clientY) {
    hideMenu()
    hideDialog()

    const dialog = document.createElement('form')
    dialog.id = DIALOG_ID
    dialog.className = 'sp-arvore-rename-dialog'

    const title = document.createElement('strong')
    title.textContent = 'Renomear na Árvore'

    const current = document.createElement('small')
    current.textContent = cleanText(anchor.textContent)

    const input = document.createElement('input')
    input.type = 'text'
    input.maxLength = 100
    input.autocomplete = 'off'
    input.placeholder = 'Ex.: CNH, DUDA, Requerimento'
    input.setAttribute('aria-label', 'Novo nome visível na árvore')

    const actions = document.createElement('div')
    actions.className = 'sp-arvore-rename-actions'

    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = 'sp-arvore-cancel'
    cancel.textContent = 'Cancelar'
    cancel.addEventListener('click', hideDialog)

    const save = document.createElement('button')
    save.type = 'submit'
    save.className = 'sp-arvore-save'
    save.textContent = 'Salvar'

    actions.append(cancel, save)
    dialog.append(title, current, input, actions)
    document.body.appendChild(dialog)
    fitToViewport(dialog, clientX, clientY)

    dialog.addEventListener('submit', async (submitEvent) => {
      submitEvent.preventDefault()
      const newName = cleanText(input.value)
      if (!newName) {
        input.focus()
        return
      }
      save.disabled = true
      cancel.disabled = true
      input.disabled = true
      save.textContent = 'Salvando…'
      const result = await renameDocument(anchor, newName)
      if (!result.ok) {
        save.disabled = false
        cancel.disabled = false
        input.disabled = false
        save.textContent = 'Salvar'
        showToast(result.message, 'error')
        input.focus()
        return
      }
      hideDialog()
      showToast('Nome visível na árvore confirmado pelo SEI. Atualizando o processo…', 'success')
      window.setTimeout(() => window.location.reload(), 500)
    })

    input.focus()
  }

  function collectActionUrls (doc, documentId) {
    const candidates = []

    doc.querySelectorAll('a[href], area[href], form[action]').forEach((element) => {
      const value = element.getAttribute('href') || element.getAttribute('action') || ''
      if (ACTION_PATTERN.test(value)) candidates.push(value)
    })

    const html = doc.documentElement?.innerHTML || ''
    const regex = /(?:https?:\\?\/\\?\/[^'"\s<>]+|controlador\.php\?[^'"\s<>]+)/gi
    let match
    while ((match = regex.exec(html)) !== null) {
      if (ACTION_PATTERN.test(match[0])) candidates.push(match[0])
    }

    return candidates
      .map(absoluteUrl)
      .filter(Boolean)
      .filter((url) => {
        try {
          const parsed = new URL(url)
          const action = parsed.searchParams.get('acao') || ''
          const id = parsed.searchParams.get('id_documento') || ''
          return ACTION_PATTERN.test(action) && (!documentId || id === documentId)
        } catch (error) {
          return false
        }
      })
  }

  function sameOriginFrames (rootWindow) {
    const results = []
    const visit = (candidate) => {
      try {
        if (!candidate || results.includes(candidate)) return
        void candidate.document
        results.push(candidate)
        for (let index = 0; index < candidate.frames.length; index++) visit(candidate.frames[index])
      } catch (error) {}
    }
    visit(rootWindow)
    return results
  }

  function findVisualizationFrame () {
    const frames = sameOriginFrames(window.top)
    return frames.find((frame) => {
      try {
        const element = frame.frameElement
        return frame.name === 'ifrVisualizacao' || element?.name === 'ifrVisualizacao' || element?.id === 'ifrVisualizacao'
      } catch (error) {
        return false
      }
    }) || null
  }

  async function waitFor (test, timeout = WAIT_TIMEOUT) {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeout) {
      try {
        const value = test()
        if (value) return value
      } catch (error) {}
      await new Promise((resolve) => window.setTimeout(resolve, 100))
    }
    return null
  }

  async function resolveNativeEditUrl (anchor) {
    const documentId = documentIdFromUrl(anchor.getAttribute('href') || '')
    if (!documentId) return ''

    for (const frame of sameOriginFrames(window.top)) {
      const urls = collectActionUrls(frame.document, documentId)
      if (urls.length) return urls[0]
    }

    anchor.click()
    const visualFrame = await waitFor(findVisualizationFrame, 2500)
    if (!visualFrame) return ''

    return await waitFor(() => collectActionUrls(visualFrame.document, documentId)[0] || '', 4500) || ''
  }

  function findDocumentNumberField (doc) {
    const direct = Array.from(doc.querySelectorAll('input[type="text"], input:not([type]), textarea')).find((field) => {
      const key = `${field.id || ''} ${field.name || ''}`
      return /(^|[^a-z])numero([^a-z]|$)|(^|[^a-z])n[uú]mero([^a-z]|$)/i.test(key)
    })
    if (direct) return direct

    const labels = Array.from(doc.querySelectorAll('label, td, th, span, div')).filter((element) =>
      /^n[uú]mero\s*:?$/i.test(cleanText(element.textContent))
    )

    for (const label of labels) {
      if (label.htmlFor) {
        const linked = doc.getElementById(label.htmlFor)
        if (linked && /^(INPUT|TEXTAREA)$/.test(linked.tagName)) return linked
      }
      const row = label.closest('tr, .infraTr, .row, .form-group') || label.parentElement
      const fields = Array.from(row?.querySelectorAll?.('input[type="text"], input:not([type]), textarea') || [])
      if (fields.length) return fields[0]
    }
    return null
  }

  function setNativeFieldValue (field, value) {
    const view = field.ownerDocument?.defaultView || window
    const prototype = field.tagName === 'TEXTAREA'
      ? view.HTMLTextAreaElement?.prototype
      : view.HTMLInputElement?.prototype
    const descriptor = prototype && Object.getOwnPropertyDescriptor(prototype, 'value')

    field.focus()
    if (descriptor?.set) descriptor.set.call(field, value)
    else field.value = value

    ;['input', 'change', 'keyup', 'blur'].forEach((eventName) => {
      field.dispatchEvent(new view.Event(eventName, { bubbles: true }))
    })
  }

  function findNativeSaveControl (doc, field) {
    const form = field.closest('form') || doc.querySelector('form')
    if (!form) return null

    const controls = Array.from(form.querySelectorAll('button, input[type="submit"], input[type="button"], a'))
    const preferred = controls.find((control) => {
      const label = cleanText(control.textContent || control.value || control.title || control.getAttribute('aria-label'))
      return /confirmar\s+dados|salvar/i.test(label)
    })
    if (preferred) return preferred

    return controls.find((control) => {
      const label = cleanText(control.textContent || control.value || control.title || control.getAttribute('aria-label'))
      return /^confirmar$/i.test(label)
    }) || null
  }

  function waitForFrameLoad (frame, timeout = WAIT_TIMEOUT) {
    return new Promise((resolve) => {
      let settled = false
      const finish = (value) => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        try { frame.removeEventListener('load', onLoad) } catch (error) {}
        resolve(value)
      }
      const onLoad = () => finish(true)
      const timer = window.setTimeout(() => finish(false), timeout)
      frame.addEventListener('load', onLoad, { once: true })
    })
  }

  function nativePageHasError (doc) {
    const text = cleanText(doc?.body?.innerText)
    if (!text) return false
    return /(?:erro|falha|não foi possível|nao foi possivel|inválid|invalido|exceção|excecao)/i.test(text)
  }

  async function renameDocument (anchor, newName) {
    const editUrl = await resolveNativeEditUrl(anchor)
    if (!editUrl) {
      return { ok: false, message: 'O SEI não disponibilizou a ação nativa de alterar este documento.' }
    }

    const visualFrame = findVisualizationFrame()
    if (!visualFrame) {
      return { ok: false, message: 'Não foi possível localizar a área de visualização do documento no SEI.' }
    }

    visualFrame.location.href = editUrl
    const field = await waitFor(() => {
      try {
        return findDocumentNumberField(visualFrame.document)
      } catch (error) {
        return null
      }
    })

    if (!field) {
      return { ok: false, message: 'A tela nativa abriu, mas o campo “Número” não foi localizado. Nada foi alterado.' }
    }

    setNativeFieldValue(field, newName)

    if (cleanText(field.value) !== newName) {
      return { ok: false, message: 'O SEI não aceitou o novo valor no campo “Número”. Nada foi enviado.' }
    }

    const saveControl = findNativeSaveControl(visualFrame.document, field)
    if (!saveControl) {
      return { ok: false, message: 'O campo “Número” foi localizado, mas o botão nativo de confirmação não foi encontrado. Nada foi enviado.' }
    }

    const loadPromise = waitForFrameLoad(visualFrame)
    saveControl.click()
    const loaded = await loadPromise

    if (!loaded) {
      return { ok: false, message: 'O SEI não confirmou o salvamento do novo nome visível dentro do prazo. O processo não foi recarregado.' }
    }

    try {
      if (nativePageHasError(visualFrame.document)) {
        return { ok: false, message: 'O SEI respondeu com erro ao tentar alterar o nome visível do documento.' }
      }
    } catch (error) {}

    return { ok: true }
  }

  document.addEventListener('contextmenu', (event) => {
    const anchor = isDocumentAnchor(event.target)
    if (!anchor) {
      hideMenu()
      return
    }
    event.preventDefault()
    event.stopPropagation()
    showContextMenu(anchor, event)
  }, true)

  document.addEventListener('click', (event) => {
    const menu = document.getElementById(MENU_ID)
    const dialog = document.getElementById(DIALOG_ID)
    if (menu && !menu.contains(event.target)) hideMenu()
    if (dialog && !dialog.contains(event.target)) hideDialog()
  })

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    hideMenu()
    hideDialog()
  })

  window.addEventListener('blur', hideMenu)
})()
