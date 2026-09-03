(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

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

    const complete = buttons.find((button) => {
      const text = normalize(button.textContent)
      return text === 'solicitar identificacao' || text === 'identificacao completa'
    })

    const service = buttons.find((button) => normalize(button.textContent) === 'identificar servico')

    if (complete) {
      if (complete.textContent !== 'IDENTIFICAÇÃO COMPLETA') {
        complete.textContent = 'IDENTIFICAÇÃO COMPLETA'
      }
      complete.hidden = false
      complete.style.removeProperty('display')
      complete.title = 'Inserir o Script de Identificação Completo'
    }

    if (service) {
      service.hidden = true
      service.style.display = 'none'
      service.setAttribute('aria-hidden', 'true')
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
