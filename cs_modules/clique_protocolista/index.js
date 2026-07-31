(() => {
  'use strict'

  const STORAGE_KEY = 'cliqueProtocolistaRascunho'
  const CONTEXT_KEY = 'cliqueProtocolistaContexto'
  const FALLBACK_KEY = 'seiProtocolistasRascunho'

  const MAX_DRAFT_AGE = 15 * 60 * 1000
  const STORAGE_TIMEOUT = 5000
  const STEP_TIMEOUT = 15000

  const browserApi =
    window.currentBrowser ||
    (typeof chrome !== 'undefined' ? chrome : browser)

  const PROCESS_TYPES = [
    ['Devolução de Taxas', 'Detran: Devolução de Taxas'],
    [
      'Desistência de Categoria na 1ª Habilitação',
      'DETRAN: Desistência de categoria na 1ª habilitação'
    ],
    [
      'Solicitação Geral - Habilitação',
      'Detran: Solicitação Geral - Habilitação'
    ],
    [
      'Solicitações Gerais - Veículos',
      'Detran: Solicitações Gerais - Veículos'
    ],
    [
      'Cancelamento de Comunicação de Venda',
      'Detran: Cancelamento de Comunicação de Venda'
    ],
    [
      'Certidão de Identificação Civil',
      'Detran: Solicitação de Certidão de Identificação Civil'
    ],
    [
      'Solicitação de Perícia Médica',
      'Detran: Solicitação de Perícia Médica'
    ],
    ['Isenção de Taxa', 'Detran: Isenção de taxa'],
    [
      'Averbação de CNH estrangeira',
      'Detran: Averbação de CNH Estrangeira'
    ],
    [
      'Elaboração de Ofício de Mero Expediente',
      'Administrativo: Elaboração de Ofício de Mero Expediente'
    ]
  ]

  function normalize(value) {
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

  function cleanValue(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function processName(value) {
    return normalize(value)
      .replace(/^(detran|administrativo)\s+/, '')
      .trim()
  }

  function getAction() {
    return new URLSearchParams(window.location.search).get('acao') || ''
  }

  function dispatchFieldEvents(element) {
    if (!element) return

    ;['input', 'change', 'keyup', 'blur'].forEach((eventName) => {
      element.dispatchEvent(
        new Event(eventName, {
          bubbles: true
        })
      )
    })
  }

  function wait(milliseconds) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds)
    })
  }

  function withTimeout(promise, timeout, errorMessage) {
    return Promise.race([
      promise,
      new Promise((resolve, reject) => {
        window.setTimeout(() => {
          reject(new Error(errorMessage))
        }, timeout)
      })
    ])
  }

  function rawStorageGet(key) {
    return new Promise((resolve, reject) => {
      let finished = false

      const finish = (callback, value) => {
        if (finished) return
        finished = true
        callback(value)
      }

      try {
        const result = browserApi.storage.local.get(key, (items) => {
          const error = browserApi.runtime?.lastError

          if (error) {
            finish(reject, error)
          } else {
            finish(resolve, items || {})
          }
        })

        if (result && typeof result.then === 'function') {
          result.then(
            (items) => finish(resolve, items || {}),
            (error) => finish(reject, error)
          )
        }
      } catch (error) {
        finish(reject, error)
      }
    })
  }

  function rawStorageSet(items) {
    return new Promise((resolve, reject) => {
      let finished = false

      const finish = (callback, value) => {
        if (finished) return
        finished = true
        callback(value)
      }

      try {
        const result = browserApi.storage.local.set(items, () => {
          const error = browserApi.runtime?.lastError

          if (error) {
            finish(reject, error)
          } else {
            finish(resolve)
          }
        })

        if (result && typeof result.then === 'function') {
          result.then(
            () => finish(resolve),
            (error) => finish(reject, error)
          )
        }
      } catch (error) {
        finish(reject, error)
      }
    })
  }

  function rawStorageRemove(key) {
    return new Promise((resolve, reject) => {
      let finished = false

      const finish = (callback, value) => {
        if (finished) return
        finished = true
        callback(value)
      }

      try {
        const result = browserApi.storage.local.remove(key, () => {
          const error = browserApi.runtime?.lastError

          if (error) {
            finish(reject, error)
          } else {
            finish(resolve)
          }
        })

        if (result && typeof result.then === 'function') {
          result.then(
            () => finish(resolve),
            (error) => finish(reject, error)
          )
        }
      } catch (error) {
        finish(reject, error)
      }
    })
  }

  async function storageSet(items) {
    if (items[STORAGE_KEY]) {
      sessionStorage.setItem(
        FALLBACK_KEY,
        JSON.stringify(items[STORAGE_KEY])
      )
    }

    try {
      await withTimeout(
        rawStorageSet(items),
        STORAGE_TIMEOUT,
        'O armazenamento da extensão não respondeu em 5 segundos.'
      )
    } catch (error) {
      console.warn(
        '[SEI Protocolistas] Usando armazenamento temporário:',
        error
      )
    }
  }

  async function storageGet(key) {
    try {
      const items = await withTimeout(
        rawStorageGet(key),
        STORAGE_TIMEOUT,
        'O armazenamento da extensão não respondeu em 5 segundos.'
      )

      if (items && items[key]) {
        return items
      }
    } catch (error) {
      console.warn(
        '[SEI Protocolistas] Falha ao ler armazenamento principal:',
        error
      )
    }

    if (key === STORAGE_KEY) {
      const temporaryValue = sessionStorage.getItem(FALLBACK_KEY)

      if (temporaryValue) {
        return {
          [STORAGE_KEY]: JSON.parse(temporaryValue)
        }
      }
    }

    return {}
  }

  async function storageRemove(key) {
    if (key === STORAGE_KEY) {
      sessionStorage.removeItem(FALLBACK_KEY)
    }

    try {
      await withTimeout(
        rawStorageRemove(key),
        STORAGE_TIMEOUT,
        'O armazenamento da extensão não respondeu em 5 segundos.'
      )
    } catch (error) {
      console.warn(
        '[SEI Protocolistas] Falha ao limpar armazenamento:',
        error
      )
    }
  }

  function createElement(tagName, attributes = {}, text = '') {
    const element = document.createElement(tagName)

    Object.entries(attributes).forEach(([name, value]) => {
      if (name === 'className') {
        element.className = value
      } else if (name === 'htmlFor') {
        element.htmlFor = value
      } else {
        element.setAttribute(name, value)
      }
    })

    if (text) {
      element.textContent = text
    }

    return element
  }

  function findHeading() {
    return Array.from(
      document.querySelectorAll(
        'h1, h2, h3, legend, label, div, span'
      )
    )
      .filter((element) =>
        normalize(element.textContent).includes(
          'escolha o tipo do processo'
        )
      )
      .sort(
        (first, second) =>
          first.textContent.length - second.textContent.length
      )[0]
  }

  function listAvailableProcessTypes() {
    const anchors = Array.from(
      document.querySelectorAll('a[href]')
    )

    const entries = anchors
      .map((anchor) => {
        const label = cleanValue(
          anchor.textContent ||
          anchor.innerText ||
          ''
        )

        if (
          !label ||
          label.length < 5 ||
          label.length > 180
        ) {
          return null
        }

        const href = anchor.getAttribute('href') || ''

        if (!href) {
          return null
        }

        let url = ''

        try {
          url = new URL(
            href,
            window.location.href
          ).href
        } catch (error) {
          return null
        }

        return {
          label,
          url
        }
      })
      .filter(Boolean)

    const unique = new Map()

    entries.forEach((entry) => {
      const key = processName(entry.label)

      if (!key) {
        return
      }

      if (!unique.has(key)) {
        unique.set(key, entry)
      }
    })

    return Array.from(unique.values()).sort(
      (first, second) =>
        first.label.localeCompare(
          second.label,
          'pt-BR'
        )
    )
  }

  function findAvailableProcessType(processLabel) {
    const expected = processName(processLabel)

    return listAvailableProcessTypes().find(
      (entry) =>
        processName(entry.label) === expected
    ) || null
  }

  function createProcessTypeSelect() {
    const select = createElement('select', {
      id: 'sp-tipo-processo',
      name: 'tipoProcesso',
      required: 'required'
    })

    select.appendChild(
      createElement(
        'option',
        {
          value: ''
        },
        'Selecione o tipo de processo'
      )
    )

    const availableTypes =
      listAvailableProcessTypes()

    const favoritesGroup = createElement(
      'optgroup',
      {
        label: 'Mais usados'
      }
    )

    const favoriteNames = new Set()

    PROCESS_TYPES.forEach(
      ([displayName, seiName], index) => {
        const matched =
          availableTypes.find(
            (entry) =>
              processName(entry.label) ===
              processName(seiName)
          )

        const option = createElement(
          'option',
          {
            value: `favorite-${index}`
          },
          displayName
        )

        option.dataset.processLabel =
          matched?.label || seiName

        option.dataset.processUrl =
          matched?.url || ''

        favoritesGroup.appendChild(option)

        favoriteNames.add(
          processName(seiName)
        )
      }
    )

    select.appendChild(favoritesGroup)

    const otherTypes =
      availableTypes.filter(
        (entry) =>
          !favoriteNames.has(
            processName(entry.label)
          )
      )

    if (otherTypes.length) {
      const allGroup = createElement(
        'optgroup',
        {
          label:
            'Todos os outros tipos disponíveis no SEI'
        }
      )

      otherTypes.forEach((entry, index) => {
        const option = createElement(
          'option',
          {
            value: `available-${index}`
          },
          entry.label
        )

        option.dataset.processLabel =
          entry.label

        option.dataset.processUrl =
          entry.url

        allGroup.appendChild(option)
      })

      select.appendChild(allGroup)
    }

    return select
  }

  function addField(grid, field) {
    const wrapper = createElement('div', {
      className:
        'sp-clique-field' +
        (field.wide ? ' sp-clique-field--wide' : '')
    })

    const label = createElement(
      'label',
      {
        htmlFor: `sp-${field.name}`
      },
      field.label
    )

    if (field.required) {
      label.appendChild(
        createElement(
          'span',
          {
            className: 'sp-clique-required'
          },
          ' *'
        )
      )
    }

    const input = createElement('input', {
      id: `sp-${field.name}`,
      name: field.name,
      type: field.type || 'text',
      autocomplete: field.autocomplete || 'off',
      placeholder: field.placeholder || ''
    })

    if (field.required) {
      input.required = true
    }

    if (field.maxLength) {
      input.maxLength = field.maxLength
    }

    wrapper.append(label, input)
    grid.appendChild(wrapper)
  }

  function readDraftFromForm(form) {
    const selectedOption =
      form.elements.tipoProcesso.selectedOptions[0]

    return {
      createdAt: Date.now(),
      modalidade:
        form.elements.modalidade.value,
      tipoProcesso:
        form.elements.tipoProcesso.value,
      tipoProcessoLabel:
        selectedOption?.dataset.processLabel || '',
      tipoProcessoUrl:
        selectedOption?.dataset.processUrl || '',
      nome:
        cleanValue(form.elements.nome.value),
      cpf:
        cleanValue(form.elements.cpf.value),
      telefone:
        cleanValue(form.elements.telefone.value),
      email:
        cleanValue(form.elements.email.value),
      duda:
        cleanValue(form.elements.duda.value),
      placa:
        cleanValue(
          form.elements.placa.value
        ).toUpperCase(),
      numeroProcesso:
        cleanValue(
          form.elements.numeroProcesso.value
        ),
      oficio:
        cleanValue(
          form.elements.oficio.value
        ),
      outros:
        cleanValue(
          form.elements.outros.value
        )
    }
  }

  function createPanel() {
    const backdrop = createElement('div', {
      className: 'sp-clique-backdrop',
      role: 'dialog',
      'aria-modal': 'true'
    })

    const panel = createElement('div', {
      className: 'sp-clique-panel'
    })

    const header = createElement('div', {
      className: 'sp-clique-header'
    })

    const headingGroup = createElement('div')

    headingGroup.append(
      createElement(
        'h2',
        {
          className: 'sp-clique-title'
        },
        'FAST PROC'
      ),
      createElement(
        'p',
        {
          className: 'sp-clique-subtitle'
        },
        'Abertura rápida de processos no SEI'
      )
    )

    const closeButton = createElement(
      'button',
      {
        className: 'sp-clique-close',
        type: 'button',
        'aria-label': 'Fechar'
      },
      '×'
    )

    header.append(headingGroup, closeButton)

    const form = createElement('form', {
      className: 'sp-clique-form'
    })

    const modeSection = createElement('fieldset', {
      className: 'sp-clique-section'
    })

    modeSection.appendChild(
      createElement(
        'legend',
        {},
        '1. Como o pedido chegou?'
      )
    )

    const modeOptions = createElement('div', {
      className: 'sp-clique-mode'
    })

    ;[
      ['presencial', 'Abertura presencial'],
      ['email', 'Abertura via e-mail']
    ].forEach(([value, text], index) => {
      const label = createElement('label')
      const radio = createElement('input', {
        type: 'radio',
        name: 'modalidade',
        value
      })

      if (index === 0) {
        radio.checked = true
      }

      label.append(radio, document.createTextNode(text))
      modeOptions.appendChild(label)
    })

    modeSection.appendChild(modeOptions)

    const dataSection = createElement('fieldset', {
      className: 'sp-clique-section'
    })

    dataSection.appendChild(
      createElement('legend', {}, '2. Dados do processo')
    )

    const grid = createElement('div', {
      className: 'sp-clique-grid'
    })

    const typeWrapper = createElement('div', {
      className:
        'sp-clique-field sp-clique-field--wide'
    })

    const typeLabel = createElement(
      'label',
      {
        htmlFor: 'sp-tipo-processo'
      },
      'Tipo do processo'
    )

    typeLabel.appendChild(
      createElement(
        'span',
        {
          className: 'sp-clique-required'
        },
        ' *'
      )
    )

    const typeSearch = createElement('input', {
      id: 'sp-tipo-processo-pesquisa',
      className: 'sp-clique-type-search',
      type: 'search',
      autocomplete: 'off',
      placeholder: 'Pesquisar por parte do nome: taxas, perícia, ofício...'
    })

    const typeSelect = createProcessTypeSelect()

    const typeOptions = Array.from(
      typeSelect.querySelectorAll('option')
    ).filter(
      (option) => option.value
    )

    typeSearch.addEventListener('input', () => {
      const query = normalize(typeSearch.value)
      let visibleCount = 0

      typeOptions.forEach((option) => {
        const optionText = normalize(
          option.textContent
        )

        const matches =
          !query ||
          optionText.includes(query)

        option.hidden = !matches
        option.disabled = !matches

        if (matches) {
          visibleCount += 1
        }
      })

      Array.from(
        typeSelect.querySelectorAll('optgroup')
      ).forEach((group) => {
        const hasVisibleOption = Array.from(
          group.querySelectorAll('option')
        ).some(
          (option) => !option.hidden
        )

        group.hidden = !hasVisibleOption
      })

      typeSelect.value = ''

      if (query) {
        typeSelect.size = Math.min(
          Math.max(visibleCount, 2),
          8
        )
      } else {
        typeSelect.size = 1
      }
    })

    typeSelect.addEventListener('change', () => {
      const selectedOption =
        typeSelect.selectedOptions[0]

      if (
        selectedOption &&
        selectedOption.value
      ) {
        typeSearch.value =
          selectedOption.textContent

        typeSelect.size = 1
      }
    })

    typeSearch.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return
      }

      event.preventDefault()

      const availableOptions =
        typeOptions.filter(
          (option) => !option.hidden
        )

      if (availableOptions.length === 1) {
        typeSelect.value =
          availableOptions[0].value

        typeSearch.value =
          availableOptions[0].textContent

        typeSelect.size = 1

        typeSelect.dispatchEvent(
          new Event('change', {
            bubbles: true
          })
        )
      } else {
        typeSelect.focus()
      }
    })

    typeWrapper.append(
      typeLabel,
      typeSearch,
      typeSelect
    )

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
      {
        name: 'cpf',
        label: 'CPF',
        required: true,
        maxLength: 20,
        placeholder: 'CPF do interessado'
      },
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
      {
        name: 'duda',
        label: 'DUDA',
        placeholder: 'Número do DUDA'
      },
      {
        name: 'placa',
        label: 'Placa',
        maxLength: 10,
        placeholder: 'Placa do veículo'
      },
      {
        name: 'numeroProcesso',
        label: 'Número do processo',
        maxLength: 40,
        placeholder: 'Número do processo'
      },
      {
        name: 'oficio',
        label: 'Ofício',
        maxLength: 60,
        placeholder: 'Número ou identificação do ofício'
      },
      {
        name: 'outros',
        label: 'Outros',
        wide: true,
        maxLength: 200,
        placeholder: 'Outras informações'
      }
    ].forEach((field) => addField(grid, field))

    dataSection.appendChild(grid)

    const message = createElement('div', {
      className: 'sp-clique-message',
      role: 'alert'
    })

    const actions = createElement('div', {
      className: 'sp-clique-actions'
    })

    const cancelButton = createElement(
      'button',
      {
        className:
          'sp-clique-action sp-clique-action--cancel',
        type: 'button'
      },
      'Cancelar'
    )

    const continueButton = createElement(
      'button',
      {
        className:
          'sp-clique-action sp-clique-action--continue',
        type: 'submit'
      },
      'Prosseguir e criar processo'
    )

    actions.append(cancelButton, continueButton)

    form.append(
      modeSection,
      dataSection,
      message,
      actions
    )

    panel.append(header, form)
    backdrop.appendChild(panel)

    const closePanel = () => {
      backdrop.remove()
    }

    closeButton.addEventListener('click', closePanel)
    cancelButton.addEventListener('click', closePanel)

    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) {
        closePanel()
      }
    })

    form.addEventListener('submit', async (event) => {
      event.preventDefault()

      message.className = 'sp-clique-message'
      message.textContent = ''

      continueButton.disabled = true
      continueButton.textContent = 'Processando...'

      try {
        const draft = readDraftFromForm(form)

        if (!draft.tipoProcesso) {
          throw new Error(
            'Escolha o tipo de processo.'
          )
        }

        if (!draft.nome) {
          throw new Error(
            'Informe o nome do interessado.'
          )
        }

        if (!draft.cpf) {
          throw new Error(
            'Informe o CPF do interessado.'
          )
        }

        await storageSet({
          [STORAGE_KEY]: draft
        })

        backdrop.remove()

        await continueToProcessType(draft)
      } catch (error) {
        console.error(
          '[SEI Protocolistas] Falha ao iniciar processo:',
          error
        )

        message.className =
          'sp-clique-message sp-clique-message--error'

        message.textContent =
          `Não foi possível continuar: ${
            error.message || error
          }`

        continueButton.disabled = false
        continueButton.textContent = 'Tentar novamente'
      }
    })

    return backdrop
  }

  function findProcessElement(processLabel) {
    const expected = processName(processLabel)

    const elements = Array.from(
      document.querySelectorAll(
        'a, button, [role="button"], [onclick], [data-url], td, li, span, div'
      )
    )

    const candidates = elements
      .map((element) => {
        const clickable =
          element.closest(
            'a, button, [role="button"], [onclick], [data-url]'
          ) ||
          element.querySelector(
            'a, button, [role="button"], [onclick], [data-url]'
          ) ||
          element

        const text = processName(
          element.textContent ||
          clickable.textContent ||
          ''
        )

        const href =
          clickable.getAttribute?.('href') ||
          clickable.getAttribute?.('data-url') ||
          ''

        const onclick =
          clickable.getAttribute?.('onclick') ||
          ''

        let score = 0

        if (text === expected) score += 100
        if (text.includes(expected)) score += 50
        if (expected.includes(text) && text.length > 5) score += 20
        if (href) score += 10
        if (onclick) score += 10
        if (clickable.offsetParent !== null) score += 5

        return {
          element,
          clickable,
          text,
          score
        }
      })
      .filter((item) => item.score >= 50)
      .sort((first, second) => second.score - first.score)

    return candidates[0]?.clickable || null
  }

  function fillNativeSearch(processLabel) {
    const heading = findHeading()
    const scope = heading?.parentElement || document

    const inputs = Array.from(
      scope.querySelectorAll(
        'input[type="text"], input:not([type])'
      )
    )

    const searchInput =
      inputs.find(
        (input) =>
          input.offsetParent !== null &&
          !input.closest('.sp-clique-backdrop')
      ) ||
      Array.from(
        document.querySelectorAll('input[type="text"]')
      ).find(
        (input) =>
          input.offsetParent !== null &&
          !input.closest('.sp-clique-backdrop')
      )

    if (!searchInput) {
      return false
    }

    searchInput.focus()
    searchInput.value = processLabel
    dispatchFieldEvents(searchInput)

    searchInput.dispatchEvent(
      new KeyboardEvent('keyup', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      })
    )

    return true
  }

  function extractNavigationUrl(element) {
    if (!element) {
      return ''
    }

    const href =
      element.getAttribute?.('href') ||
      element.getAttribute?.('data-url') ||
      ''

    if (
      href &&
      !href.toLowerCase().startsWith('javascript:')
    ) {
      try {
        return new URL(
          href,
          window.location.href
        ).href
      } catch (error) {
        return ''
      }
    }

    const source = [
      href,
      element.getAttribute?.('onclick') || ''
    ].join(' ')

    const match = source.match(
      /(?:https?:\/\/[^'"\s]+|(?:[^'"\s]*\/)?controlador\.php\?[^'"\s)]+)/i
    )

    if (!match) {
      return ''
    }

    try {
      return new URL(
        match[0].replace(/&amp;/g, '&'),
        window.location.href
      ).href
    } catch (error) {
      return ''
    }
  }

  async function continueToProcessType(draft) {
    const expected = processName(
      draft.tipoProcessoLabel
    )

    let processLink = Array.from(
      document.querySelectorAll('a')
    ).find((anchor) => {
      const text = processName(
        anchor.textContent ||
        anchor.innerText ||
        ''
      )

      return text === expected
    })

    if (!processLink) {
      fillNativeSearch(
        draft.tipoProcessoLabel
      )

      processLink = await waitUntil(
        () =>
          Array.from(
            document.querySelectorAll('a')
          ).find((anchor) => {
            const text = processName(
              anchor.textContent ||
              anchor.innerText ||
              ''
            )

            return text === expected
          }),
        10000,
        200
      )
    }

    if (!processLink) {
      throw new Error(
        `O tipo “${draft.tipoProcessoLabel}” não foi localizado na lista do SEI.`
      )
    }

    processLink.scrollIntoView({
      block: 'center'
    })

    processLink.focus()

    processLink.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window
      })
    )

    processLink.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window
      })
    )

    processLink.click()
  }

  function insertQuickButton() {
    if (
      document.querySelector(
        '#sp-clique-protocolista-button'
      )
    ) {
      return
    }

    const button = createElement(
      'button',
      {
        id: 'sp-clique-protocolista-button',
        type: 'button'
      },
      '⚡ FAST PROC'
    )

    button.addEventListener('click', () => {
      if (
        !document.querySelector(
          '.sp-clique-backdrop'
        )
      ) {
        document.body.appendChild(createPanel())

        document
          .querySelector('#sp-tipo-processo')
          ?.focus()
      }
    })

    const heading = findHeading()

    if (heading) {
      heading.insertAdjacentElement(
        'afterend',
        button
      )
    } else {
      document.body.prepend(button)
    }
  }

  function findFirst(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector)

      if (element) {
        return element
      }
    }

    return null
  }

  function findFieldByLabel(labelText) {
    const expected = normalize(labelText)

    const label = Array.from(
      document.querySelectorAll('label')
    ).find((item) =>
      normalize(item.textContent).includes(expected)
    )

    if (!label) {
      return null
    }

    if (label.htmlFor) {
      return document.getElementById(label.htmlFor)
    }

    return (
      label.querySelector(
        'input, textarea, select'
      ) ||
      label.parentElement?.querySelector(
        'input, textarea, select'
      )
    )
  }

  function fillField(element, value) {
    if (!element || !value) {
      return false
    }

    element.focus()
    element.value = value
    dispatchFieldEvents(element)

    return true
  }

  function chooseRestrito() {
    const radio =
      findFirst([
        '#optRestrito',
        'input[type="radio"][id*="Restrito"]',
        'input[type="radio"][name*="Restrito"]',
        'input[type="radio"][value="R"]'
      ]) ||
      Array.from(
        document.querySelectorAll('label')
      ).find(
        (item) =>
          normalize(item.textContent) === 'restrito'
      )?.control

    if (!radio) {
      return false
    }

    radio.checked = true
    radio.click()
    dispatchFieldEvents(radio)

    return true
  }

  function chooseInformacaoPessoal() {
    const select =
      findFirst([
        '#selHipoteseLegal',
        'select[name*="Hipotese"]',
        'select[id*="Hipotese"]'
      ]) || findFieldByLabel('Hipótese Legal')

    if (!select || select.tagName !== 'SELECT') {
      return false
    }

    const option = Array.from(select.options).find(
      (item) =>
        normalize(item.textContent).includes(
          'informacao pessoal'
        )
    )

    if (!option) {
      return false
    }

    select.value = option.value
    dispatchFieldEvents(select)

    return true
  }

  function waitUntil(
    testFunction,
    timeout = STEP_TIMEOUT,
    interval = 250
  ) {
    const startedAt = Date.now()

    return new Promise((resolve, reject) => {
      const check = () => {
        let result = null

        try {
          result = testFunction()
        } catch (error) {
          result = null
        }

        if (result) {
          resolve(result)
          return
        }

        if (Date.now() - startedAt >= timeout) {
          reject(
            new Error(
              'O SEI não respondeu dentro do prazo desta etapa.'
            )
          )

          return
        }

        window.setTimeout(check, interval)
      }

      check()
    })
  }

  async function selectInterestedSuggestion(name, interestedField) {
    const expectedName = normalize(name)

    try {
      const suggestion = await waitUntil(
        () => {
          const candidates = Array.from(
            document.querySelectorAll(
              '.ui-autocomplete li, ' +
              '.ui-menu-item, ' +
              '[role="option"], ' +
              'ul[id*="Interessado"] li, ' +
              'div[id*="Interessado"] li'
            )
          ).filter(
            (element) =>
              element.offsetParent !== null
          )

          return candidates.find(
            (element) =>
              normalize(
                element.textContent ||
                element.innerText ||
                ''
              ) === expectedName
          ) || null
        },
        2500
      )

      suggestion.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          view: window
        })
      )

      suggestion.click()

      return true
    } catch (error) {
      interestedField.focus()
      interestedField.value = name
      dispatchFieldEvents(interestedField)

      interestedField.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        })
      )

      interestedField.dispatchEvent(
        new KeyboardEvent('keypress', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        })
      )

      interestedField.dispatchEvent(
        new KeyboardEvent('keyup', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        })
      )

      await wait(300)

      return true
    }
  }

  function clickAddInterested(interestedField) {
    const scope =
      interestedField?.parentElement?.parentElement ||
      document

    const button = Array.from(
      scope.querySelectorAll(
        'button, input[type="button"], ' +
          'input[type="image"], img, a'
      )
    ).find((element) => {
      const text = [
        element.textContent,
        element.title,
        element.alt,
        element.value
      ].join(' ')

      return /adicionar|incluir|inserir/i.test(text)
    })

    if (!button) {
      return false
    }

    button.click()

    return true
  }

  function findSaveButton() {
    const direct = findFirst([
      '#btnSalvar',
      'button[id*="Salvar"]',
      'input[id*="Salvar"]',
      'input[name*="Salvar"]',
      'input[type="submit"]'
    ])

    if (direct && direct.offsetParent !== null) {
      return direct
    }

    return Array.from(
      document.querySelectorAll(
        'button, input[type="button"], ' +
          'input[type="submit"], a'
      )
    ).find((element) => {
      if (element.offsetParent === null) {
        return false
      }

      const text = normalize(
        element.textContent ||
          element.value ||
          element.title
      )

      return text === 'salvar'
    })
  }

  function buildOutput(draft) {
    const values = [
      draft.cpf,
      draft.duda,
      draft.telefone,
      draft.email,
      draft.placa,
      draft.numeroProcesso,
      draft.oficio,
      draft.outros
    ]
      .map(cleanValue)
      .filter(Boolean)

    const mode =
      draft.modalidade === 'email'
        ? 'Abertura via e-mail'
        : 'Abertura presencial'

    return {
      specification: values.join(' '),
      observations: [mode, ...values].join(' ')
    }
  }

  async function fillProcessForm() {
    const stored = await storageGet(STORAGE_KEY)
    const draft = stored[STORAGE_KEY]

    if (!draft) {
      return
    }

    if (
      Date.now() - draft.createdAt >
      MAX_DRAFT_AGE
    ) {
      await storageRemove(STORAGE_KEY)
      return
    }

    const output = buildOutput(draft)

    const specification =
      findFirst([
        '#txtDescricao',
        '#txtEspecificacao',
        'input[name="txtDescricao"]',
        'input[name*="Especificacao"]'
      ]) || findFieldByLabel('Especificação')

    const observations =
      findFirst([
        '#txaObservacoes',
        'textarea[name="txaObservacoes"]',
        'textarea[id*="Observacoes"]'
      ]) ||
      findFieldByLabel(
        'Observações desta unidade'
      )

    const interested =
      findFirst([
        '#txtInteressadoProcedimento',
        'input[name="txtInteressadoProcedimento"]',
        'input[id*="InteressadoProcedimento"]'
      ]) || findFieldByLabel('Interessados')

    if (output.specification) {
      fillField(
        specification,
        output.specification
      )
    }

    if (output.observations) {
      fillField(
        observations,
        output.observations
      )
    }

    if (!fillField(interested, draft.nome)) {
      throw new Error(
        'O campo Interessados não foi encontrado.'
      )
    }

    await wait(400)

    const interestedSelected =
      await selectInterestedSuggestion(
        draft.nome,
        interested
      )

    if (interestedSelected) {
      await wait(250)
      clickAddInterested(interested)
    }

    chooseRestrito()

    try {
      await waitUntil(
        chooseInformacaoPessoal,
        8000
      )
    } catch (error) {
      console.warn(
        '[SEI Protocolistas] Hipótese legal não localizada:',
        error
      )
    }

    await storageSet({
      [CONTEXT_KEY]: {
        ...draft,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60 * 60 * 1000,
        especificacao: output.specification,
        observacoes: output.observations,
        documentoPresencialPendente:
          draft.modalidade === 'presencial'
      }
    })
    await storageRemove(STORAGE_KEY)
  }

  if (
    getAction() ===
    'procedimento_escolher_tipo'
  ) {
    insertQuickButton()
  }

  if (getAction() === 'procedimento_gerar') {
    fillProcessForm().catch((error) => {
      console.error(
        '[SEI Protocolistas] Falha ao criar processo:',
        error
      )

      window.alert(
        `CLICK PROTOCOLISTA: ${
          error.message || error
        }`
      )
    })
  }
})()