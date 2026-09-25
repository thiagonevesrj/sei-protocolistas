(() => {
  'use strict'

  const STORAGE_KEY = 'cliqueProtocolistaRascunho'
  const MAX_DRAFT_AGE = 15 * 60 * 1000
  const READY_STABILITY_MS = 450

  const browserApi =
    window.currentBrowser ||
    (typeof chrome !== 'undefined' ? chrome : browser)

  function normalize (value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function getAction () {
    return new URLSearchParams(window.location.search).get('acao') || ''
  }

  function storageGet (key) {
    return new Promise((resolve) => {
      try {
        const result = browserApi.storage.local.get(key, (items) => {
          resolve(items || {})
        })

        if (result && typeof result.then === 'function') {
          result.then((items) => resolve(items || {}), () => resolve({}))
        }
      } catch (error) {
        resolve({})
      }
    })
  }

  function findSaveButton () {
    return Array.from(
      document.querySelectorAll(
        'button, input[type="button"], input[type="submit"], a'
      )
    ).filter((element) => {
      if (element.offsetParent === null) return false

      const text = normalize(
        element.textContent ||
        element.value ||
        element.title
      )

      return text === 'salvar' || text === 'salvar processo'
    }).sort((first, second) =>
      first.getBoundingClientRect().top -
      second.getBoundingClientRect().top
    )[0] || null
  }

  function findLegalHypothesis () {
    return document.querySelector(
      '#selHipoteseLegal, select[name*="Hipotese"], select[id*="Hipotese"]'
    )
  }

  function isPersonalInformationSelected () {
    const select = findLegalHypothesis()
    if (!select || select.tagName !== 'SELECT') return false

    const option = select.selectedOptions?.[0]
    return normalize(option?.textContent).includes('informacao pessoal')
  }

  function injectStyles () {
    if (document.querySelector('#sp-fast-proc-next-click-style')) return

    const style = document.createElement('style')
    style.id = 'sp-fast-proc-next-click-style'
    style.textContent = `
      #sp-fast-proc-next-click {
        position: fixed;
        right: 22px;
        bottom: 22px;
        z-index: 2147483645;
        max-width: 380px;
        box-sizing: border-box;
        padding: 13px 16px;
        border: 2px solid #e0ae28;
        border-radius: 8px;
        background: #071a33;
        color: #fff;
        box-shadow: 0 8px 28px rgba(0,0,0,.34);
        font: 700 14px/1.35 Arial, Helvetica, sans-serif;
      }

      #sp-fast-proc-next-click small {
        display: block;
        margin-top: 3px;
        color: #d9e3f0;
        font-size: 12px;
        font-weight: 400;
      }

      #sp-fast-proc-next-click[data-state="ready"] {
        border-color: #2b8a57;
        background: #0c4f2f;
      }

      #sp-fast-proc-next-click[data-state="manual"] {
        border-color: #e0ae28;
        background: #5b4300;
      }

      .sp-fast-proc-save-waiting {
        opacity: .62 !important;
        cursor: wait !important;
        filter: grayscale(.35);
      }

      .sp-fast-proc-save-ready {
        outline: 3px solid #e0ae28 !important;
        outline-offset: 4px !important;
        animation: spFastProcNextClickPulse .82s ease-in-out 2;
      }

      @keyframes spFastProcNextClickPulse {
        0%, 100% {
          box-shadow: 0 3px 10px rgba(0,0,0,.35), 0 0 0 0 rgba(224,174,40,.45);
        }
        50% {
          box-shadow: 0 3px 10px rgba(0,0,0,.35), 0 0 0 9px rgba(224,174,40,.16);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .sp-fast-proc-save-ready {
          animation: none;
        }
      }
    `
    document.head.appendChild(style)
  }

  function createStatus () {
    let status = document.querySelector('#sp-fast-proc-next-click')
    if (status) return status

    status = document.createElement('div')
    status.id = 'sp-fast-proc-next-click'
    status.setAttribute('role', 'status')
    status.setAttribute('aria-live', 'polite')
    document.body.appendChild(status)
    return status
  }

  function setStatus (status, state, title, detail) {
    status.dataset.state = state
    status.innerHTML = ''

    const strong = document.createElement('strong')
    strong.textContent = title

    const small = document.createElement('small')
    small.textContent = detail

    status.append(strong, small)
  }

  async function init () {
    if (getAction() !== 'procedimento_gerar') return

    const stored = await storageGet(STORAGE_KEY)
    const draft = stored[STORAGE_KEY]

    if (
      !draft ||
      !draft.createdAt ||
      Date.now() - draft.createdAt > MAX_DRAFT_AGE
    ) {
      return
    }

    injectStyles()

    const status = createStatus()
    let saveButton = null
    let flowFinished = false
    let ready = false
    let readyTimer = null

    const blockSave = (event) => {
      if (ready) return
      event.preventDefault()
      event.stopImmediatePropagation()
      setStatus(
        status,
        flowFinished ? 'manual' : 'working',
        flowFinished
          ? '⚠ FAST PROC — FALTA A HIPÓTESE LEGAL'
          : 'FAST PROC • PREENCHENDO DADOS…',
        flowFinished
          ? 'Selecione “Informação Pessoal” para liberar SALVAR.'
          : 'Aguarde. O próximo clique será indicado automaticamente.'
      )
    }

    const attachSaveGuard = () => {
      if (saveButton?.isConnected) return true

      saveButton = findSaveButton()
      if (!saveButton) return false

      saveButton.classList.add('sp-fast-proc-save-waiting')
      saveButton.setAttribute('aria-disabled', 'true')
      saveButton.addEventListener('click', blockSave, true)
      saveButton.addEventListener('keydown', blockSave, true)
      return true
    }

    const markReady = () => {
      if (ready || !flowFinished || !isPersonalInformationSelected()) return

      ready = true
      window.clearInterval(poll)
      window.clearTimeout(readyTimer)

      if (saveButton) {
        saveButton.removeEventListener('click', blockSave, true)
        saveButton.removeEventListener('keydown', blockSave, true)
        saveButton.classList.remove('sp-fast-proc-save-waiting')
        saveButton.classList.add('sp-fast-proc-save-ready')
        saveButton.removeAttribute('aria-disabled')
        saveButton.setAttribute('title', 'FAST PROC pronto — clique para salvar')
        saveButton.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        })
      }

      setStatus(
        status,
        'ready',
        '✓ FAST PROC PRONTO — CLIQUE EM SALVAR',
        'Preenchimento concluído. Este é o próximo clique.'
      )
    }

    const evaluate = () => {
      attachSaveGuard()

      if (!flowFinished) {
        setStatus(
          status,
          'working',
          'FAST PROC • PREENCHENDO DADOS…',
          'Aguarde. O próximo clique será indicado automaticamente.'
        )
        return
      }

      if (!isPersonalInformationSelected()) {
        setStatus(
          status,
          'manual',
          '⚠ FAST PROC — FALTA A HIPÓTESE LEGAL',
          'Selecione “Informação Pessoal” para liberar SALVAR.'
        )
        return
      }

      if (!readyTimer) {
        readyTimer = window.setTimeout(markReady, READY_STABILITY_MS)
      }
    }

    setStatus(
      status,
      'working',
      'FAST PROC • PREENCHENDO DADOS…',
      'Aguarde. O próximo clique será indicado automaticamente.'
    )

    attachSaveGuard()

    browserApi.storage.onChanged?.addListener((changes, areaName) => {
      if (
        areaName === 'local' &&
        changes[STORAGE_KEY] &&
        !changes[STORAGE_KEY].newValue
      ) {
        flowFinished = true
        evaluate()
      }
    })

    const legalSelect = findLegalHypothesis()
    legalSelect?.addEventListener('change', evaluate)

    const poll = window.setInterval(async () => {
      if (ready) return

      if (!flowFinished) {
        const current = await storageGet(STORAGE_KEY)
        if (!current[STORAGE_KEY]) {
          flowFinished = true
        }
      }

      evaluate()
    }, 250)
  }

  init().catch((error) => {
    console.warn('[FAST PROC] Guia de próximo clique indisponível:', error)
  })
})()
