(() => {
  'use strict'

  if (window.top !== window) return

  const READY_TIMEOUT = 10000
  const CUE_DURATION = 1650
  let cueTimer = null
  let cueRequest = 0

  function visibleActionTarget () {
    const special = document.querySelector('#spfm-v2-special-actions')
    if (special && !special.hidden) return special

    const actionStep = document.querySelector('#spfm-action-step')
    if (actionStep && !actionStep.hidden) return actionStep

    return null
  }

  function cueActions () {
    const target = visibleActionTarget()
    if (!target) return false

    target.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
    target.classList.remove('spfm-v2-action-cue')
    void target.offsetWidth
    target.classList.add('spfm-v2-action-cue')

    if (cueTimer) window.clearTimeout(cueTimer)
    cueTimer = window.setTimeout(() => {
      target.classList.remove('spfm-v2-action-cue')
    }, CUE_DURATION)

    return true
  }

  function scheduleCue () {
    const request = ++cueRequest
    ;[60, 160, 320].forEach((delay) => {
      window.setTimeout(() => {
        if (request !== cueRequest) return
        if (cueActions()) cueRequest += 1
      }, delay)
    })
  }

  function bind () {
    const panel = document.querySelector('#sei-protocolistas-fast-mail-status')
    if (!panel || panel.dataset.spfmV2ActionCueBound === 'true') return false

    panel.dataset.spfmV2ActionCueBound = 'true'

    panel.addEventListener('click', (event) => {
      const orientationShortcut = event.target.closest('#spfm-v2-orientation .spfm-v2-quick-button')
      const orientationOpen = event.target.closest('#spfm-v2-orientation-open')
      if (orientationShortcut || orientationOpen) scheduleCue()
    })

    panel.addEventListener('change', (event) => {
      if (event.target.matches('#spfm-v2-variant, #spfm-topic-variant')) scheduleCue()
    })

    return true
  }

  async function initialize () {
    const startedAt = Date.now()
    while (Date.now() - startedAt < READY_TIMEOUT) {
      if (bind()) return
      await new Promise((resolve) => window.setTimeout(resolve, 100))
    }
  }

  initialize()
})()
