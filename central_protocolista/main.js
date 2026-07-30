(() => {
  'use strict'

  const browserApi = typeof browser === 'undefined' ? chrome : browser
  const CONFIG_KEY = 'centralProtocolistaConfiguracao'
  const MODEL_OVERRIDES_KEY = 'centralProtocolistaModelos'
  const DRAFT_KEY = 'cliqueProtocolistaRascunho'
  const CONTEXT_KEY = 'cliqueProtocolistaContexto'
  const CATALOG_PATH = '../data/catalogo-processos.json'
  const MODELS_PATH = '../data/modelos-resposta.json'
  const MAX_DRAFT_AGE = 15 * 60 * 1000
  const APP_NAME = 'SEI Protocolistas'
  const EXPORT_SCHEMA_VERSION = 1

  let responseModels = []
  let modelOverrides = {}

  function cleanValue (value) {
    return String(value || '').replace(/\s+/g, ' ').trim()
  }

  function storageGet (keys) {
    return new Promise((resolve, reject) => {
      const result = browserApi.storage.local.get(keys, (items) => {
        const lastError = browserApi.runtime?.lastError
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
      const result = browserApi.storage.local.set(items, () => {
        const lastError = browserApi.runtime?.lastError
        if (lastError) reject(lastError)
        else resolve()
      })

      if (result && typeof result.then === 'function') {
        result.then(resolve, reject)
      }
    })
  }

  function storageRemove (keys) {
    return new Promise((resolve, reject) => {
      const result = browserApi.storage.local.remove(keys, () => {
        const lastError = browserApi.runtime?.lastError
        if (lastError) reject(lastError)
        else resolve()
      })

      if (result && typeof result.then === 'function') {
        result.then(resolve, reject)
      }
    })
  }

  function setConfigurationStatus (configured) {
    const status = document.querySelector('#config-status')
    status.textContent = configured ? 'Configurado' : 'Não configurado'
    status.className = configured
      ? 'badge badge--success'
      : 'badge badge--warning'
  }

  function showMessage (selector, message, type = '') {
    const element = document.querySelector(selector)
    element.textContent = message
    element.className = `form-message${type ? ` form-message--${type}` : ''}`
  }

  async function loadConfiguration () {
    try {
      const stored = await storageGet(CONFIG_KEY)
      const configuration = stored[CONFIG_KEY]
      const nameInput = document.querySelector('#protocolist-name')
      const numberInput = document.querySelector('#protocolist-number')

      nameInput.value = configuration?.protocolistName || ''
      numberInput.value = configuration?.protocolistNumber || ''
      setConfigurationStatus(Boolean(configuration?.protocolistNumber))
    } catch (error) {
      console.error('[SEI Protocolistas] Falha ao carregar configuração:', error)
      showMessage('#form-message', 'Não foi possível carregar a configuração local.', 'error')
    }
  }

  async function saveConfiguration (event) {
    event.preventDefault()

    const name = cleanValue(document.querySelector('#protocolist-name').value)
    const number = cleanValue(document.querySelector('#protocolist-number').value)

    if (!/^\d{1,4}$/.test(number)) {
      setConfigurationStatus(false)
      showMessage(
        '#form-message',
        'Informe somente os números da identificação do protocolista.',
        'error'
      )
      document.querySelector('#protocolist-number').focus()
      return
    }

    try {
      await storageSet({
        [CONFIG_KEY]: {
          protocolistName: name,
          protocolistNumber: number,
          updatedAt: Date.now()
        }
      })
      setConfigurationStatus(true)
      showMessage('#form-message', 'Configuração salva neste navegador.', 'success')
    } catch (error) {
      console.error('[SEI Protocolistas] Falha ao salvar configuração:', error)
      showMessage('#form-message', 'Não foi possível salvar a configuração.', 'error')
    }
  }

  function createCell (text) {
    const cell = document.createElement('td')
    cell.textContent = text || 'A confirmar'
    return cell
  }

  function createStatusCell (status) {
    const cell = document.createElement('td')
    const badge = document.createElement('span')
    const isPilot = status === 'pilot'
    badge.className = `table-status table-status--${isPilot ? 'pilot' : 'pending'}`
    badge.textContent = isPilot ? 'Piloto configurado' : 'Mapeamento pendente'
    cell.appendChild(badge)
    return cell
  }

  function renderCatalog (catalog) {
    const body = document.querySelector('#catalog-body')
    const processes = Array.isArray(catalog.processTypes) ? catalog.processTypes : []
    body.replaceChildren()

    processes.forEach((processType) => {
      const row = document.createElement('tr')
      row.append(
        createCell(processType.name),
        createCell(processType.destinationUnit),
        createCell(processType.subjectAcronym),
        createStatusCell(processType.catalogStatus)
      )
      body.appendChild(row)
    })

    const configured = processes.filter((item) => item.catalogStatus === 'pilot').length
    document.querySelector('#catalog-summary').textContent =
      `${configured} configurado · ${processes.length - configured} pendentes`
  }

  async function loadCatalog () {
    try {
      const response = await fetch(CATALOG_PATH)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      renderCatalog(await response.json())
    } catch (error) {
      console.error('[SEI Protocolistas] Falha ao carregar catálogo:', error)
      document.querySelector('#catalog-summary').textContent = 'Falha no catálogo'
      document.querySelector('#catalog-error').textContent =
        'Não foi possível carregar o catálogo local de processos.'
    }
  }

  function getSelectedModel () {
    const selectedId = document.querySelector('#model-select').value
    return responseModels.find((model) => model.id === selectedId)
  }

  function getCurrentModelBody (model) {
    return modelOverrides[model.id] || model.body
  }

  function renderSelectedModel () {
    const model = getSelectedModel()
    document.querySelector('#model-body').value = model ? getCurrentModelBody(model) : ''
    showMessage('#model-message', '')
  }

  function renderModelOptions () {
    const select = document.querySelector('#model-select')
    select.replaceChildren()

    responseModels.forEach((model) => {
      const option = document.createElement('option')
      option.value = model.id
      option.textContent = model.name
      select.appendChild(option)
    })
    renderSelectedModel()
  }

  async function loadResponseModels () {
    try {
      const [response, stored] = await Promise.all([
        fetch(MODELS_PATH),
        storageGet(MODEL_OVERRIDES_KEY)
      ])
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const payload = await response.json()
      responseModels = Array.isArray(payload.models) ? payload.models : []
      modelOverrides = stored[MODEL_OVERRIDES_KEY] || {}
      renderModelOptions()
    } catch (error) {
      console.error('[SEI Protocolistas] Falha ao carregar modelos:', error)
      showMessage('#model-message', 'Não foi possível carregar os modelos de resposta.', 'error')
    }
  }

  async function saveSelectedModel () {
    const model = getSelectedModel()
    const body = document.querySelector('#model-body').value.trim()
    if (!model || !body) {
      showMessage('#model-message', 'Escolha um modelo e informe o texto.', 'error')
      return
    }
    if (!body.includes('{{numeroProcesso}}')) {
      showMessage(
        '#model-message',
        'Mantenha o marcador {{numeroProcesso}} no texto.',
        'error'
      )
      return
    }

    try {
      modelOverrides = { ...modelOverrides, [model.id]: body }
      await storageSet({ [MODEL_OVERRIDES_KEY]: modelOverrides })
      showMessage('#model-message', 'Modelo personalizado salvo neste navegador.', 'success')
    } catch (error) {
      console.error('[SEI Protocolistas] Falha ao salvar modelo:', error)
      showMessage('#model-message', 'Não foi possível salvar o modelo.', 'error')
    }
  }

  async function restoreSelectedModel () {
    const model = getSelectedModel()
    if (!model) return

    try {
      const nextOverrides = { ...modelOverrides }
      delete nextOverrides[model.id]
      modelOverrides = nextOverrides
      await storageSet({ [MODEL_OVERRIDES_KEY]: modelOverrides })
      renderSelectedModel()
      showMessage('#model-message', 'Texto-base restaurado.', 'success')
    } catch (error) {
      console.error('[SEI Protocolistas] Falha ao restaurar modelo:', error)
      showMessage('#model-message', 'Não foi possível restaurar o modelo.', 'error')
    }
  }

  async function cleanupExpiredTemporaryData () {
    const stored = await storageGet([DRAFT_KEY, CONTEXT_KEY])
    const now = Date.now()
    const keysToRemove = []
    const draft = stored[DRAFT_KEY]
    const context = stored[CONTEXT_KEY]

    if (draft && (!draft.createdAt || now - draft.createdAt > MAX_DRAFT_AGE)) {
      keysToRemove.push(DRAFT_KEY)
    }
    if (context && (!context.expiresAt || now > context.expiresAt)) {
      keysToRemove.push(CONTEXT_KEY)
    }
    if (keysToRemove.length) await storageRemove(keysToRemove)

    return storageGet([DRAFT_KEY, CONTEXT_KEY])
  }

  async function updateTemporaryStatus () {
    try {
      const stored = await cleanupExpiredTemporaryData()
      const draft = stored[DRAFT_KEY]
      const context = stored[CONTEXT_KEY]
      const status = document.querySelector('#temporary-status')

      if (!draft && !context) {
        status.textContent = 'Nenhum dado ativo'
        status.className = 'badge badge--success'
        return
      }

      const mode = context?.modalidade === 'email'
        ? 'e-mail'
        : context?.modalidade === 'presencial' ? 'presencial' : 'rascunho'
      status.textContent = `Atendimento ${mode} ativo`
      status.className = 'badge badge--warning'
    } catch (error) {
      console.error('[SEI Protocolistas] Falha ao verificar dados temporários:', error)
      document.querySelector('#temporary-status').textContent = 'Falha na verificação'
    }
  }

  async function clearTemporaryData () {
    try {
      await storageRemove([DRAFT_KEY, CONTEXT_KEY])
      await updateTemporaryStatus()
      showMessage('#temporary-message', 'Dados do atendimento atual removidos.', 'success')
    } catch (error) {
      console.error('[SEI Protocolistas] Falha ao limpar dados temporários:', error)
      showMessage('#temporary-message', 'Não foi possível limpar os dados temporários.', 'error')
    }
  }

  function downloadJson (payload) {
    const content = JSON.stringify(payload, null, 2)
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    anchor.href = url
    anchor.download = `sei-protocolistas-config-${date}.json`
    anchor.hidden = true
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function exportSettings () {
    try {
      const stored = await storageGet([CONFIG_KEY, MODEL_OVERRIDES_KEY])
      downloadJson({
        app: APP_NAME,
        schemaVersion: EXPORT_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        permanentData: {
          protocolistConfiguration: stored[CONFIG_KEY] || null,
          modelOverrides: stored[MODEL_OVERRIDES_KEY] || {}
        }
      })
      showMessage(
        '#transfer-message',
        'Configuração exportada sem dados do atendimento.',
        'success'
      )
    } catch (error) {
      console.error('[SEI Protocolistas] Falha ao exportar configuração:', error)
      showMessage('#transfer-message', 'Não foi possível exportar a configuração.', 'error')
    }
  }

  function validateImportedConfiguration (configuration) {
    if (configuration === null || configuration === undefined) return null
    const number = cleanValue(configuration.protocolistNumber)
    if (!/^\d{1,4}$/.test(number)) {
      throw new Error('O número do protocolista no arquivo é inválido.')
    }

    return {
      protocolistName: cleanValue(configuration.protocolistName).slice(0, 80),
      protocolistNumber: number,
      updatedAt: Date.now()
    }
  }

  function validateImportedModels (overrides) {
    if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return {}
    const knownIds = new Set(responseModels.map((model) => model.id))
    const sanitized = {}

    Object.entries(overrides).forEach(([id, body]) => {
      if (
        knownIds.has(id) &&
        typeof body === 'string' &&
        body.length <= 30000 &&
        body.includes('{{numeroProcesso}}')
      ) {
        sanitized[id] = body
      }
    })
    return sanitized
  }

  async function importSettingsFile (file) {
    try {
      if (file.size > 1024 * 1024) {
        throw new Error('O arquivo de configuração ultrapassa o limite de 1 MB.')
      }
      const payload = JSON.parse(await file.text())
      if (payload.app !== APP_NAME || payload.schemaVersion !== EXPORT_SCHEMA_VERSION) {
        throw new Error('Este arquivo não pertence à Central Protocolista ou é incompatível.')
      }

      const permanentData = payload.permanentData || {}
      const configuration = validateImportedConfiguration(
        permanentData.protocolistConfiguration
      )
      const importedModels = validateImportedModels(permanentData.modelOverrides)
      const values = { [MODEL_OVERRIDES_KEY]: importedModels }
      if (configuration) values[CONFIG_KEY] = configuration

      await storageSet(values)
      modelOverrides = importedModels
      await loadConfiguration()
      renderSelectedModel()
      showMessage(
        '#transfer-message',
        'Configuração importada. Nenhum dado de cidadão foi aceito.',
        'success'
      )
    } catch (error) {
      console.error('[SEI Protocolistas] Falha ao importar configuração:', error)
      showMessage(
        '#transfer-message',
        `Não foi possível importar: ${error.message || error}`,
        'error'
      )
    }
  }

  function bindEvents () {
    document.querySelector('#protocolist-form').addEventListener('submit', saveConfiguration)
    document.querySelector('#model-select').addEventListener('change', renderSelectedModel)
    document.querySelector('#save-model').addEventListener('click', saveSelectedModel)
    document.querySelector('#restore-model').addEventListener('click', restoreSelectedModel)
    document.querySelector('#clear-temporary').addEventListener('click', clearTemporaryData)
    document.querySelector('#export-settings').addEventListener('click', exportSettings)
    document.querySelector('#import-settings').addEventListener('click', () => {
      document.querySelector('#import-file').click()
    })
    document.querySelector('#import-file').addEventListener('change', (event) => {
      const [file] = event.target.files
      if (file) importSettingsFile(file)
      event.target.value = ''
    })
  }

  function initialize () {
    const manifest = browserApi.runtime.getManifest()
    document.querySelector('#extension-version').textContent = `Versão ${manifest.version}`
    bindEvents()
    loadConfiguration()
    loadCatalog()
    loadResponseModels()
    updateTemporaryStatus()
  }

  document.addEventListener('DOMContentLoaded', initialize)
})()
