/* global currentBrowser */
(() => {
  'use strict'

  const STORAGE_KEY = 'cliqueProtocolistaRascunho'
  const MAX_DRAFT_AGE = 15 * 60 * 1000
  const GOLD = '#e0ae28'

  const PROCESS_TYPES = [
    {
      id: 'devolucao-taxas',
      label: 'Devolução de Taxas',
      aliases: ['Detran: Devolução de Taxas']
    },
    {
      id: 'desistencia-categoria-primeira-habilitacao',
      label: 'Desistência de Categoria na 1ª Habilitação',
      aliases: [
        'DETRAN: Desistência de categoria na 1ª habilitação'
      ]
    },
    {
      id: 'solicitacao-geral-habilitacao',
      label: 'Solicitação Geral - Habilitação',
      aliases: ['Detran: Solicitação Geral - Habilitação']
    },
    {
      id: 'solicitacoes-gerais-veiculos',
      label: 'Solicitações Gerais - Veículos',
      aliases: ['Detran: Solicitações Gerais - Veículos']
    },
    {
      id: 'cancelamento-comunicacao-venda',
      label: 'Cancelamento de Comunicação de Venda',
      aliases: ['Detran: Cancelamento de Comunicação de Venda']
    },
    {
      id: 'certidao-identificacao-civil',
      label: 'Certidão de Identificação Civil',
      aliases: ['Detran: Solicitação de Certidão de Identificação Civil']
    },
    {
      id: 'solicitacao-pericia-medica',
      label: 'Solicitação de Perícia Médica',
      aliases: ['Detran: Solicitação de Perícia Médica']
    },
    {
      id: 'isencao-taxa',
      label: 'Isenção de Taxa',
      aliases: ['Detran: Isenção de taxa']
    },
    {
      id: 'averbacao-cnh-estrangeira',
      label: 'Averbação de CNH estrangeira',
      aliases: ['Detran: Averbação de CNH Estrangeira']
    },
    {
      id: 'oficio-mero-expediente',
      label: 'Elaboração de Ofício de Mero Expediente',
      aliases: ['Administrativo: Elaboração de Ofício de Mero Expediente']
    }
  ]

  function normalize (value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\bdetra?n\b/g, ' ')
      .replace(/\b1a\b/g, ' primeira ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function cleanValue (value) {
    return String(value || '').replace(/\s+/g, ' ').trim()
  }

  function processName (value) {
    return normalize(value)
      .replace(/^(detran|administrativo)\s+/, '')
      .trim()
  }

  function dispatchFieldEvents (element) {
    const eventNames = ['input', 'change', 'keyup']
    eventNames.forEach((eventName) => {
      element.dispatchEvent(new Event(eventName, { bubbles: true }))
    })
  }

  function getAction () {
    return new URLSearchParams(window.location.search).get('acao') || ''
  }

  function storageGet (key) {
    return new Promise((resolve, reject) => {
      const result = currentBrowser.storage.local.get(key, (items) => {
        const lastError = currentBrowser.runtime.lastError
        if (lastError) reject(lastError)
        else resolve(items)
      })

      if (result && typeof result.then === 'function') {
        result.then(resolve, reject)
      }
    })
  }

  function storageSet (items) {
    return new Promise((resolve, reject) => {
      const result = currentBrowser.storage.local.set(items, () => {
        const lastError = currentBrowser.runtime.lastError
        if (lastError) reject(lastError)
        else resolve()
      })

      if (result && typeof result.then === 'function') {
        result.then(resolve, reject)
      }
    })
  }

  function storageRemove (key) {
    return new Promise((resolve, reject) => {
      const result = currentBrowser.storage.local.remove(key, () => {
        const lastError = currentBrowser.runtime.lastError
        if (lastError) reject(lastError)
        else resolve()
      })

      if (result && typeof result.then === 'function') {
        result.then(resolve, reject)
      }
    })
  }

  function createElement (tagName, attributes = {}, text = '') {
    const element = document.createElement(tagName)
    Object.entries(attributes).forEach(([name, value]) => {
      if (name === 'className') element.className = value
      else if (name === 'htmlFor') element.htmlFor = value
      else element.setAttribute(name, value)
    })
    if (text) element.textContent = text
    return element
  }

  function findHeading () {
    return Array.from(document.querySelectorAll('h1, h2, h3, legend, label, div, span'))
      .filter((element) => normalize(element.textContent).includes('escolha o tipo do processo'))
      .sort((first, second) => first.textContent.length - second.textContent.length)[0]
  }

  function buildOutput (draft) {
    const values = [
      draft.cpf,
      draft.duda,
      draft.telefone,
      draft.email,
      draft.placa,
      draft.chassi,
      draft.renavam
    ].map(cleanValue).filter(Boolean)

    const specification = values.join(' ')
    const mode = draft.modalidade === 'email'
      ? 'Abertura via e-mail'
      : 'Abertura presencial'

    return {
      specification,
      observations: [mode, ...values].join(' ')
    }
  }

  function getSelectedProcessType (form) {
    const selectedOption = form.elements.tipoProcesso.selectedOptions[0]
    if (!selectedOption?.dataset.processLabel) return null
    return {
      label: selectedOption.dataset.processLabel,
      aliases: [selectedOption.dataset.processLabel]
    }
  }

  function readDraftFromForm (form) {
    return {
      createdAt: Date.now(),
      modalidade: form.elements.modalidade.value,
      tipoProcesso: form.elements.tipoProcesso.value,
      tipoProcessoLabel: getSelectedProcessType(form)?.label || '',
      nome: cleanValue(form.elements.nome.value),
      cpf: cleanValue(form.elements.cpf.value),
      telefone: cleanValue(form.elements.telefone.value),
      email: cleanValue(form.elements.email.value),
      duda: cleanValue(form.elements.duda.value),
      placa: cleanValue(form.elements.placa.value).toUpperCase(),
      chassi: cleanValue(form.elements.chassi.value).toUpperCase(),
      renavam: cleanValue(form.elements.renavam.value)
    }
  }

  function addField (grid, field) {
    const wrapper = createElement('div', {
      className: `sp-clique-field${field.wide ? ' sp-clique-field--wide' : ''}`
    })
    const label = createElement('label', { htmlFor: `sp-${field.name}` }, field.label)
    if (field.required) {
      label.appendChild(createElement('span', { className: 'sp-clique-required' }, ' *'))
    }

    const input = createElement('input', {
      id: `sp-${field.name}`,
      name: field.name,
      type: field.type || 'text',
      autocomplete: field.autocomplete || 'off',
      placeholder: field.placeholder || ''
    })
    if (field.required) input.required = true
    if (field.maxLength) input.maxLength = field.maxLength

    wrapper.append(label, input)
    grid.appendChild(wrapper)
  }

  function listAvailableProcessTypes () {
    const entries = Array.from(document.querySelectorAll(
      'a, [role="button"], [data-url], [onclick]'
    ))
      .map((element) => cleanValue(element.textContent))
      .filter((text) => text.length > 5 && text.length < 180)
      .filter((text) => /^(detran|administrativo)\s*:/i.test(text))

    return [...new Map(entries.map((text) => [normalize(text), text])).values()]
      .sort((first, second) => first.localeCompare(second, 'pt-BR'))
  }

  function createProcessTypeSelect () {
    const select = createElement('select', {
      id: 'sp-tipo-processo',
      name: 'tipoProcesso',
      required: 'required'
    })
    select.appendChild(createElement('option', { value: '' }, 'Selecione o tipo de processo'))

    const favoritesGroup = createElement('optgroup', { label: 'Mais usados' })
    const favoriteNames = new Set()
    PROCESS_TYPES.forEach((type, index) => {
      const option = createElement('option', { value: `favorite-${index}` }, type.label)
      option.dataset.processLabel = type.aliases[0]
      favoritesGroup.appendChild(option)
      type.aliases.forEach((alias) => favoriteNames.add(processName(alias)))
    })
    select.appendChild(favoritesGroup)

    const allTypes = listAvailableProcessTypes()
      .filter((label) => !favoriteNames.has(processName(label)))
    if (allTypes.length) {
      const allGroup = createElement('optgroup', { label: 'Todos os tipos disponíveis no SEI' })
      allTypes.forEach((label, index) => {
        const option = createElement('option', { value: `available-${index}` }, label)
        option.dataset.processLabel = label
        allGroup.appendChild(option)
      })
      select.appendChild(allGroup)
    }

    return select
  }

  function createPanel () {
    const backdrop = createElement('div', {
      className: 'sp-clique-backdrop',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'sp-clique-title'
    })
    const panel = createElement('div', { className: 'sp-clique-panel' })
    const header = createElement('div', { className: 'sp-clique-header' })
    const headingGroup = createElement('div')
    const title = createElement('h2', {
      className: 'sp-clique-title',
      id: 'sp-clique-title'
    }, 'CLICK PROTOCOLISTA')
    const subtitle = createElement('p', {
      className: 'sp-clique-subtitle'
    }, 'Preenchimento rápido para iniciar um processo')
    const closeButton = createElement('button', {
      className: 'sp-clique-close',
      type: 'button',
      'aria-label': 'Fechar'
    }, '×')

    const form = createElement('form', { className: 'sp-clique-form' })
    const modeSection = createElement('fieldset', { className: 'sp-clique-section' })
    modeSection.appendChild(createElement('legend', {}, '1. Como o pedido chegou?'))
    const modeOptions = createElement('div', { className: 'sp-clique-mode' })

    ;[
      ['presencial', 'Abertura presencial'],
      ['email', 'Abertura via e-mail']
    ].forEach(([value, labelText], index) => {
      const label = createElement('label')
      const radio = createElement('input', {
        type: 'radio',
        name: 'modalidade',
        value
      })
      if (index === 0) radio.checked = true
      label.append(radio, document.createTextNode(labelText))
      modeOptions.appendChild(label)
    })
    modeSection.appendChild(modeOptions)

    const dataSection = createElement('fieldset', { className: 'sp-clique-section' })
    dataSection.appendChild(createElement('legend', {}, '2. Dados do processo'))
    const grid = createElement('div', { className: 'sp-clique-grid' })

    const typeWrapper = createElement('div', {
      className: 'sp-clique-field sp-clique-field--wide'
    })
    const typeLabel = createElement('label', { htmlFor: 'sp-tipo-processo' }, 'Tipo do processo')
    typeLabel.appendChild(createElement('span', { className: 'sp-clique-required' }, ' *'))
    const typeSelect = createProcessTypeSelect()
    typeWrapper.append(typeLabel, typeSelect)
    grid.appendChild(typeWrapper)

    ;[
      {
        name: 'nome',
        label: 'Nome do interessado',
        required: true,
        wide: true,
        autocomplete: 'name',
        placeholder: 'Nome completo'
      },
      { name: 'cpf', label: 'CPF', maxLength: 20, placeholder: 'CPF do interessado' },
      {
        name: 'telefone',
        label: 'Telefone',
        maxLength: 25,
        autocomplete: 'tel',
        placeholder: 'Telefone com DDD'
      },
      {
        name: 'email',
        label: 'E-mail',
        type: 'email',
        autocomplete: 'email',
        placeholder: 'E-mail do interessado'
      },
      { name: 'duda', label: 'DUDA', placeholder: 'Número do DUDA' },
      { name: 'placa', label: 'Placa', maxLength: 10, placeholder: 'Placa do veículo' },
      { name: 'chassi', label: 'Chassi', maxLength: 30, placeholder: 'Número do chassi' },
      { name: 'renavam', label: 'Renavam', maxLength: 20, placeholder: 'Número do Renavam' }
    ].forEach((field) => addField(grid, field))

    dataSection.appendChild(grid)

    const preview = createElement('div', { className: 'sp-clique-preview' })
    preview.append(
      createElement('strong', {}, 'Prévia da especificação'),
      createElement('p', { id: 'sp-preview-specification' }, '—'),
      createElement('strong', {}, 'Prévia das observações'),
      createElement('p', { id: 'sp-preview-observations' }, 'Abertura presencial')
    )

    const message = createElement('div', {
      className: 'sp-clique-message',
      role: 'alert'
    })
    const actions = createElement('div', { className: 'sp-clique-actions' })
    const cancelButton = createElement('button', {
      className: 'sp-clique-action sp-clique-action--cancel',
      type: 'button'
    }, 'Cancelar')
    const continueButton = createElement('button', {
      className: 'sp-clique-action sp-clique-action--continue',
      type: 'submit'
    }, 'Continuar e preencher')
    actions.append(cancelButton, continueButton)

    form.append(modeSection, dataSection, preview, message, actions)
    headingGroup.append(title, subtitle)
    header.append(headingGroup, closeButton)
    panel.append(header, form)
    backdrop.appendChild(panel)

    const closePanel = () => backdrop.remove()
    closeButton.addEventListener('click', closePanel)
    cancelButton.addEventListener('click', closePanel)
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) closePanel()
    })
    document.addEventListener('keydown', function closeOnEscape (event) {
      if (event.key === 'Escape' && backdrop.isConnected) {
        closePanel()
        document.removeEventListener('keydown', closeOnEscape)
      }
    })

    const updatePreview = () => {
      const output = buildOutput(readDraftFromForm(form))
      preview.querySelector('#sp-preview-specification').textContent = output.specification || '—'
      preview.querySelector('#sp-preview-observations').textContent = output.observations
    }
    form.addEventListener('input', updatePreview)
    form.addEventListener('change', updatePreview)

    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      message.className = 'sp-clique-message'
      message.textContent = ''

      const draft = readDraftFromForm(form)
      if (!draft.tipoProcesso || !draft.nome) {
        message.className = 'sp-clique-message sp-clique-message--error'
        message.textContent = 'Escolha o tipo de processo e informe o nome do interessado.'
        return
      }

      try {
        await storageSet({ [STORAGE_KEY]: draft })
        continueToProcessType(draft, backdrop, message)
      } catch (error) {
        message.className = 'sp-clique-message sp-clique-message--error'
        message.textContent = `Não foi possível guardar o rascunho: ${error.message || error}`
      }
    })

    return backdrop
  }

  function processMatches (element, processType) {
    const text = processName(element.textContent)
    return processType.aliases.some((alias) => text === processName(alias))
  }

  function findProcessElement (processType) {
    const candidates = Array.from(document.querySelectorAll(
      'a, button, label, [role="button"], [data-url], [onclick]'
    ))
    return candidates.find((element) => processMatches(element, processType))
  }

  function extractSafeUrl (element) {
    const anchor = element.matches('a') ? element : element.querySelector('a')
    const href = anchor?.getAttribute('href') || element.getAttribute('data-url') || ''

    if (href && !href.toLowerCase().startsWith('javascript:')) {
      try {
        return new URL(href, window.location.href).href
      } catch (error) {
        return ''
      }
    }

    const source = [
      href,
      anchor?.getAttribute('onclick'),
      element.getAttribute('onclick')
    ].filter(Boolean).join(' ')
    const match = source.match(/(?:https?:\/\/[^'"\s]+|controlador\.php\?[^'"\s)]+)/i)
    if (!match) return ''

    try {
      return new URL(match[0].replace(/&amp;/g, '&'), window.location.href).href
    } catch (error) {
      return ''
    }
  }

  function fillNativeSearch (processType) {
    const heading = findHeading()
    const scope = heading?.parentElement || document
    const inputs = Array.from(scope.querySelectorAll('input[type="text"], input:not([type])'))
    const search = inputs.find((input) => input.offsetParent !== null) ||
      Array.from(document.querySelectorAll('input[type="text"]')).find((input) => input.offsetParent !== null)
    if (!search) return
    search.value = processType.label
    dispatchFieldEvents(search)
  }

  function continueToProcessType (draft, backdrop, message) {
    const processType = {
      label: draft.tipoProcessoLabel,
      aliases: [draft.tipoProcessoLabel]
    }
    const processElement = processType && findProcessElement(processType)
    const safeUrl = processElement && extractSafeUrl(processElement)

    if (safeUrl) {
      window.location.assign(safeUrl)
      return
    }

    fillNativeSearch(processType)
    const filteredElement = processType && findProcessElement(processType)
    if (filteredElement) {
      filteredElement.classList.add('sp-clique-highlight')
      filteredElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    backdrop.remove()
    showStatus(
      '<strong>Rascunho guardado.</strong> O SEI não expôs um link seguro para abertura automática. ' +
      `O tipo “${processType.label}” foi localizado e destacado; clique nele uma vez para continuar.`,
      'warning'
    )
  }

  function insertQuickButton () {
    if (document.querySelector('#sp-clique-protocolista-button')) return

    const button = createElement('button', {
      id: 'sp-clique-protocolista-button',
      type: 'button'
    }, '⚡ CLICK PROTOCOLISTA')
    button.addEventListener('click', () => {
      if (!document.querySelector('.sp-clique-backdrop')) {
        document.body.appendChild(createPanel())
        document.querySelector('#sp-tipo-processo')?.focus()
      }
    })

    const heading = findHeading()
    if (heading) heading.insertAdjacentElement('afterend', button)
    else document.body.prepend(button)
  }

  function showStatus (html, type = '') {
    const status = createElement('div', {
      className: `sp-clique-status${type ? ` sp-clique-status--${type}` : ''}`,
      role: 'status'
    })
    status.innerHTML = html

    const form = document.querySelector('form')
    if (form?.parentElement) form.parentElement.insertBefore(status, form)
    else document.body.prepend(status)
    return status
  }

  function findFirst (selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector)
      if (element) return element
    }
    return null
  }

  function findFieldByLabel (labelText) {
    const expected = normalize(labelText)
    const label = Array.from(document.querySelectorAll('label'))
      .find((item) => normalize(item.textContent).includes(expected))
    if (!label) return null
    if (label.htmlFor) return document.getElementById(label.htmlFor)
    return label.querySelector('input, textarea, select') ||
      label.parentElement?.querySelector('input, textarea, select')
  }

  function fillField (element, value) {
    if (!element || !value) return false
    element.value = value
    dispatchFieldEvents(element)
    return true
  }

  function chooseRestrito () {
    const direct = findFirst([
      '#optRestrito',
      'input[type="radio"][id*="Restrito"]',
      'input[type="radio"][name*="Restrito"]',
      'input[type="radio"][value="R"]'
    ])
    if (direct) {
      direct.checked = true
      dispatchFieldEvents(direct)
      direct.click()
      return true
    }

    const label = Array.from(document.querySelectorAll('label'))
      .find((item) => normalize(item.textContent) === 'restrito')
    const radio = label && (label.control || label.querySelector('input'))
    if (!radio) return false
    radio.checked = true
    dispatchFieldEvents(radio)
    radio.click()
    return true
  }

  function chooseInformacaoPessoal () {
    const select = findFirst([
      '#selHipoteseLegal',
      'select[name*="Hipotese"]',
      'select[id*="Hipotese"]'
    ]) || findFieldByLabel('Hipótese Legal')
    if (!select || select.tagName !== 'SELECT') return false

    const option = Array.from(select.options)
      .find((item) => normalize(item.textContent).includes('informacao pessoal'))
    if (!option) return false

    select.value = option.value
    dispatchFieldEvents(select)
    return true
  }

  function waitForInformacaoPessoal (attempts = 20) {
    if (chooseInformacaoPessoal()) return Promise.resolve(true)
    if (attempts <= 0) return Promise.resolve(false)
    return new Promise((resolve) => {
      window.setTimeout(() => {
        waitForInformacaoPessoal(attempts - 1).then(resolve)
      }, 250)
    })
  }

  async function fillProcessForm () {
    let stored
    try {
      stored = await storageGet(STORAGE_KEY)
    } catch (error) {
      return
    }

    const draft = stored[STORAGE_KEY]
    if (!draft || Date.now() - draft.createdAt > MAX_DRAFT_AGE) {
      if (draft) await storageRemove(STORAGE_KEY)
      return
    }

    const output = buildOutput(draft)
    const filled = []
    const warnings = []

    const specification = findFirst([
      '#txtDescricao',
      '#txtEspecificacao',
      'input[name="txtDescricao"]',
      'input[name*="Especificacao"]'
    ]) || findFieldByLabel('Especificação')
    if (fillField(specification, output.specification)) filled.push('especificação')
    else if (output.specification) warnings.push('especificação')

    const observations = findFirst([
      '#txaObservacoes',
      'textarea[name="txaObservacoes"]',
      'textarea[id*="Observacoes"]'
    ]) || findFieldByLabel('Observações desta unidade')
    if (fillField(observations, output.observations)) filled.push('observações')
    else warnings.push('observações')

    const interested = findFirst([
      '#txtInteressadoProcedimento',
      'input[name="txtInteressadoProcedimento"]',
      'input[id*="InteressadoProcedimento"]'
    ]) || findFieldByLabel('Interessados')
    if (fillField(interested, draft.nome)) {
      filled.push('nome do interessado')
      interested.style.border = `3px solid ${GOLD}`
      interested.title = 'Confira e selecione o interessado sugerido pelo SEI antes de salvar.'
    } else {
      warnings.push('nome do interessado')
    }

    if (chooseRestrito()) filled.push('nível Restrito')
    else warnings.push('nível Restrito')

    if (await waitForInformacaoPessoal()) filled.push('hipótese Informação Pessoal')
    else warnings.push('hipótese Informação Pessoal')

    const warningText = warnings.length
      ? `<br><strong>Confira manualmente:</strong> ${warnings.join(', ')}.`
      : ''
    showStatus(
      `<strong>CLICK PROTOCOLISTA preencheu:</strong> ${filled.join(', ')}.` +
      '<br>Confira os dados e confirme a inclusão do interessado no SEI. ' +
      'O botão Salvar continua sob seu controle.' +
      warningText,
      warnings.length ? 'warning' : 'success'
    )

    await storageRemove(STORAGE_KEY)
  }

  if (getAction() === 'procedimento_escolher_tipo') insertQuickButton()
  if (getAction() === 'procedimento_gerar') fillProcessForm()
})()
