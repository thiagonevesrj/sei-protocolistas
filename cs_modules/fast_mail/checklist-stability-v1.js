(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const ACTION_SELECTOR = '#spfm-priority-reply, #spfm-priority-missing, #spfm-priority-open'

  function installSelectionStyles () {
    if (document.getElementById('spfm-operational-selection-styles')) return

    const style = document.createElement('style')
    style.id = 'spfm-operational-selection-styles'
    style.textContent = `
      #sei-protocolistas-fast-mail-status .spfm-workflow-v3-stage-grid button {
        background: #0d2239 !important;
        color: #dce6f1 !important;
        border: 1px solid #314861 !important;
        box-shadow: none !important;
      }

      #sei-protocolistas-fast-mail-status .spfm-workflow-v3-stage-grid button.is-active {
        background: #07182c !important;
        color: #f4c84d !important;
        border: 2px solid #f4c84d !important;
        box-shadow: 0 0 0 2px rgba(244, 200, 77, .20), 0 0 14px rgba(244, 200, 77, .30) !important;
      }

      #sei-protocolistas-fast-mail-status .spfm-workflow-v3-stage-grid button.is-active::before {
        content: '✓ ';
        font-weight: 900;
      }

      #sei-protocolistas-fast-mail-status .spfm-decision-grid button.is-primary:not(.is-selected) {
        color: #e8eef7 !important;
        background: #07182c !important;
        border: 1px solid rgba(244, 200, 77, .42) !important;
        box-shadow: none !important;
      }

      #sei-protocolistas-fast-mail-status .spfm-decision-grid button.is-selected {
        color: #f4c84d !important;
        background: #07182c !important;
        border: 2px solid #f4c84d !important;
        box-shadow: 0 0 0 2px rgba(244, 200, 77, .20), 0 0 14px rgba(244, 200, 77, .30) !important;
      }

      #sei-protocolistas-fast-mail-status .spfm-decision-grid button.is-selected::before {
        content: '✓ ';
        font-weight: 900;
      }
    `
    document.documentElement.appendChild(style)
  }

  function clearSelectedAction () {
    document.querySelectorAll(`${ACTION_SELECTOR}.is-selected`).forEach((button) => {
      button.classList.remove('is-selected')
      button.setAttribute('aria-pressed', 'false')
    })
  }

  function selectAction (button) {
    if (!button?.matches?.(ACTION_SELECTOR)) return
    clearSelectedAction()
    button.classList.add('is-selected')
    button.setAttribute('aria-pressed', 'true')
  }

  function bindOperationalSelection () {
    if (document.documentElement.dataset.spfmOperationalSelectionBound === 'true') return
    document.documentElement.dataset.spfmOperationalSelectionBound = 'true'

    document.addEventListener('click', (event) => {
      const action = event.target.closest?.(ACTION_SELECTOR)
      if (action && !action.disabled) {
        selectAction(action)
        return
      }

      const routeChanged = event.target.closest?.(
        '[data-spfm-workflow-stage], .spfm-workflow-v3-service-button, #spfm-priority-topic, #spfm-topic-variant'
      )
      if (routeChanged) clearSelectedAction()
    })

    document.addEventListener('change', (event) => {
      if (event.target.matches?.('#spfm-priority-topic, #spfm-topic-variant')) clearSelectedAction()
    })
  }

  function bindChecklist () {
    const list = document.querySelector('#spfm-missing-options')
    if (!list || list.dataset.spfmChecklistStabilityBound === 'true') return false

    list.dataset.spfmChecklistStabilityBound = 'true'

    // Marcar documentos é uma operação local do checklist. Não deve disparar
    // o guia global de próximo clique nem deslocar o painel para outra etapa.
    list.addEventListener('change', (event) => {
      if (!event.target.matches?.('.spfm-missing-doc')) return
      event.stopPropagation()
    })

    return true
  }

  const observer = new MutationObserver(() => {
    installSelectionStyles()
    bindChecklist()
  })

  observer.observe(document.documentElement, { childList: true, subtree: true })
  installSelectionStyles()
  bindOperationalSelection()
  bindChecklist()
})()
