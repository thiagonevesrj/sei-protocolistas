(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const TOPIC_ID = 'certidao-identificacao-civil'
  const TOPIC_LABEL = 'Certidão de Identificação Civil'

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

  function isCertidaoButton (button) {
    if (!button) return false
    if (!button.matches?.('.spfm-workflow-v3-service-button, #spfm-v2-orientation-shortcuts .spfm-v2-quick-button')) return false
    return normalize(button.textContent) === 'certidao de identificacao civil'
  }

  function markSelected (button) {
    const container = document.querySelector('#spfm-workflow-v3-orientation-actions')
    if (!container) return

    container.querySelectorAll('.spfm-workflow-v3-service-button').forEach((item) => {
      const selected = item === button || normalize(item.textContent) === 'certidao de identificacao civil'
      item.classList.toggle('is-selected', selected)
      item.setAttribute('aria-pressed', String(selected))
    })
  }

  function ensureNativeTopicOption (select) {
    if (!select) return false
    let option = Array.from(select.options || []).find((item) => item.value === TOPIC_ID)
    if (!option) {
      option = document.createElement('option')
      option.value = TOPIC_ID
      option.textContent = TOPIC_LABEL
      select.appendChild(option)
    }
    return true
  }

  function activateCertidao (button) {
    const phase = document.querySelector('.spfm-phase-button[data-phase-id="orientacao"]')
    if (!phase) return false
    phase.click()

    const topic = document.querySelector('#spfm-priority-topic')
    if (!topic || !ensureNativeTopicOption(topic)) return false

    topic.value = TOPIC_ID
    topic.dispatchEvent(new Event('change', { bubbles: true }))

    const selected = document.querySelector('#spfm-v2-selected-topic')
    if (selected) selected.textContent = TOPIC_LABEL

    const special = document.querySelector('#spfm-v2-special-actions')
    if (special) special.hidden = true

    markSelected(button)

    const workflowStatus = document.querySelector('#spfm-workflow-v3-status')
    if (workflowStatus) workflowStatus.textContent = 'Certidão de Identificação Civil selecionada. Escolha ORIENTAR, COBRAR DOCUMENTOS ou ABRIR PROCESSO.'

    const nativeStatus = document.querySelector('#spfm-priority-status')
    if (nativeStatus) nativeStatus.hidden = false

    return true
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('button')
    if (!isCertidaoButton(button)) return

    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()

    if (!activateCertidao(button)) {
      const status = document.querySelector('#spfm-workflow-v3-status') || document.querySelector('#spfm-priority-status')
      if (status) status.textContent = 'Não foi possível carregar o fluxo da Certidão de Identificação Civil. Reabra a resposta e tente novamente.'
    }
  }, true)
})()
