(() => {
  'use strict'

  const LOOKUP_KEY = 'spFastProcConsultaProcessosAnteriores'
  const MAX_AGE = 2 * 60 * 1000
  const RESULT_TIMEOUT = 45 * 1000
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

  function isProcessSearchPage () {
    const action = new URL(window.location.href).searchParams.get('acao') || ''
    return /^(protocolo|procedimento)_pesquisar(?:_resultado)?$/i.test(action)
  }

  function findFirst (selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector)
      if (element) return element
    }
    return null
  }

  function findLabelField (labelText, selector) {
    const label = Array.from(document.querySelectorAll('label')).find((item) =>
      normalize(item.textContent).includes(normalize(labelText))
    )
    if (!label) return null

    const id = label.htmlFor || label.getAttribute('for')
    if (id) {
      const field = document.getElementById(id)
      if (field) return field
    }

    return label.querySelector(selector) ||
      label.parentElement?.querySelector(selector) ||
      label.parentElement?.parentElement?.querySelector(selector) ||
      null
  }

  function findSearchFields () {
    const form = findFirst(['#seiSearch', 'form'])
    if (!form) return null

    const specification = findFirst([
      '#txtDescricaoPesquisa',
      '[name="txtDescricaoPesquisa"]',
      '#txtEspecificacaoPesquisa',
      '[name="txtEspecificacaoPesquisa"]'
    ])
    const processCheckbox = findFirst([
      '#chkSinProcessos',
      '[name="chkSinProcessos"]'
    ])
    const agency = findFirst([
      '#selOrgaoPesquisa',
      '[name="selOrgaoPesquisa"], [name="selOrgaoPesquisa[]"]'
    ]) || findLabelField('Órgão Gerador', 'select')
    const unitHistory = findFirst([
      '#chkSinTramitacaoUnidade',
      '#chkSinTramitacaoNaUnidade',
      '[name="chkSinTramitacaoUnidade"]',
      '[name="chkSinTramitacaoNaUnidade"]'
    ]) || findLabelField('Com Tramitação na Unidade', 'input[type="checkbox"]')

    if (!specification || !processCheckbox || !agency || !unitHistory) {
      return null
    }

    return { form, specification, processCheckbox, agency, unitHistory }
  }

  function dispatchFieldEvents (field) {
    field.dispatchEvent(new Event('input', { bubbles: true }))
    field.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function selectCheckbox (checkbox, checked) {
    if (!checkbox) return false
    checkbox.checked = checked
    dispatchFieldEvents(checkbox)
    return true
  }

  function setSpecification (field, value) {
    field.value = value
    dispatchFieldEvents(field)
  }

  function selectDetran (select) {
    const option = Array.from(select.options || []).find((item) => {
      const text = normalize(item.textContent)
      return text === 'detran' || text.startsWith('detran ')
    })
    if (!option) return false

    if (select.multiple) {
      Array.from(select.options).forEach((item) => {
        item.selected = item === option
      })
    } else {
      select.value = option.value
    }
    dispatchFieldEvents(select)
    return true
  }

  function getSearchButton (form) {
    return findFirstWithin(form, [
      '#sbmPesquisar',
      'input[type="submit"][value*="Pesquisar"]',
      'button[type="submit"]'
    ])
  }

  function highlightSearchButton (form) {
    const button = form && getSearchButton(form)
    if (button) button.classList?.add('sp-fast-proc-search-button-highlight')
    return button
  }

  function findFirstWithin (root, selectors) {
    for (const selector of selectors) {
      const element = root.querySelector(selector)
      if (element) return element
    }

    const buttons = Array.from(root.querySelectorAll('input[type="submit"], button'))
    return buttons.find((button) => normalize(button.value || button.textContent) === 'pesquisar') || null
  }

  function showLookupNotice (message, state = 'busy') {
    const noticeId = 'sp-fast-proc-process-lookup-notice'
    let notice = document.getElementById(noticeId)
    if (!notice) {
      notice = document.createElement('div')
      notice.id = noticeId
      notice.setAttribute('role', 'status')
      notice.setAttribute('aria-live', 'polite')
      notice.style.cssText = [
        'position:fixed',
        'right:20px',
        'bottom:20px',
        'z-index:2147483647',
        'display:flex',
        'align-items:center',
        'gap:12px',
        'max-width:min(520px, calc(100vw - 32px))',
        'padding:12px 16px',
        'border:2px solid #d6ad35',
        'border-radius:10px',
        'background:#071a33',
        'color:#fff',
        'box-shadow:0 8px 24px rgb(0 0 0 / 35%)',
        'font:700 14px/1.4 Arial, sans-serif'
      ].join(';')

      const spinner = document.createElement('span')
      spinner.setAttribute('aria-hidden', 'true')
      spinner.style.cssText = [
        'display:none',
        'flex:0 0 18px',
        'width:18px',
        'height:18px',
        'border:3px solid #6d7f91',
        'border-top-color:#f0c54b',
        'border-radius:50%',
        'animation:sp-fast-proc-spin .8s linear infinite'
      ].join(';')

      const spinnerStyle = document.createElement('style')
      spinnerStyle.textContent = [
        '@keyframes sp-fast-proc-spin { to { transform: rotate(360deg) } }',
        '@keyframes sp-fast-proc-search-pulse { 50% { box-shadow: 0 0 0 6px rgb(240 197 75 / 28%), 0 0 18px rgb(240 197 75 / 70%); } }',
        '.sp-fast-proc-search-button-highlight { outline: 3px solid #f0c54b !important; outline-offset: 3px !important; box-shadow: 0 0 0 3px rgb(240 197 75 / 25%), 0 0 14px rgb(240 197 75 / 65%) !important; animation: sp-fast-proc-search-pulse 1.2s ease-in-out infinite; position: relative; z-index: 2; }'
      ].join('\n')
      document.head?.append(spinnerStyle)

      const text = document.createElement('span')
      text.className = 'sp-fast-proc-process-lookup-text'

      const filtersButton = document.createElement('button')
      filtersButton.type = 'button'
      filtersButton.textContent = 'Mostrar filtros'
      filtersButton.style.cssText = [
        'display:none',
        'flex:0 0 auto',
        'padding:6px 10px',
        'border:1px solid #d6ad35',
        'border-radius:6px',
        'background:#fff4c2',
        'color:#332600',
        'font-weight:700',
        'cursor:pointer'
      ].join(';')
      filtersButton.addEventListener('click', () => {
        const form = document.querySelector('#seiSearch')
        if (!form) return
        form.hidden = !form.hidden
        filtersButton.textContent = form.hidden ? 'Mostrar filtros' : 'Ocultar filtros'
        if (!form.hidden) highlightSearchButton(form)
      })

      notice.append(spinner, text, filtersButton)
      document.body.append(notice)
    }

    const spinner = notice.querySelector('[aria-hidden="true"]')
    const text = notice.querySelector('.sp-fast-proc-process-lookup-text')
    const filtersButton = notice.querySelector('button')
    spinner.style.display = state === 'busy' ? 'block' : 'none'
    text.textContent = message
    filtersButton.style.display = state === 'busy' ? 'none' : 'inline-block'
    const form = document.querySelector('#seiSearch')
    filtersButton.textContent = form?.hidden ? 'Mostrar filtros' : 'Ocultar filtros'
    if (state !== 'busy' && form && !form.hidden) highlightSearchButton(form)
    notice.style.borderColor = state === 'error' ? '#d14949' : '#d6ad35'
    notice.style.background = state === 'error' ? '#541b25' : '#071a33'
    return notice
  }

  function countResults () {
    const summary = document.querySelector('.total-registros-infinite')?.textContent || ''
    const total = summary.match(/\bde\s+(\d+)\b/i)?.[1]
    if (total) return Number(total)

    return document.querySelectorAll(
      '.retorno-ajax .pesquisaTituloRegistro, .retorno-ajax table tbody tr'
    ).length
  }

  function resultsAreReady () {
    const results = document.querySelector('.retorno-ajax')
    if (!results) return false

    const loading = results.querySelector('.ajax-loading')
    if (loading && window.getComputedStyle(loading).display !== 'none') return false

    const text = normalize(results.textContent)
    const hasNoResults = text.includes('sua pesquisa nao encontrou') ||
      text.includes('nenhum protocolo correspondente')
    const hasRows = results.querySelectorAll('table tbody tr').length > 0
    const hasSummary = Boolean(document.querySelector('.total-registros-infinite')?.textContent.trim())
    return hasNoResults || hasRows || hasSummary
  }

  async function waitForResults (applicantName) {
    const started = Date.now()
    while (Date.now() - started < RESULT_TIMEOUT) {
      if (resultsAreReady()) {
        const count = countResults()
        const suffix = count ? ` ${count} processo(s) listado(s).` : ' Nenhum processo localizado.'
        showLookupNotice(
          `Pesquisa concluída${applicantName ? ` para ${applicantName}` : ''}.${suffix}`,
          'complete'
        )
        const form = document.querySelector('#seiSearch')
        if (form) form.hidden = true
        await browserApi.storage.local.remove(LOOKUP_KEY)
        return true
      }
      await new Promise((resolve) => window.setTimeout(resolve, 250))
    }

    const form = document.querySelector('#seiSearch')
    if (form) form.hidden = false
    highlightSearchButton(form)
    showLookupNotice(
      'O SEI ainda não confirmou os resultados. Os filtros foram preenchidos; confira e clique em Pesquisar.',
      'error'
    )
    await browserApi.storage.local.remove(LOOKUP_KEY)
    return false
  }

  async function waitForSearchFields (timeoutMs = 12000) {
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
      const fields = findSearchFields()
      if (fields) return fields
      await new Promise((resolve) => window.setTimeout(resolve, 150))
    }
    return null
  }

  async function run () {
    if (!isProcessSearchPage()) return

    const fields = await waitForSearchFields()
    if (!fields) return

    const stored = await browserApi.storage.local.get(LOOKUP_KEY)
    const lookup = stored[LOOKUP_KEY]
    if (!lookup) return

    if (!lookup.createdAt || Date.now() - lookup.createdAt > MAX_AGE) {
      await browserApi.storage.local.remove(LOOKUP_KEY)
      return
    }

    if (lookup.state === 'searching') {
      showLookupNotice(
        `Aguarde: pesquisando processos${lookup.applicantName ? ` de ${lookup.applicantName}` : ''} no DETRAN, com tramitação na unidade...`,
        'busy'
      )
      fields.form.hidden = true
      await waitForResults(lookup.applicantName)
      return
    }

    const cpf = String(lookup.cpf || '').replace(/\D/g, '')
    if (cpf.length !== 11) {
      await browserApi.storage.local.remove(LOOKUP_KEY)
      showLookupNotice('FAST PROC não encontrou um CPF válido para a pesquisa.', 'error')
      return
    }

    if (!selectDetran(fields.agency)) {
      await browserApi.storage.local.remove(LOOKUP_KEY)
      showLookupNotice('FAST PROC não encontrou o órgão DETRAN na lista. Confira os filtros e pesquise manualmente.', 'error')
      return
    }

    selectCheckbox(fields.processCheckbox, true)
    selectCheckbox(fields.unitHistory, true)
    selectCheckbox(findFirst(['#chkSinDocumentosGerados', '[name="chkSinDocumentosGerados"]']), false)
    selectCheckbox(findFirst(['#chkSinDocumentosRecebidos', '[name="chkSinDocumentosRecebidos"]']), false)
    setSpecification(fields.specification, cpf)

    const searchButton = getSearchButton(fields.form)
    if (!searchButton) {
      await browserApi.storage.local.remove(LOOKUP_KEY)
      showLookupNotice('FAST PROC preencheu os filtros, mas não encontrou o botão Pesquisar. Confira e pesquise manualmente.', 'error')
      return
    }

    await browserApi.storage.local.set({
      [LOOKUP_KEY]: { ...lookup, state: 'searching' }
    })
    highlightSearchButton(fields.form)
    showLookupNotice(
      `Aguarde: pesquisando processos${lookup.applicantName ? ` de ${lookup.applicantName}` : ''} no DETRAN, com tramitação na unidade...`,
      'busy'
    )
    searchButton.click()
    fields.form.hidden = true
    await waitForResults(lookup.applicantName)
  }

  run().catch((error) => {
    console.error('[SEI Protocolistas] Falha ao pesquisar processo anterior:', error)
    showLookupNotice('FAST PROC não conseguiu preparar a pesquisa. Confira os filtros manualmente.', 'error')
  })
})()

