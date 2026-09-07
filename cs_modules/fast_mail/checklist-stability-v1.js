(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const ACTION_SELECTOR = '#spfm-priority-reply, #spfm-priority-missing, #spfm-priority-open'
  const checkedDocumentIds = new Set()
  let checklistProcedureId = ''
  let scrollRestoreToken = 0

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

  function currentProcedureId () {
    return String(document.querySelector('#spfm-procedure')?.value || '')
  }

  function syncChecklistContext () {
    const procedureId = currentProcedureId()
    if (procedureId === checklistProcedureId) return
    checklistProcedureId = procedureId
    checkedDocumentIds.clear()
  }

  function restoreCheckedState () {
    syncChecklistContext()
    if (!checkedDocumentIds.size) return

    document.querySelectorAll('#spfm-missing-options .spfm-missing-doc').forEach((checkbox) => {
      if (checkedDocumentIds.has(String(checkbox.value || ''))) checkbox.checked = true
    })
  }

  function keepPanelPosition () {
    const panelBody = document.querySelector('#spfm-panel-body')
    if (!panelBody) return

    const scrollTop = panelBody.scrollTop
    const token = ++scrollRestoreToken
    ;[100, 230, 450, 720].forEach((delay) => {
      window.setTimeout(() => {
        if (token !== scrollRestoreToken) return
        panelBody.scrollTop = scrollTop
      }, delay)
    })
  }

  function bindChecklist () {
    const list = document.querySelector('#spfm-missing-options')
    if (!list || list.dataset.spfmChecklistStabilityBound === 'true') {
      restoreCheckedState()
      return Boolean(list)
    }

    list.dataset.spfmChecklistStabilityBound = 'true'

    list.addEventListener('change', (event) => {
      const checkbox = event.target.closest?.('.spfm-missing-doc')
      if (!checkbox) return

      syncChecklistContext()
      const id = String(checkbox.value || '')
      if (checkbox.checked) checkedDocumentIds.add(id)
      else checkedDocumentIds.delete(id)

      // O evento continua propagando normalmente para o fluxo operacional.
      // Apenas neutralizamos o scroll do guia de próximo clique neste checklist.
      keepPanelPosition()
    })

    restoreCheckedState()
    return true
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('#spfm-insert-requirement')) return
    // Se algum reconciliador redesenhou o checklist, reaplica as escolhas do
    // protocolista antes que o inseridor central faça a leitura de :checked.
    restoreCheckedState()
  }, true)

  const observer = new MutationObserver(() => {
    installSelectionStyles()
    bindChecklist()
  })

  observer.observe(document.documentElement, { childList: true, subtree: true })
  installSelectionStyles()
  bindOperationalSelection()
  bindChecklist()
})()
