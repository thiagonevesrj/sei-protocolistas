(() => {
  'use strict'

  const LOOKUP_KEY = 'spFastProcConsultaProcessosAnteriores'
  const MAX_AGE = 60 * 1000
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
    return /^(protocolo|procedimento)_pesquisar$/i.test(action)
  }

  function findFirst (selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector)
      if (element) return element
    }
    return null
  }

  function setTextField (field, value) {
    field.value = value
    field.dispatchEvent(new Event('input', { bubbles: true }))
    field.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function selectCheckbox (selectors, checked) {
    const checkbox = findFirst(selectors)
    if (!checkbox) return false
    checkbox.checked = checked
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }

  function selectProcessType (select, expectedType) {
    const expected = normalize(expectedType)
    if (!expected) return false

    const options = Array.from(select.options || []).filter((item) => {
      const text = normalize(item.textContent)
      return text
    })
    const exact = options.find((item) => normalize(item.textContent) === expected)
    const partial = options.filter((item) => {
      const text = normalize(item.textContent)
      return text.includes(expected) || expected.includes(text)
    })
    const option = exact || (partial.length === 1 ? partial[0] : null)

    if (!option) return false
    select.value = option.value
    select.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }

  function showLookupNotice (message, isError = false) {
    const noticeId = 'sp-fast-proc-process-lookup-notice'
    let notice = document.getElementById(noticeId)
    if (!notice) {
      notice = document.createElement('div')
      notice.id = noticeId
      notice.setAttribute('role', isError ? 'alert' : 'status')
      notice.style.cssText = [
        'margin:10px 0',
        'padding:10px 12px',
        'border:1px solid ' + (isError ? '#bd3b3b' : '#d6ad35'),
        'border-radius:6px',
        'background:' + (isError ? '#fde8e8' : '#fff4c2'),
        'color:' + (isError ? '#751313' : '#332600'),
        'font-weight:700'
      ].join(';')
      const target = document.querySelector('form') || document.body
      target.insertAdjacentElement('afterbegin', notice)
    }
    notice.textContent = message
  }

  function findSearchButton (form) {
    const buttons = Array.from(
      form.querySelectorAll('button, input[type="submit"], input[type="button"]')
    )
    return buttons.find((button) =>
      normalize(button.textContent || button.value || button.title) === 'pesquisar'
    ) || null
  }

  async function waitForSearchFields (timeoutMs = 8000) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const specification = findFirst([
        '#txtDescricaoPesquisa',
        '[name="txtDescricaoPesquisa"]',
        '#txtEspecificacaoPesquisa',
        '[name="txtEspecificacaoPesquisa"]'
      ])
      const processType = findFirst([
        '#selTipoProcedimentoPesquisa',
        '[name="selTipoProcedimentoPesquisa"]'
      ])
      const processCheckbox = findFirst([
        '#chkSinProcessos',
        '[name="chkSinProcessos"]'
      ])
      if (specification && processType && processCheckbox) {
        return { specification, processType, processCheckbox }
      }
      await new Promise((resolve) => window.setTimeout(resolve, 100))
    }
    return null
  }

  async function run () {
    if (!isProcessSearchPage()) return

    const stored = await browserApi.storage.local.get(LOOKUP_KEY)
    const lookup = stored[LOOKUP_KEY]
    if (!lookup) return

    if (!lookup.createdAt || Date.now() - lookup.createdAt > MAX_AGE) {
      await browserApi.storage.local.remove(LOOKUP_KEY)
      return
    }

    const fields = await waitForSearchFields()
    if (!fields) {
      await browserApi.storage.local.remove(LOOKUP_KEY)
      showLookupNotice(
        'FAST PROC não identificou os campos da Pesquisa do SEI. Preencha Processos, Especificação e Tipo do Processo manualmente.',
        true
      )
      return
    }

    const form = fields.specification.form || document.querySelector('form')
    if (!form) {
      await browserApi.storage.local.remove(LOOKUP_KEY)
      showLookupNotice('FAST PROC não encontrou o formulário da Pesquisa do SEI.', true)
      return
    }

    const cpf = String(lookup.cpf || '').replace(/\D/g, '')
    const typeSelected = selectProcessType(fields.processType, lookup.processType)
    if (cpf.length !== 11 || !typeSelected) {
      await browserApi.storage.local.remove(LOOKUP_KEY)
      showLookupNotice(
        typeSelected
          ? 'FAST PROC não encontrou um CPF válido para a pesquisa.'
          : 'FAST PROC não localizou o tipo de processo na pesquisa. Confira o filtro e pesquise manualmente.',
        true
      )
      return
    }

    const processSelected = selectCheckbox(
      ['#chkSinProcessos', '[name="chkSinProcessos"]'],
      true
    )
    if (!processSelected) {
      await browserApi.storage.local.remove(LOOKUP_KEY)
      showLookupNotice('FAST PROC não conseguiu selecionar a pesquisa de Processos.', true)
      return
    }

    selectCheckbox(
      ['#chkSinDocumentosGerados', '[name="chkSinDocumentosGerados"]'],
      false
    )
    selectCheckbox(
      ['#chkSinDocumentosRecebidos', '[name="chkSinDocumentosRecebidos"]'],
      false
    )
    setTextField(fields.specification, cpf)
    await browserApi.storage.local.remove(LOOKUP_KEY)

    showLookupNotice(
      'FAST PROC pesquisando Processos por CPF na Especificação e pelo tipo selecionado. Confira a lista retornada pelo SEI.'
    )

    const searchButton = findSearchButton(form)
    if (searchButton) {
      searchButton.click()
      return
    }

    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit()
      return
    }

    showLookupNotice(
      'Os filtros foram preenchidos, mas o FAST PROC não localizou o botão Pesquisar. Confira os campos e clique em Pesquisar.',
      true
    )
  }

  run().catch((error) => {
    console.error('[SEI Protocolistas] Falha ao pesquisar processo anterior:', error)
    showLookupNotice('FAST PROC não conseguiu preparar a pesquisa. Confira os filtros manualmente.', true)
  })
})()

