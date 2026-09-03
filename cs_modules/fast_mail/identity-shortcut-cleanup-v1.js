(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const BAIXA_BUTTON_ID = 'spfm-p0-baixa-restricao'
  const HIDDEN_IDENTIFICATION_SHORTCUTS = new Set([
    'identificar o servico',
    'identificar servico',
    'simples identificacao',
    'devolucao de taxas',
    'pericia medica',
    'inventario'
  ])

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

  function reconcileIdentificationShortcuts () {
    const container = document.querySelector('#spfm-v2-identification-shortcuts')
    if (!container) return

    const buttons = Array.from(container.querySelectorAll('.spfm-v2-quick-button'))

    buttons.forEach((button) => {
      const text = normalize(button.textContent)
      const isComplete = text === 'solicitar identificacao' || text === 'identificacao completa'
      const isBaixa = button.id === BAIXA_BUTTON_ID

      if (isComplete) {
        if (button.textContent !== 'IDENTIFICAÇÃO COMPLETA') {
          button.textContent = 'IDENTIFICAÇÃO COMPLETA'
        }
        button.hidden = false
        button.style.removeProperty('display')
        button.removeAttribute('aria-hidden')
        button.title = 'Inserir o Script de Identificação Completo'
        return
      }

      if (isBaixa) {
        button.hidden = false
        button.style.removeProperty('display')
        button.removeAttribute('aria-hidden')
        return
      }

      if (HIDDEN_IDENTIFICATION_SHORTCUTS.has(text)) {
        button.hidden = true
        button.style.display = 'none'
        button.setAttribute('aria-hidden', 'true')
      }
    })

    const state = document.querySelector('#spfm-p0-identity-state')
    if (state && /use identificar servi[cç]o/i.test(state.textContent || '')) {
      state.innerHTML = '<strong style="color:#f1c44f;">IDENTIDADE CONFIRMADA</strong><br><span>Serviço/destino ainda não identificado. Use a busca do FAST MAIL ou IDENTIFICAÇÃO COMPLETA se precisar solicitar esclarecimentos ao requerente.</span>'
    }
  }

  let scheduled = false
  function scheduleReconcile () {
    if (scheduled) return
    scheduled = true
    window.setTimeout(() => {
      scheduled = false
      reconcileIdentificationShortcuts()
    }, 40)
  }

  reconcileIdentificationShortcuts()
  window.setTimeout(reconcileIdentificationShortcuts, 250)
  window.setTimeout(reconcileIdentificationShortcuts, 900)

  const observer = new MutationObserver(scheduleReconcile)
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  })
})()
