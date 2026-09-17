(() => {
  'use strict'

  if (window.top !== window) return

  const TRELLO_BOARDS_URL = 'https://trello.com/u/protocolistadetran1/boards'
  const IS_COMPOSE_WINDOW = /[?&]ae=(?:Item|PreFormAction)(?:&|$)/i.test(location.search) &&
    /[?&]a=(?:Reply|ReplyAll|Forward|New)(?:&|$)/i.test(location.search)

  if (!IS_COMPOSE_WINDOW) return

  function installTrelloFallbackButton () {
    const nativeToggle = document.querySelector('#spfm-script-toggle')
    if (!nativeToggle || !nativeToggle.parentElement) return false

    let button = document.querySelector('#spfm-trello-fallback')
    if (!button) {
      button = document.createElement('button')
      button.id = 'spfm-trello-fallback'
      button.type = 'button'
      button.className = nativeToggle.className || 'spfm-catalog-toggle'
      button.textContent = 'CONSULTAR SCRIPT NO TRELLO'
      button.title = 'Abrir o Trello em nova aba apenas para localizar/copiar o script'
      button.setAttribute('aria-label', 'Consultar script no Trello em nova aba')
      button.addEventListener('click', () => {
        window.open(TRELLO_BOARDS_URL, '_blank', 'noopener,noreferrer')
      })
    }

    if (button.parentElement !== nativeToggle.parentElement || button.nextElementSibling !== nativeToggle) {
      nativeToggle.parentElement.insertBefore(button, nativeToggle)
    }

    nativeToggle.style.display = 'none'
    nativeToggle.setAttribute('aria-hidden', 'true')
    nativeToggle.tabIndex = -1
    return true
  }

  ;[0, 120, 300, 650, 1200, 2200, 3600].forEach((delay) => {
    window.setTimeout(installTrelloFallbackButton, delay)
  })
})()
