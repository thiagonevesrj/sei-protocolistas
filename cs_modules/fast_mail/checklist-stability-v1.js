(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  function bindChecklist () {
    const list = document.querySelector('#spfm-missing-options')
    if (!list || list.dataset.spfmChecklistStabilityBound === 'true') return false

    list.dataset.spfmChecklistStabilityBound = 'true'

    // O guia global de próximo clique escuta mudanças de checkbox no painel.
    // No checklist documental isso fazia o painel voltar para o seletor
    // "Pessoa Física" a cada marcação. A alteração do checkbox continua normal,
    // mas não sobe para o listener de navegação.
    list.addEventListener('change', (event) => {
      if (!event.target.matches?.('.spfm-missing-doc')) return
      event.stopPropagation()
    })

    return true
  }

  const observer = new MutationObserver(() => bindChecklist())
  observer.observe(document.documentElement, { childList: true, subtree: true })
  bindChecklist()
})()
