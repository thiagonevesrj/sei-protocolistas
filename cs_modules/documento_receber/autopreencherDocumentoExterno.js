/* global __mconsole, currentBrowser */
// eslint-disable-next-line no-unused-vars
async function autopreencherDocumentoExterno (BaseName) {
  const mconsole = new __mconsole(BaseName + '.autopreencherDocumentoExterno')
  const contextKey = 'cliqueProtocolistaContexto'

  function normalize (value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
  }

  function dispatchFieldEvents (element) {
    const eventNames = ['input', 'change']
    eventNames.forEach(eventName => {
      element.dispatchEvent(new Event(eventName, { bubbles: true }))
    })
  }

  function storageGet (key) {
    return new Promise((resolve, reject) => {
      const result = currentBrowser.storage.local.get(key, (items) => {
        const lastError = currentBrowser.runtime?.lastError
        if (lastError) reject(lastError)
        else resolve(items[key])
      })
      if (result && typeof result.then === 'function') {
        result.then(items => resolve(items[key]), reject)
      }
    })
  }

  function storageSet (items) {
    return new Promise((resolve, reject) => {
      const result = currentBrowser.storage.local.set(items, () => {
        const lastError = currentBrowser.runtime?.lastError
        if (lastError) reject(lastError)
        else resolve()
      })
      if (result && typeof result.then === 'function') result.then(resolve, reject)
    })
  }

  function getFormattedDate (date) {
    return [
      String(date.getDate()).padStart(2, '0'),
      String(date.getMonth() + 1).padStart(2, '0'),
      date.getFullYear()
    ].join('/')
  }

  function findField (selectors, labelText) {
    for (const selector of selectors) {
      const element = document.querySelector(selector)
      if (element) return element
    }

    const expected = normalize(labelText)
    const label = Array.from(document.querySelectorAll('label'))
      .find(item => normalize(item.textContent).includes(expected))
    if (!label) return null
    return (label.htmlFor && document.getElementById(label.htmlFor)) ||
      label.querySelector('input, textarea, select') ||
      label.parentElement?.querySelector('input, textarea, select')
  }

  function fillField (element, value) {
    if (!element || value === undefined || value === null) return false
    element.value = value
    dispatchFieldEvents(element)
    return true
  }

  function chooseRadio (selectors, labelText) {
    for (const selector of selectors) {
      const radio = document.querySelector(selector)
      if (radio) {
        radio.checked = true
        dispatchFieldEvents(radio)
        radio.click()
        return true
      }
    }

    const expected = normalize(labelText)
    const label = Array.from(document.querySelectorAll('label'))
      .find(item => normalize(item.textContent).includes(expected))
    const radio = label && (label.control || label.querySelector('input[type="radio"]'))
    if (!radio) return false
    radio.checked = true
    dispatchFieldEvents(radio)
    radio.click()
    return true
  }

  function chooseSelectByText (select, text) {
    if (!select) return false
    const expected = normalize(text)
    const option = Array.from(select.options)
      .find(item => normalize(item.textContent).includes(expected))
    if (!option) return false
    select.value = option.value
    dispatchFieldEvents(select)
    return true
  }

  function waitFor (action, attempts = 24) {
    if (action()) return Promise.resolve(true)
    if (attempts <= 0) return Promise.resolve(false)
    return new Promise(resolve => {
      window.setTimeout(() => waitFor(action, attempts - 1).then(resolve), 250)
    })
  }

  function showStatus (message, warning = false) {
    if (document.querySelector('#sp-documento-status')) return
    const status = document.createElement('div')
    status.id = 'sp-documento-status'
    status.setAttribute('role', 'status')
    status.style.cssText = [
      'background:#071a33',
      'border-left:5px solid #e0ae28',
      'color:#fff',
      'font-weight:600',
      'margin:8px 0',
      'padding:10px'
    ].join(';')
    if (warning) status.style.borderLeftColor = '#e74c3c'
    status.textContent = message

    const commandBar = document.querySelector(
      '#divInfraBarraComandosSuperior, #divInfraBarraComandosInferior'
    )
    if (commandBar?.parentElement) {
      commandBar.parentElement.insertBefore(status, commandBar.nextSibling)
    } else {
      document.body.prepend(status)
    }
  }

  const dataField = findField(
    ['#txtDataElaboracao', 'input[name="txtDataElaboracao"]'],
    'Data do Documento'
  )
  fillField(dataField, getFormattedDate(new Date()))

  const warnings = []

  if (!chooseRadio([
    '#optRestrito',
    'input[type="radio"][value="R"]',
    'input[type="radio"][id*="Restrito"]'
  ], 'Restrito')) {
    warnings.push('nível Restrito')
  }

  const hypothesis = () => findField(
    ['#selHipoteseLegal', 'select[name*="Hipotese"]', 'select[id*="Hipotese"]'],
    'Hipótese Legal'
  )
  if (!await waitFor(() => chooseSelectByText(hypothesis(), 'Informação Pessoal'))) {
    warnings.push('hipótese Informação Pessoal')
  }

  const contexto = await storageGet(contextKey)
  const usarFluxoPresencial = Boolean(
    contexto &&
    contexto.documentoPresencialPendente &&
    contexto.modalidade === 'presencial' &&
    Date.now() <= contexto.expiresAt
  )

  if (usarFluxoPresencial) {
    const documentType = findField(
      ['#selSerie', 'select[name="selSerie"]', 'select[id*="Serie"]'],
      'Tipo do Documento'
    )
    if (!chooseSelectByText(documentType, 'Requerimento')) {
      warnings.push('tipo Requerimento')
    }

    if (!chooseRadio([
      '#optDigitalizado',
      'input[type="radio"][value="D"]',
      'input[type="radio"][id*="Digitalizado"]'
    ], 'Digitalizado nesta Unidade')) {
      warnings.push('formato Digitalizado nesta Unidade')
    }

    const conference = () => findField(
      ['#selTipoConferencia', 'select[name*="TipoConferencia"]'],
      'Tipo de Conferência'
    )
    if (!await waitFor(() => chooseSelectByText(conference(), 'Original'))) {
      warnings.push('tipo de conferência Original')
    }

    const observations = findField(
      ['#txaObservacoes', 'textarea[name="txaObservacoes"]', 'textarea[id*="Observacoes"]'],
      'Observações desta unidade'
    )
    if (!fillField(observations, contexto.observacoes)) {
      warnings.push('observações da unidade')
    }

    await storageSet({
      [contextKey]: {
        ...contexto,
        documentoPresencialPendente: false,
        documentoPresencialPreenchidoEm: Date.now()
      }
    })
  }

  const message = usarFluxoPresencial
    ? 'SEI Protocolistas preparou o requerimento presencial. Confira os dados, anexe o arquivo e salve manualmente.'
    : 'SEI Protocolistas definiu Restrito + Informação Pessoal. Confira antes de salvar.'
  showStatus(
    warnings.length ? `${message} Confira manualmente: ${warnings.join(', ')}.` : message,
    warnings.length > 0
  )
  mconsole.log(warnings.length ? `Pendente: ${warnings.join(', ')}` : 'Preenchimento concluído')
}
