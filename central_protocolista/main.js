(() => {
  'use strict'

  const api = typeof browser === 'undefined' ? chrome : browser
  const OPERATOR_KEY = 'fastMailOperadorValidado'
  const WEBMAIL_CREDENTIALS_KEY = 'centralProtocolistaWebmailCredentials'
  const SEI_CREDENTIALS_KEY = 'centralProtocolistaSeiCredentials'
  const METRICS_KEY = 'centralProtocolistaMetricsByOperator'
  const FEEDBACK_KEY = 'centralProtocolistaPendingFeedback'
  const CATALOG_PATH = '../data/catalogo-processos.json'
  const SEND_FEEDBACK_MESSAGE = 'sei-protocolistas:send-feedback-via-webmail'
  const OPEN_WORKDAY_SYSTEMS_MESSAGE = 'sei-protocolistas:open-workday-systems'
  const FEEDBACK_SENSITIVE_PATTERNS = [
    { label: 'e-mail', pattern: /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i },
    { label: 'CPF', pattern: /\b\d{3}[.\s-]?\d{3}[.\s-]?\d{3}[-\s]?\d{2}\b/ },
    { label: 'número de processo', pattern: /\b(?:SEI[-\s:]*)?\d{5,6}[./-]\d{5,7}[./-]\d{4}(?:-\d{2})?\b/i }
  ]

  const WEBMAIL_URL = 'https://venus2.detran.rj.gov.br/owa/'
  const SEI_LOGIN_URL = 'https://sei.rj.gov.br/sip/login.php?sigla_orgao_sistema=ERJ&sigla_sistema=SEI'

  let processes = []

  const $ = (selector) => document.querySelector(selector)
  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim()
  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))

  const get = (keys) => new Promise((resolve, reject) => {
    const result = api.storage.local.get(keys, (items) => {
      const error = api.runtime?.lastError
      if (error) reject(error)
      else resolve(items)
    })
    if (result?.then) result.then(resolve, reject)
  })

  const set = (items) => new Promise((resolve, reject) => {
    const result = api.storage.local.set(items, () => {
      const error = api.runtime?.lastError
      if (error) reject(error)
      else resolve()
    })
    if (result?.then) result.then(resolve, reject)
  })

  const remove = (keys) => new Promise((resolve, reject) => {
    const result = api.storage.local.remove(keys, () => {
      const error = api.runtime?.lastError
      if (error) reject(error)
      else resolve()
    })
    if (result?.then) result.then(resolve, reject)
  })

  const runtimeMessage = (payload) => new Promise((resolve, reject) => {
    const result = api.runtime.sendMessage(payload, (response) => {
      const error = api.runtime?.lastError
      if (error) reject(error)
      else if (response?.ok === false) reject(new Error(response.error || 'Falha na comunicação da extensão.'))
      else resolve(response || {})
    })
    if (result?.then) result.then(resolve, reject)
  })

  function feedbackId () {
    if (crypto.randomUUID) return crypto.randomUUID()
    return `feedback-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }

  async function waitForFeedbackResult (id, timeout = 30000) {
    const startedAt = Date.now()

    while (Date.now() - startedAt < timeout) {
      const feedback = (await get(FEEDBACK_KEY))[FEEDBACK_KEY]
      if (!feedback || feedback.id !== id) throw new Error('O relatório pendente não foi localizado.')
      if (feedback.status === 'sent') return feedback
      if (feedback.status === 'error') throw new Error(feedback.error || 'O Webmail não aceitou o envio.')
      await sleep(400)
    }

    throw new Error('O Webmail demorou para confirmar o envio.')
  }

  async function clearExpiredFeedback () {
    const feedback = (await get(FEEDBACK_KEY))[FEEDBACK_KEY]
    if (!feedback) return

    const finished = ['sent', 'error'].includes(feedback.status)
    const expired = !feedback.expiresAt || Date.now() > feedback.expiresAt
    if (finished || expired) await remove(FEEDBACK_KEY)
  }

  function message (selector, text, type = '') {
    const element = $(selector)
    if (!element) return
    element.textContent = text
    element.className = `message${type ? ` ${type}` : ''}`
  }

  function extractProtocolista (email) {
    const normalized = clean(email).toLowerCase()
    const match = normalized.match(/^protocolista\s*(\d{1,4})@detran\.rj\.gov\.br$/i)
    if (!match) return null

    return {
      number: match[1],
      email: `protocolista${match[1]}@detran.rj.gov.br`
    }
  }

  async function setConfiguredOperatorFromWebmail (email) {
    const operator = extractProtocolista(email)
    if (!operator) return null

    const stored = await get(OPERATOR_KEY)
    const previous = stored[OPERATOR_KEY]
    const validated = previous?.email?.toLowerCase() === operator.email.toLowerCase() && previous?.validatedAt

    const next = validated
      ? previous
      : {
          ...operator,
          source: 'central-config',
          configuredAt: Date.now()
        }

    await set({ [OPERATOR_KEY]: next })
    renderOperator(next)
    return next
  }

  function renderOperator (operator) {
    const box = $('#operator-status')
    if (!box) return

    if (!operator?.number || !operator?.email) {
      box.className = 'operator-status operator-status--pending'
      box.innerHTML = '<span class="status-dot" aria-hidden="true"></span><div><strong>Protocolista não configurado</strong><span>Informe o e-mail institucional do webmail.</span></div>'
      return
    }

    const isValidated = Boolean(operator.validatedAt) && operator.source !== 'central-config'
    box.className = isValidated
      ? 'operator-status operator-status--validated'
      : 'operator-status operator-status--configured'

    box.innerHTML = `
      <span class="status-dot" aria-hidden="true"></span>
      <div>
        <strong>Protocolista ${operator.number} ${isValidated ? 'validado' : 'configurado'}</strong>
        <span>${operator.email}</span>
      </div>`
  }

  function renderCredentialStatus (selector, state) {
    const badge = $(selector)
    if (!badge) return
    badge.textContent = state ? 'Credenciais salvas' : 'Não configurado'
    badge.className = state ? 'badge success' : 'badge warning'
  }

  async function loadWebmailCredentials () {
    const credentials = (await get(WEBMAIL_CREDENTIALS_KEY))[WEBMAIL_CREDENTIALS_KEY]

    if (credentials?.remember) {
      $('#webmail-user').value = credentials.user || ''
      $('#webmail-password').value = ''
      $('#webmail-password').placeholder = credentials.password ? 'Senha já salva' : 'Senha'
      $('#remember-webmail-credentials').checked = true
      renderCredentialStatus('#webmail-credentials-status', Boolean(credentials.user && credentials.password))
      await setConfiguredOperatorFromWebmail(credentials.user)
    } else {
      renderCredentialStatus('#webmail-credentials-status', false)
    }
  }

  async function loadSeiCredentials () {
    const credentials = (await get(SEI_CREDENTIALS_KEY))[SEI_CREDENTIALS_KEY]

    if (credentials?.remember) {
      $('#sei-user').value = credentials.user || ''
      $('#sei-password').value = ''
      $('#sei-password').placeholder = credentials.password ? 'Senha já salva' : 'Senha'
      $('#remember-sei-credentials').checked = true
      renderCredentialStatus('#sei-credentials-status', Boolean(credentials.user && credentials.password))
    } else {
      renderCredentialStatus('#sei-credentials-status', false)
    }
  }

  function openWebmail () {
    window.open(WEBMAIL_URL, '_blank', 'noopener')
  }

  function openSei () {
    window.open(SEI_LOGIN_URL, '_blank', 'noopener')
  }

  async function saveWebmailCredentialsAndOpen (event) {
    event.preventDefault()

    const user = clean($('#webmail-user').value).toLowerCase()
    const enteredPassword = String($('#webmail-password').value || '')
    const remember = $('#remember-webmail-credentials').checked
    const operator = extractProtocolista(user)
    const existing = (await get(WEBMAIL_CREDENTIALS_KEY))[WEBMAIL_CREDENTIALS_KEY]
    const password = enteredPassword || (
      remember && existing?.remember && clean(existing.user).toLowerCase() === user
        ? String(existing.password || '')
        : ''
    )

    if (!operator) {
      return message(
        '#webmail-credentials-message',
        'Use o e-mail institucional no padrão protocolistaN@detran.rj.gov.br.',
        'error'
      )
    }

    if (!password) return message('#webmail-credentials-message', 'Informe a senha do Webmail.', 'error')

    if (remember) {
      await set({
        [WEBMAIL_CREDENTIALS_KEY]: {
          user: operator.email,
          password,
          remember: true,
          savedAt: Date.now()
        }
      })
      renderCredentialStatus('#webmail-credentials-status', true)
      message('#webmail-credentials-message', 'Acesso do Webmail salvo neste navegador.', 'success')
      $('#webmail-password').value = ''
      $('#webmail-password').placeholder = 'Senha já salva'
    } else {
      await remove(WEBMAIL_CREDENTIALS_KEY)
      renderCredentialStatus('#webmail-credentials-status', false)
      message('#webmail-credentials-message', 'Credenciais não serão mantidas após este acesso.', 'success')
    }

    await setConfiguredOperatorFromWebmail(operator.email)
    openWebmail()
  }

  async function saveSeiCredentialsAndOpen (event) {
    event.preventDefault()

    const user = clean($('#sei-user').value)
    const enteredPassword = String($('#sei-password').value || '')
    const remember = $('#remember-sei-credentials').checked
    const existing = (await get(SEI_CREDENTIALS_KEY))[SEI_CREDENTIALS_KEY]
    const password = enteredPassword || (
      remember && existing?.remember && clean(existing.user) === user
        ? String(existing.password || '')
        : ''
    )

    if (!user) return message('#sei-credentials-message', 'Informe o usuário do SEI.', 'error')
    if (!password) return message('#sei-credentials-message', 'Informe a senha do SEI.', 'error')

    if (remember) {
      await set({
        [SEI_CREDENTIALS_KEY]: {
          user,
          password,
          remember: true,
          savedAt: Date.now()
        }
      })
      renderCredentialStatus('#sei-credentials-status', true)
      message('#sei-credentials-message', 'Acesso do SEI salvo neste navegador.', 'success')
      $('#sei-password').value = ''
      $('#sei-password').placeholder = 'Senha já salva'
    } else {
      await remove(SEI_CREDENTIALS_KEY)
      renderCredentialStatus('#sei-credentials-status', false)
      message('#sei-credentials-message', 'Credenciais não serão mantidas após este acesso.', 'success')
    }

    openSei()
  }

  async function clearWebmailCredentials () {
    if (!window.confirm('Apagar as credenciais salvas do Webmail neste navegador?')) return
    await remove(WEBMAIL_CREDENTIALS_KEY)
    $('#webmail-credentials-form').reset()
    $('#webmail-password').type = 'password'
    renderCredentialStatus('#webmail-credentials-status', false)
    message('#webmail-credentials-message', 'Credenciais do Webmail apagadas.', 'success')
  }

  async function clearSeiCredentials () {
    if (!window.confirm('Apagar as credenciais salvas do SEI neste navegador?')) return
    await remove(SEI_CREDENTIALS_KEY)
    $('#sei-credentials-form').reset()
    $('#sei-password').type = 'password'
    renderCredentialStatus('#sei-credentials-status', false)
    message('#sei-credentials-message', 'Credenciais do SEI apagadas.', 'success')
  }

  function togglePassword (selector) {
    const field = $(selector)
    if (!field) return
    field.type = field.type === 'password' ? 'text' : 'password'
  }

  function localDayKey (timestamp = Date.now()) {
    const date = new Date(timestamp)
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
  }

  function formatTime (timestamp) {
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp))
  }

  function formatDate (timestamp) {
    return new Intl.DateTimeFormat('pt-BR').format(new Date(timestamp))
  }

  function formatDuration (milliseconds) {
    const totalMinutes = Math.max(0, Math.floor(Number(milliseconds || 0) / 60000))
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (!hours) return `${minutes} min`
    return `${hours}h ${String(minutes).padStart(2, '0')}min`
  }

  function emptyMetricsState () {
    return { active: null, report: null }
  }

  async function clearExpiredMetrics () {
    const stored = await get(METRICS_KEY)
    const allMetrics = stored[METRICS_KEY]
    if (!allMetrics || typeof allMetrics !== 'object') return

    const today = localDayKey()
    let changed = false
    const nextMetrics = Object.fromEntries(Object.entries(allMetrics).map(([number, rawState]) => {
      const state = rawState || emptyMetricsState()
      const active = state.active?.dayKey === today ? state.active : null
      const report = state.report?.dayKey === today ? state.report : null
      if (active !== state.active || report !== state.report) changed = true
      return [number, { active, report }]
    }))

    if (changed) await set({ [METRICS_KEY]: nextMetrics })
  }

  async function readOperatorMetrics () {
    const stored = await get([WEBMAIL_CREDENTIALS_KEY, METRICS_KEY])
    const credentials = stored[WEBMAIL_CREDENTIALS_KEY]
    const operator = credentials?.remember && credentials?.password
      ? extractProtocolista(credentials.user)
      : null
    const operatorNumber = clean(operator?.number)
    const allMetrics = stored[METRICS_KEY] && typeof stored[METRICS_KEY] === 'object'
      ? stored[METRICS_KEY]
      : {}

    if (!operatorNumber) return { operatorNumber: '', allMetrics, state: emptyMetricsState() }

    return { operatorNumber, allMetrics, state: allMetrics[operatorNumber] || emptyMetricsState() }
  }

  function renderWorkdayReport (report) {
    const panel = $('#workday-report')
    if (!panel) return
    panel.hidden = !report
    if (!report) return

    $('#workday-report-date').textContent = formatDate(report.endedAt)
    $('#metric-duration').textContent = formatDuration(report.durationMs)
    $('#metric-emails').textContent = String(report.counters?.emails || 0)
    $('#metric-processes').textContent = String(report.counters?.processes || 0)
    $('#metric-requirements').textContent = String(report.counters?.requirements || 0)
    $('#metric-start').textContent = `Início: ${formatTime(report.startedAt)}`
    $('#metric-end').textContent = `Término: ${formatTime(report.endedAt)}`
  }

  async function renderWorkday () {
    const { operatorNumber, state } = await readOperatorMetrics()
    const active = state.active
    const button = $('#start-workday')
    const reopenButton = $('#reopen-systems')

    if (active) {
      $('#workday-title').textContent = 'Expediente em andamento'
      $('#workday-description').textContent = `Iniciado às ${formatTime(active.startedAt)}. O relatório ficará disponível somente após a finalização.`
      $('#workday-status').textContent = 'Em andamento'
      $('#workday-status').className = 'badge success'
      button.textContent = 'FINALIZAR EXPEDIENTE'
      button.className = 'danger-button start-button'
      reopenButton.hidden = false
      renderWorkdayReport(null)
      return
    }

    $('#workday-title').textContent = 'Iniciar expediente'
    $('#workday-description').textContent = operatorNumber
      ? 'Abre Webmail e SEI e inicia a contagem individual deste expediente.'
      : 'Configure o protocolista e os acessos para iniciar o expediente.'
    $('#workday-status').textContent = 'Fora do expediente'
    $('#workday-status').className = 'badge'
    button.textContent = state.report ? 'INICIAR NOVO EXPEDIENTE' : 'INICIAR EXPEDIENTE'
    button.className = 'primary start-button'
    reopenButton.hidden = true
    renderWorkdayReport(state.report)
  }

  async function beginWorkday (operatorNumber, allMetrics, state) {
    const nextState = {
      ...state,
      active: {
        startedAt: Date.now(),
        dayKey: localDayKey(),
        counters: { emails: 0, processes: 0, requirements: 0 }
      }
    }
    await set({ [METRICS_KEY]: { ...allMetrics, [operatorNumber]: nextState } })
    await renderWorkday()
  }

  async function finishWorkday (operatorNumber, allMetrics, state) {
    if (!state.active) return
    const endedAt = Date.now()
    const report = {
      dayKey: localDayKey(endedAt),
      startedAt: state.active.startedAt,
      endedAt,
      durationMs: endedAt - state.active.startedAt,
      counters: {
        emails: Number(state.active.counters?.emails || 0),
        processes: Number(state.active.counters?.processes || 0),
        requirements: Number(state.active.counters?.requirements || 0)
      }
    }
    await set({
      [METRICS_KEY]: {
        ...allMetrics,
        [operatorNumber]: { active: null, report }
      }
    })
    await renderWorkday()
    $('#workday-report').scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function startWorkday () {
    const metrics = await readOperatorMetrics()
    if (metrics.state.active && metrics.operatorNumber) {
      await finishWorkday(metrics.operatorNumber, metrics.allMetrics, metrics.state)
      return
    }

    const stored = await get([WEBMAIL_CREDENTIALS_KEY, SEI_CREDENTIALS_KEY])
    const webmail = stored[WEBMAIL_CREDENTIALS_KEY]
    const sei = stored[SEI_CREDENTIALS_KEY]

    if (!webmail?.remember || !webmail?.user || !webmail?.password) {
      message('#webmail-credentials-message', 'Salve primeiro o acesso do Webmail para usar INICIAR EXPEDIENTE.', 'error')
      $('#webmail-user').focus()
      return
    }

    if (!sei?.remember || !sei?.user || !sei?.password) {
      message('#sei-credentials-message', 'Salve primeiro o acesso do SEI para usar INICIAR EXPEDIENTE.', 'error')
      $('#sei-user').focus()
      return
    }

    const { operatorNumber, allMetrics, state } = metrics
    if (!operatorNumber) {
      message('#webmail-credentials-message', 'Configure primeiro o e-mail institucional do protocolista.', 'error')
      $('#webmail-user').focus()
      return
    }

    await beginWorkday(operatorNumber, allMetrics, state)
    try {
      await runtimeMessage({ type: OPEN_WORKDAY_SYSTEMS_MESSAGE })
    } catch (error) {
      console.error('[SEI Protocolistas] Falha ao abrir os sistemas do expediente:', error)
      message('#webmail-credentials-message', 'O expediente foi iniciado, mas não foi possível abrir Webmail e SEI. Tente novamente.', 'error')
    }
  }

  async function reopenWorkdaySystems () {
    const button = $('#reopen-systems')
    const metrics = await readOperatorMetrics()

    if (!metrics.operatorNumber || !metrics.state.active) {
      message(
        '#workday-message',
        'Inicie o expediente antes de reabrir os sistemas.',
        'error'
      )
      await renderWorkday()
      return
    }

    const stored = await get([
      WEBMAIL_CREDENTIALS_KEY,
      SEI_CREDENTIALS_KEY
    ])
    const webmail = stored[WEBMAIL_CREDENTIALS_KEY]
    const sei = stored[SEI_CREDENTIALS_KEY]

    if (
      !webmail?.remember ||
      !webmail?.user ||
      !webmail?.password ||
      !sei?.remember ||
      !sei?.user ||
      !sei?.password
    ) {
      message(
        '#workday-message',
        'Confirme as credenciais salvas do Webmail e do SEI.',
        'error'
      )
      return
    }

    button.disabled = true
    button.textContent = 'REABRINDO...'
    message(
      '#workday-message',
      'Abrindo Webmail e SEI sem interromper o expediente...'
    )

    try {
      await runtimeMessage({
        type: OPEN_WORKDAY_SYSTEMS_MESSAGE
      })
      message(
        '#workday-message',
        `Sistemas reabertos. Expediente mantido desde ${
          formatTime(metrics.state.active.startedAt)
        }.`,
        'success'
      )
    } catch (error) {
      console.error(
        '[SEI Protocolistas] Falha ao reabrir os sistemas:',
        error
      )
      message(
        '#workday-message',
        'Não foi possível reabrir Webmail e SEI. Tente novamente.',
        'error'
      )
    } finally {
      button.disabled = false
      button.textContent = 'REABRIR SISTEMAS'
    }
  }

  async function exportWorkdayReport () {
    const { operatorNumber, state } = await readOperatorMetrics()
    const report = state.report
    if (!operatorNumber || !report) return

    const rows = [
      ['Protocolista', operatorNumber],
      ['Data', formatDate(report.endedAt)],
      ['Início', formatTime(report.startedAt)],
      ['Término', formatTime(report.endedAt)],
      ['Tempo total', formatDuration(report.durationMs)],
      ['E-mails atendidos', report.counters?.emails || 0],
      ['Processos abertos', report.counters?.processes || 0],
      ['Exigências enviadas', report.counters?.requirements || 0]
    ]
    const csv = '\uFEFF' + rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `relatorio-expediente-protocolista-${operatorNumber}-${report.dayKey}.csv`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function sendFeedback (event) {
    event.preventDefault()
    const button = $('#send-feedback')
    let pendingFeedbackId = ''
    const stored = await get([OPERATOR_KEY, WEBMAIL_CREDENTIALS_KEY])
    const operator = stored[OPERATOR_KEY]
    const credentials = stored[WEBMAIL_CREDENTIALS_KEY]
    const operatorNumber = clean(operator?.number)
    const operatorEmail = clean(operator?.email || credentials?.user).toLowerCase()
    const type = $('#feedback-type').value
    const location = $('#feedback-location').value
    const title = clean($('#feedback-title').value)
    const description = String($('#feedback-description').value || '').trim()
    const steps = String($('#feedback-steps').value || '').trim() || 'Não informado'

    if (!title || !description) {
      message('#feedback-message', 'Preencha o título e a descrição do relato.', 'error')
      return
    }

    const sensitiveMatch = FEEDBACK_SENSITIVE_PATTERNS.find(({ pattern }) => pattern.test([title, description, steps].join('\n')))
    if (sensitiveMatch) {
      message(
        '#feedback-message',
        `Remova ${sensitiveMatch.label} de cidadão ou processo antes de enviar o relato.`,
        'error'
      )
      return
    }

    if (!operatorNumber || !extractProtocolista(operatorEmail)) {
      message('#feedback-message', 'Configure primeiro o e-mail institucional do protocolista.', 'error')
      return
    }

    if (!credentials?.remember || !credentials?.user || !credentials?.password) {
      message('#feedback-message', 'Salve primeiro o acesso do Webmail para enviar o relato.', 'error')
      return
    }

    button.disabled = true
    button.textContent = 'ENVIANDO...'
    message('#feedback-message', 'Enviando relatório ao responsável pelo projeto...')

    try {
      const id = feedbackId()
      pendingFeedbackId = id
      await set({
        [FEEDBACK_KEY]: {
          id,
          status: 'queued',
          type,
          title,
          location,
          description,
          steps,
          operatorNumber,
          operatorEmail,
          version: api.runtime.getManifest().version,
          browser: navigator.userAgent,
          reportedAt: Date.now(),
          expiresAt: Date.now() + (2 * 60 * 1000)
        }
      })
      await runtimeMessage({ type: SEND_FEEDBACK_MESSAGE, feedbackId: id })
      await waitForFeedbackResult(id)
      await remove(FEEDBACK_KEY)

      $('#feedback-form').reset()
      message('#feedback-message', 'Relato enviado com sucesso. Obrigado pela colaboração.', 'success')
    } catch (error) {
      console.error('[SEI Protocolistas] Falha ao enviar relato:', error)
      if (pendingFeedbackId) {
        const pending = (await get(FEEDBACK_KEY))[FEEDBACK_KEY]
        if (pending?.id === pendingFeedbackId) await remove(FEEDBACK_KEY)
      }
      message('#feedback-message', `Não foi possível enviar agora: ${error.message}`, 'error')
    } finally {
      button.disabled = false
      button.textContent = 'ENVIAR RELATO'
    }
  }

  function renderCatalog (list) {
    const body = $('#catalog-body')
    body.replaceChildren()

    list.forEach((item) => {
      const row = document.createElement('tr')
      const name = document.createElement('td')
      const unit = document.createElement('td')
      name.textContent = item.name || 'A confirmar'
      unit.textContent = item.destinationUnit || 'A confirmar'
      row.append(name, unit)
      body.appendChild(row)
    })

    $('#catalog-summary').textContent = `${list.length} procedimento${list.length === 1 ? '' : 's'}`
  }

  async function loadCatalog () {
    try {
      const response = await fetch(CATALOG_PATH)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const catalog = await response.json()
      processes = Array.isArray(catalog.processTypes) ? catalog.processTypes : []
      renderCatalog(processes)
    } catch (error) {
      console.error('[SEI Protocolistas] Falha ao carregar catálogo:', error)
      $('#catalog-summary').textContent = 'Falha no catálogo'
      message('#catalog-error', 'Não foi possível carregar o catálogo local.', 'error')
    }
  }

  function filterCatalog () {
    const query = clean($('#catalog-search').value).toLowerCase()
    const filtered = !query
      ? processes
      : processes.filter((item) => [item.name, item.destinationUnit]
        .some((value) => String(value || '').toLowerCase().includes(query)))

    renderCatalog(filtered)
  }

  function bind () {
    $('#webmail-credentials-form').addEventListener('submit', saveWebmailCredentialsAndOpen)
    $('#sei-credentials-form').addEventListener('submit', saveSeiCredentialsAndOpen)

    $('#clear-webmail-credentials').addEventListener('click', clearWebmailCredentials)
    $('#clear-sei-credentials').addEventListener('click', clearSeiCredentials)
    $('#toggle-webmail-password').addEventListener('click', () => togglePassword('#webmail-password'))
    $('#toggle-sei-password').addEventListener('click', () => togglePassword('#sei-password'))

    $('#open-fast-mail').addEventListener('click', openWebmail)
    $('#open-sei').addEventListener('click', openSei)
    $('#start-workday').addEventListener('click', startWorkday)
    $('#reopen-systems').addEventListener('click', reopenWorkdaySystems)
    $('#export-workday').addEventListener('click', exportWorkdayReport)
    $('#feedback-form').addEventListener('submit', sendFeedback)

    $('#catalog-search').addEventListener('input', filterCatalog)
    $('#focus-catalog').addEventListener('click', () => {
      $('#catalog-panel').scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => $('#catalog-search').focus(), 300)
    })

    $('#webmail-user').addEventListener('change', async (event) => {
      const operator = extractProtocolista(event.target.value)
      if (operator) await setConfiguredOperatorFromWebmail(operator.email)
    })
  }

  document.addEventListener('DOMContentLoaded', async () => {
    $('#extension-version').textContent = `Versão ${api.runtime.getManifest().version}`
    bind()
    await clearExpiredFeedback()
    await clearExpiredMetrics()

    const stored = await get(OPERATOR_KEY)
    renderOperator(stored[OPERATOR_KEY])

    await Promise.all([
      loadWebmailCredentials(),
      loadSeiCredentials(),
      loadCatalog(),
      renderWorkday()
    ])

    api.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return
      if (changes[OPERATOR_KEY]) renderOperator(changes[OPERATOR_KEY].newValue)
      if (changes[WEBMAIL_CREDENTIALS_KEY]) loadWebmailCredentials()
      if (changes[SEI_CREDENTIALS_KEY]) loadSeiCredentials()
      if (changes[OPERATOR_KEY] || changes[METRICS_KEY]) renderWorkday()
    })
  })
})()
