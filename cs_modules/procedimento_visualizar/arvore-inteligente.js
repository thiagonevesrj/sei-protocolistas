(() => {
  'use strict'

  const MENU_ID = 'sp-arvore-context-menu'
  const TOAST_ID = 'sp-arvore-toast'
  const WAIT_TIMEOUT = 7000

  function cleanText (value) {
    return String(value || '').replace(/\s+/g, ' ').trim()
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

  function hideMenu () {
    document.getElementById(MENU_ID)?.remove()
  }

  function fitToViewport (element, clientX, clientY) {
    const margin = 8
    const rect = element.getBoundingClientRect()
    const left = Math.min(clientX, window.innerWidth - rect.width - margin)
    const top = Math.min(clientY, window.innerHeight - rect.height - margin)
    element.style.left = `${Math.max(margin, left)}px`
    element.style.top = `${Math.max(margin, top)}px`
  }

  function absoluteUrl (value) {
    try {
      return new URL(String(value || '').replace(/&amp;/gi, '&'), window.location.href).href
    } catch (error) {
      return ''
    }
  }

  function documentAnchorFromTarget (target) {
    if (!(target instanceof Element)) return null
    const anchor = target.closest('a[target$="Visualizacao"], a[target="ifrVisualizacao"]')
    if (!anchor) return null
    const href = anchor.getAttribute('href') || ''
    if (!/id_documento=/i.test(href)) return null
    return anchor
  }

  function protocolNumberFromAnchor (anchor) {
    const text = cleanText(anchor?.textContent)
    const match = text.match(/\((\d{5,})\)\s*$/)
    return match?.[1] || ''
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
    return sameOriginFrames(window.top).find((frame) => {
      try {
        const element = frame.frameElement
        return frame.name === 'ifrVisualizacao' || element?.name === 'ifrVisualizacao' || element?.id === 'ifrVisualizacao'
      } catch (error) {
        return false
      }
    }) || null
  }

  async function waitFor (getter, timeout = WAIT_TIMEOUT, interval = 100) {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeout) {
      try {
        const value = getter()
        if (value) return value
      } catch (error) {}
      await new Promise((resolve) => window.setTimeout(resolve, interval))
    }
    return null
  }

  function elementLabel (element) {
    return cleanText([
      element?.textContent,
      element?.value,
      element?.title,
      element?.getAttribute?.('aria-label'),
      element?.querySelector?.('img')?.alt,
      element?.querySelector?.('img')?.title
    ].filter(Boolean).join(' '))
  }

  function findNativeOrderControl () {
    for (const frame of sameOriginFrames(window.top)) {
      const doc = frame.document
      const controls = Array.from(doc.querySelectorAll('a,button,input[type="button"],input[type="submit"],area'))
      const match = controls.find((control) => {
        const label = elementLabel(control)
        const href = control.getAttribute?.('href') || ''
        const onclick = control.getAttribute?.('onclick') || ''
        return /ordenar\s+[áa]rvore(?:\s+do\s+processo)?/i.test(label) ||
          /ordenar.*arvore|arvore.*ordenar/i.test(`${href} ${onclick}`)
      })
      if (match) return { frame, control: match }
    }
    return null
  }

  function clickNativeControl (control) {
    if (!control) return false
    const target = control.closest?.('a,button,input,area') || control
    target.focus?.()
    target.click?.()
    return true
  }

  function findOrderList (doc) {
    const selects = Array.from(doc.querySelectorAll('select'))
    return selects.find((select) => {
      const label = cleanText(`${select.id || ''} ${select.name || ''} ${select.getAttribute('aria-label') || ''}`)
      if (/protocol|document|arvore/i.test(label)) return true
      return Array.from(select.options || []).some((option) => /\(\d{5,}\)/.test(cleanText(option.textContent)))
    }) || null
  }

  function selectTargetProtocol (select, anchor) {
    const protocolNumber = protocolNumberFromAnchor(anchor)
    const anchorText = cleanText(anchor.textContent).replace(/\s*\(\d{5,}\)\s*$/, '').toLowerCase()
    const options = Array.from(select.options || [])

    let option = protocolNumber
      ? options.find((candidate) => cleanText(candidate.textContent).includes(protocolNumber))
      : null

    if (!option && anchorText) {
      option = options.find((candidate) => cleanText(candidate.textContent).toLowerCase().includes(anchorText))
    }

    if (!option) return false

    select.value = option.value
    option.selected = true
    const view = select.ownerDocument.defaultView || window
    select.dispatchEvent(new view.Event('change', { bubbles: true }))
    select.dispatchEvent(new view.Event('click', { bubbles: true }))
    return true
  }

  function findMoveControl (doc, direction) {
    const controls = Array.from(doc.querySelectorAll('a,button,input[type="button"],input[type="submit"],area,img'))
    const regex = direction === 'up'
      ? /mover\s+acima\s+protocolo\s+selecionado|mover\s+para\s+cima|acima\s+protocolo/i
      : /mover\s+abaixo\s+protocolo\s+selecionado|mover\s+para\s+baixo|abaixo\s+protocolo/i

    const direct = controls.find((control) => regex.test(elementLabel(control)))
    if (!direct) return null
    return direct.closest?.('a,button,input,area') || direct
  }

  function findSaveControl (doc) {
    const controls = Array.from(doc.querySelectorAll('a,button,input[type="button"],input[type="submit"],area'))
    return controls.find((control) => /^salvar$/i.test(elementLabel(control))) || null
  }

  function isOrderScreen (doc) {
    const text = cleanText(doc?.body?.innerText)
    return /ordenar\s+[áa]rvore\s+do\s+processo/i.test(text) ||
      /mover\s+(?:acima|abaixo)\s+protocolo\s+selecionado/i.test(text)
  }

  async function moveDocument (anchor, direction) {
    const native = findNativeOrderControl()
    if (!native) {
      return { ok: false, message: 'O SEI não disponibilizou “Ordenar Árvore do Processo” para este perfil ou processo.' }
    }

    clickNativeControl(native.control)

    const visualFrame = await waitFor(findVisualizationFrame, 2500)
    if (!visualFrame) {
      return { ok: false, message: 'Não consegui localizar a tela nativa de ordenação do SEI.' }
    }

    const orderDoc = await waitFor(() => {
      try {
        return isOrderScreen(visualFrame.document) ? visualFrame.document : null
      } catch (error) {
        return null
      }
    }, 5000)

    if (!orderDoc) {
      return { ok: false, message: 'A tela “Ordenar Árvore do Processo” não abriu como esperado.' }
    }

    const list = findOrderList(orderDoc)
    if (!list) {
      return { ok: false, message: 'A lista de protocolos da ordenação não foi localizada.' }
    }

    if (!selectTargetProtocol(list, anchor)) {
      return { ok: false, message: 'O documento selecionado não foi localizado na lista de ordenação.' }
    }

    const moveControl = findMoveControl(orderDoc, direction)
    if (!moveControl) {
      return { ok: false, message: direction === 'up' ? 'O botão nativo “Mover Acima” não foi localizado.' : 'O botão nativo “Mover Abaixo” não foi localizado.' }
    }

    clickNativeControl(moveControl)
    await new Promise((resolve) => window.setTimeout(resolve, 180))

    const save = findSaveControl(orderDoc)
    if (!save) {
      return { ok: false, message: 'O botão nativo “Salvar” da ordenação não foi localizado.' }
    }

    clickNativeControl(save)
    return { ok: true }
  }

  function showContextMenu (anchor, event) {
    hideMenu()

    const menu = document.createElement('div')
    menu.id = MENU_ID
    menu.className = 'sp-arvore-context-menu'

    const title = document.createElement('div')
    title.className = 'sp-arvore-context-title'
    title.textContent = cleanText(anchor.textContent) || 'Documento'

    const moveUp = document.createElement('button')
    moveUp.type = 'button'
    moveUp.className = 'sp-arvore-context-action'
    moveUp.textContent = '↑ Mover para cima'

    const moveDown = document.createElement('button')
    moveDown.type = 'button'
    moveDown.className = 'sp-arvore-context-action'
    moveDown.textContent = '↓ Mover para baixo'

    const runMove = async (direction, button) => {
      moveUp.disabled = true
      moveDown.disabled = true
      button.textContent = direction === 'up' ? '↑ Movendo…' : '↓ Movendo…'
      const result = await moveDocument(anchor, direction)
      hideMenu()

      if (!result.ok) {
        showToast(result.message, 'error')
        return
      }

      showToast(direction === 'up' ? 'Documento movido para cima.' : 'Documento movido para baixo.', 'success')
      window.setTimeout(() => window.location.reload(), 650)
    }

    moveUp.addEventListener('click', (clickEvent) => {
      clickEvent.preventDefault()
      clickEvent.stopPropagation()
      runMove('up', moveUp)
    })

    moveDown.addEventListener('click', (clickEvent) => {
      clickEvent.preventDefault()
      clickEvent.stopPropagation()
      runMove('down', moveDown)
    })

    menu.append(title, moveUp, moveDown)
    document.body.appendChild(menu)
    fitToViewport(menu, event.clientX, event.clientY)
    moveUp.focus()
  }

  document.addEventListener('contextmenu', (event) => {
    const anchor = documentAnchorFromTarget(event.target)
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
    if (menu && !menu.contains(event.target)) hideMenu()
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideMenu()
  })

  window.addEventListener('blur', hideMenu)
})()
