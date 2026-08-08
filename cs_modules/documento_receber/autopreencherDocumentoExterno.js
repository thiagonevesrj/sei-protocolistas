/* global __mconsole, currentBrowser */
// eslint-disable-next-line no-unused-vars
async function autopreencherDocumentoExterno (BaseName) {
  const mconsole = new __mconsole(
    BaseName + '.autopreencherDocumentoExterno'
  )

  /*
   * Executa apenas no frame que contém o formulário
   * de registro do documento externo.
   */
  const formularioDocumentoExterno =
    document.querySelector(
      '#selSerie, ' +
      'select[name="selSerie"], ' +
      'select[id*="Serie"]'
    )

  if (!formularioDocumentoExterno) {
    return
  }

  if (window.__fastProcRqPreenchendo) {
    return
  }

  window.__fastProcRqPreenchendo = true

  const CONTEXT_KEY =
    'cliqueProtocolistaContexto'

  const REGISTRY_KEY =
    'fastProcProcessos'

  const PENDING_KEY =
    'fastProcRequerimentoPendente'

  function normalize (value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function dispatchFieldEvents (element) {
    if (!element) return

    ;[
      'input',
      'change',
      'keyup',
      'blur'
    ].forEach(eventName => {
      element.dispatchEvent(
        new Event(eventName, {
          bubbles: true
        })
      )
    })
  }

  function storageGet (keys) {
    return new Promise((resolve, reject) => {
      let finished = false

      const finish = (callback, value) => {
        if (finished) return

        finished = true
        callback(value)
      }

      try {
        const result =
          currentBrowser.storage.local.get(
            keys,
            items => {
              const lastError =
                currentBrowser.runtime?.lastError

              if (lastError) {
                finish(reject, lastError)
              } else {
                finish(resolve, items || {})
              }
            }
          )

        if (
          result &&
          typeof result.then === 'function'
        ) {
          result.then(
            items =>
              finish(resolve, items || {}),
            error =>
              finish(reject, error)
          )
        }
      } catch (error) {
        finish(reject, error)
      }
    })
  }

  function storageSet (items) {
    return new Promise((resolve, reject) => {
      let finished = false

      const finish = (callback, value) => {
        if (finished) return

        finished = true
        callback(value)
      }

      try {
        const result =
          currentBrowser.storage.local.set(
            items,
            () => {
              const lastError =
                currentBrowser.runtime?.lastError

              if (lastError) {
                finish(reject, lastError)
              } else {
                finish(resolve)
              }
            }
          )

        if (
          result &&
          typeof result.then === 'function'
        ) {
          result.then(
            () => finish(resolve),
            error => finish(reject, error)
          )
        }
      } catch (error) {
        finish(reject, error)
      }
    })
  }

  function storageRemove (keys) {
    return new Promise((resolve, reject) => {
      let finished = false

      const finish = (callback, value) => {
        if (finished) return

        finished = true
        callback(value)
      }

      try {
        const result =
          currentBrowser.storage.local.remove(
            keys,
            () => {
              const lastError =
                currentBrowser.runtime?.lastError

              if (lastError) {
                finish(reject, lastError)
              } else {
                finish(resolve)
              }
            }
          )

        if (
          result &&
          typeof result.then === 'function'
        ) {
          result.then(
            () => finish(resolve),
            error => finish(reject, error)
          )
        }
      } catch (error) {
        finish(reject, error)
      }
    })
  }

  function wait (milliseconds) {
    return new Promise(resolve => {
      window.setTimeout(
        resolve,
        milliseconds
      )
    })
  }

  async function waitFor (
    action,
    timeout = 12000,
    interval = 250
  ) {
    const startedAt = Date.now()

    while (
      Date.now() - startedAt < timeout
    ) {
      try {
        const result = action()

        if (result) {
          return result
        }
      } catch (error) {
        // Aguarda o SEI atualizar o formulário.
      }

      await wait(interval)
    }

    return null
  }

  function findField (
    selectors,
    labelText
  ) {
    for (const selector of selectors) {
      const element =
        document.querySelector(selector)

      if (element) {
        return element
      }
    }

    const expected =
      normalize(labelText)

    const label = Array.from(
      document.querySelectorAll('label')
    ).find(item =>
      normalize(item.textContent)
        .includes(expected)
    )

    if (!label) {
      return null
    }

    if (label.htmlFor) {
      const associated =
        document.getElementById(
          label.htmlFor
        )

      if (associated) {
        return associated
      }
    }

    return (
      label.control ||
      label.querySelector(
        'input, textarea, select'
      ) ||
      label.parentElement?.querySelector(
        'input, textarea, select'
      ) ||
      null
    )
  }

  function hideDocumentFieldSection (
    labelText,
    fieldSelectors = []
  ) {
    const expected =
      normalize(labelText)

    const label = Array.from(
      document.querySelectorAll('label')
    ).find(item =>
      normalize(item.textContent)
        .startsWith(expected)
    )

    const targets = new Set(
      label ? [label] : []
    )

    fieldSelectors.forEach(selector => {
      document
        .querySelectorAll(selector)
        .forEach(element =>
          targets.add(element)
        )
    })

    const sections = new Set()

    targets.forEach(target => {
      let candidate = target

      while (
        candidate &&
        candidate !== document.body
      ) {
        const labels = Array.from(
          candidate.querySelectorAll('label')
        ).filter(item =>
          normalize(item.textContent)
        )

        const hasOtherField =
          labels.some(item =>
            !normalize(item.textContent)
              .startsWith(expected)
          )

        const looksLikeSection =
          candidate.matches(
            'tr, .row, .form-group, ' +
            '[id^="divRemetente"], ' +
            '[id*="Assunto"]'
          )

        if (
          looksLikeSection &&
          !hasOtherField
        ) {
          sections.add(candidate)
          break
        }

        candidate =
          candidate.parentElement
      }
    })

    if (!sections.size) {
      return false
    }

    sections.forEach(section => {
      section.setAttribute(
        'data-sei-protocolistas-hidden',
        expected
      )

      section.style.setProperty(
        'display',
        'none',
        'important'
      )
    })

    return true
  }

  function hideUnusedDocumentFields () {
    hideDocumentFieldSection(
      'Remetente',
      [
        '#txtRemetente',
        'input[name="txtRemetente"]',
        '#divRemetente',
        '[id^="divRemetente"]'
      ]
    )

    hideDocumentFieldSection(
      'Classificação por Assuntos',
      [
        '#txtAssunto',
        '#selAssuntos',
        'input[name*="Assunto"]',
        'textarea[name*="Assunto"]',
        'select[name*="Assunto"]',
        '#divClassificacaoAssuntos',
        '#divAssuntos',
        '[id*="Classificacao"][id*="Assunto"]',
        '[id^="divAssunto"]'
      ]
    )
  }

  function fillField (
    element,
    value
  ) {
    if (
      !element ||
      value === undefined ||
      value === null
    ) {
      return false
    }

    element.focus()
    element.value = String(value)

    dispatchFieldEvents(element)

    return true
  }

  function chooseRadio (
    selectors,
    labelText
  ) {
    let radio = null

    for (const selector of selectors) {
      radio =
        document.querySelector(selector)

      if (radio) break
    }

    if (!radio) {
      const expected =
        normalize(labelText)

      const label = Array.from(
        document.querySelectorAll('label')
      ).find(item =>
        normalize(item.textContent)
          .includes(expected)
      )

      radio =
        label?.control ||
        label?.querySelector(
          'input[type="radio"]'
        ) ||
        null
    }

    if (!radio) {
      return false
    }

    if (radio.checked) {
      return true
    }

    radio.focus()
    radio.click()

    if (!radio.checked) {
      radio.checked = true
    }

    dispatchFieldEvents(radio)

    return true
  }

  function chooseSelectExact (
    select,
    desiredText
  ) {
    if (
      !select ||
      select.tagName !== 'SELECT'
    ) {
      return false
    }

    const expected =
      normalize(desiredText)

    const options =
      Array.from(select.options)

    let option = options.find(item =>
      normalize(item.textContent) ===
        expected
    )

    if (!option) {
      option = options.find(item =>
        normalize(item.textContent)
          .startsWith(expected)
      )
    }

    if (!option) {
      return false
    }

    if (select.value === option.value) {
      return true
    }

    select.focus()
    select.value = option.value

    dispatchFieldEvents(select)

    return true
  }

  function chooseDocumentOriginal (
    select
  ) {
    if (
      !select ||
      select.tagName !== 'SELECT'
    ) {
      return false
    }

    const options =
      Array.from(select.options)

    let option = options.find(item =>
      normalize(item.textContent) ===
        'documento original'
    )

    if (!option) {
      option = options.find(item =>
        normalize(item.textContent) ===
        'original'
      )
    }

    if (!option) {
      option = options.find(item => {
        const text =
          normalize(item.textContent)

        return (
          text.includes('documento') &&
          text.includes('original')
        )
      })
    }

    if (!option) {
      return false
    }

    if (select.value === option.value) {
      return true
    }

    select.focus()
    select.value = option.value

    dispatchFieldEvents(select)

    return true
  }

  function chooseRestrito () {
    return chooseRadio(
      [
        '#optRestrito',
        'input[type="radio"][value="R"]',
        'input[type="radio"][id*="Restrito"]',
        'input[type="radio"][name*="NivelAcesso"][value="R"]'
      ],
      'Restrito'
    )
  }

  async function chooseInformacaoPessoal () {
    const select = await waitFor(() =>
      findField(
        [
          '#selHipoteseLegal',
          'select[name*="Hipotese"]',
          'select[id*="Hipotese"]'
        ],
        'Hipótese Legal'
      )
    )

    if (!select) {
      return false
    }

    const options =
      Array.from(select.options)

    const option = options.find(item =>
      normalize(item.textContent)
        .includes(
          'informacao pessoal'
        )
    )

    if (!option) {
      return false
    }

    if (select.value === option.value) {
      return true
    }

    select.focus()
    select.value = option.value

    dispatchFieldEvents(select)

    return true
  }

  function showStatus (
    message,
    warning = false
  ) {
    const oldStatus =
      document.querySelector(
        '#sp-documento-status'
      )

    oldStatus?.remove()

    const status =
      document.createElement('div')

    status.id = 'sp-documento-status'
    status.setAttribute(
      'role',
      'status'
    )

    status.style.cssText = [
      'background:#071a33',
      'border-left:5px solid #e0ae28',
      'color:#fff',
      'font-weight:600',
      'margin:8px 0',
      'padding:10px'
    ].join(';')

    if (warning) {
      status.style.borderLeftColor =
        '#e74c3c'
    }

    status.textContent = message

    const commandBar =
      document.querySelector(
        '#divInfraBarraComandosSuperior, ' +
        '#divInfraBarraComandosInferior'
      )

    if (commandBar?.parentElement) {
      commandBar.parentElement.insertBefore(
        status,
        commandBar.nextSibling
      )
    } else {
      document.body.prepend(status)
    }
  }

  hideUnusedDocumentFields()

  const stored = await storageGet([
    CONTEXT_KEY,
    REGISTRY_KEY,
    PENDING_KEY
  ])

  const pending =
    stored[PENDING_KEY]

  const pendingValid = Boolean(
    pending &&
    pending.processoId &&
    (
      !pending.expiresAt ||
      Date.now() <= pending.expiresAt
    )
  )

  const registry =
    stored[REGISTRY_KEY] || {}

  let contexto =
    stored[CONTEXT_KEY] || null

  if (
    pendingValid &&
    registry[pending.processoId]
  ) {
    contexto =
      registry[pending.processoId]
  }

  const requerimentoRapido =
    pendingValid

  const warnings = []

  if (!requerimentoRapido) {
    if (!chooseRestrito()) {
      warnings.push(
        'nível de acesso Restrito'
      )
    }

    if (
      !await chooseInformacaoPessoal()
    ) {
      warnings.push(
        'hipótese Informação Pessoal'
      )
    }

    const message =
      'SEI Protocolistas definiu Restrito + Informação Pessoal. Confira antes de salvar.'

    showStatus(
      warnings.length
        ? `${message} Confira manualmente: ${warnings.join(', ')}.`
        : message,
      warnings.length > 0
    )

    return
  }

  /*
   * Data do documento: data atual.
   */
  const hoje = new Date()

  const dataFormatada = [
    String(hoje.getDate()).padStart(2, '0'),
    String(hoje.getMonth() + 1).padStart(2, '0'),
    hoje.getFullYear()
  ].join('/')

  const dataDocumento = await waitFor(() =>
    findField(
      [
        '#txtDataElaboracao',
        'input[name="txtDataElaboracao"]',
        'input[id*="DataElaboracao"]'
      ],
      'Data do Documento'
    )
  )

  if (
    !dataDocumento ||
    !fillField(
      dataDocumento,
      dataFormatada
    )
  ) {
    warnings.push(
      'data do documento'
    )
  }

  /*
   * 1. Tipo do documento:
   *    deve ser exatamente "Requerimento".
   */
  const documentType = await waitFor(() =>
    findField(
      [
        '#selSerie',
        'select[name="selSerie"]',
        'select[id*="Serie"]'
      ],
      'Tipo do Documento'
    )
  )

  if (
    !chooseSelectExact(
      documentType,
      'Requerimento'
    )
  ) {
    warnings.push(
      'tipo do documento Requerimento'
    )
  }

  await wait(400)

  hideUnusedDocumentFields()

  /*
   * 2. Formato:
   *    Digitalizado nesta Unidade.
   */
  const digitalizadoRadio = await waitFor(() =>
    findField(
      [
        '#optDigitalizado',
        'input[type="radio"][value="D"]',
        'input[type="radio"][id*="Digitalizado"]',
        'input[type="radio"][name*="Formato"][value="D"]'
      ],
      'Digitalizado nesta Unidade'
    )
  )

  const digitalizado = digitalizadoRadio
    ? chooseRadio(
        [
          '#optDigitalizado',
          'input[type="radio"][value="D"]',
          'input[type="radio"][id*="Digitalizado"]',
          'input[type="radio"][name*="Formato"][value="D"]'
        ],
        'Digitalizado nesta Unidade'
      )
    : false

  if (!digitalizado) {
    warnings.push(
      'formato Digitalizado nesta Unidade'
    )
  }

  /*
   * O campo de conferência costuma surgir somente
   * depois que Digitalizado é marcado.
   */
  await wait(500)

  hideUnusedDocumentFields()

  const conference = await waitFor(() =>
    findField(
      [
        '#selTipoConferencia',
        'select[name*="TipoConferencia"]',
        'select[id*="TipoConferencia"]'
      ],
      'Tipo de Conferência'
    )
  )

  if (
    !chooseDocumentOriginal(conference)
  ) {
    warnings.push(
      'tipo de conferência Documento Original'
    )
  }

  /*
   * 3. Observações do processo FAST PROC.
   */
  const observations = await waitFor(() =>
    findField(
      [
        '#txaObservacoes',
        'textarea[name="txaObservacoes"]',
        'textarea[id*="Observacoes"]'
      ],
      'Observações desta unidade'
    )
  )

  if (
    !contexto?.observacoes ||
    !fillField(
      observations,
      contexto.observacoes
    )
  ) {
    warnings.push(
      'observações desta unidade'
    )
  }

  /*
   * 4. Restrito.
   */
  if (!chooseRestrito()) {
    warnings.push(
      'nível de acesso Restrito'
    )
  }

  /*
   * 5. Informação Pessoal.
   */
  await wait(400)

  if (
    !await chooseInformacaoPessoal()
  ) {
    warnings.push(
      'hipótese legal Informação Pessoal'
    )
  }

  /*
   * Finaliza a pendência sem salvar o documento.
   * O usuário ainda anexa o arquivo e salva manualmente.
   */
  const processoId =
    pending.processoId

  const updatedContext = {
    ...(contexto || {}),
    processoId,
    documentoPresencialPendente:
      false,
    requerimentoRapidoPendente:
      false,
    documentoPresencialPreenchidoEm:
      Date.now()
  }

  const updatedRegistry = {
    ...registry,
    [processoId]: updatedContext
  }

  await storageSet({
    [CONTEXT_KEY]:
      updatedContext,
    [REGISTRY_KEY]:
      updatedRegistry
  })

  await storageRemove(
    PENDING_KEY
  )

  const message =
    'FAST PROC preparou o Requerimento. Confira os dados, anexe o arquivo digitalizado e salve manualmente.'

  showStatus(
    warnings.length
      ? `${message} Confira manualmente: ${warnings.join(', ')}.`
      : message,
    warnings.length > 0
  )

  mconsole.log(
    warnings.length
      ? `Pendente: ${warnings.join(', ')}`
      : 'Requerimento rápido preenchido completamente'
  )
}
