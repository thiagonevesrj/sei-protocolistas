(() => {
  'use strict'

  const DEFAULT_QUERY = '?ae=Item&a=Reply'
  const MOCK_EMAIL = 'maria.exemplo@cidadao.test'
  const MOCK_BODY = 'Olá, gostaria de protocolar uma solicitação junto ao DETRAN-RJ. Seguem os documentos para análise.<br><br>Atenciosamente,<br>Maria Exemplo'
  const logElement = document.querySelector('#lab-log')
  const editor = document.querySelector('#lab-editor')

  if (!/[?&]ae=(?:Item|PreFormAction)(?:&|$)/i.test(location.search) || !/[?&]a=(?:Reply|ReplyAll|Forward|New)(?:&|$)/i.test(location.search)) {
    history.replaceState(null, '', `${location.pathname}${DEFAULT_QUERY}`)
  }

  function writeLog (message) {
    const stamp = new Date().toLocaleTimeString('pt-BR')
    const line = `[${stamp}] ${message}`
    if (logElement) {
      logElement.textContent = logElement.textContent === 'Pronto para testar.'
        ? line
        : `${line}\n${logElement.textContent}`
    }
  }

  const sourceHeader = document.createElement('div')
  sourceHeader.className = 'lab-source-header'
  sourceHeader.textContent = `De: Maria Exemplo [${MOCK_EMAIL}]\nPara: protocolista31@detran.rj.gov.br`
  Object.assign(sourceHeader.style, {
    position: 'absolute',
    left: '-10000px',
    top: '0',
    width: '1px',
    height: '1px',
    overflow: 'hidden'
  })
  document.body.prepend(sourceHeader)

  if (!globalThis.chrome?.runtime?.getURL) {
    writeLog('ERRO: abra o LAB pelo botão da extensão SEI Protocolistas. A abertura direta do arquivo não possui acesso aos catálogos da extensão.')
    return
  }

  const memory = {
    fastMailOperadorValidado: {
      number: '31',
      email: 'protocolista31@detran.rj.gov.br',
      source: 'fast-mail-lab',
      validatedAt: Date.now()
    },
    centralProtocolistaAtendimento: {
      email: MOCK_EMAIL,
      name: 'Maria Exemplo',
      cpf: '12345678909',
      procedureId: '',
      destination: '',
      updatedAt: Date.now(),
      emailSource: 'fast-mail-lab'
    },
    centralProtocolistaMetricsByOperator: {}
  }

  function clone (value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
  }

  function readKeys (keys) {
    if (keys === null || keys === undefined) return clone(memory)

    if (typeof keys === 'string') {
      return { [keys]: clone(memory[keys]) }
    }

    if (Array.isArray(keys)) {
      return keys.reduce((result, key) => {
        result[key] = clone(memory[key])
        return result
      }, {})
    }

    if (typeof keys === 'object') {
      return Object.keys(keys).reduce((result, key) => {
        result[key] = memory[key] === undefined ? clone(keys[key]) : clone(memory[key])
        return result
      }, {})
    }

    return {}
  }

  const mockRuntime = {
    lastError: null,
    getURL: (path) => chrome.runtime.getURL(path),
    sendMessage: (message, callback) => {
      const type = String(message?.type || 'mensagem sem tipo')
      writeLog(`runtime simulado: ${type}`)

      const response = type === 'sei-protocolistas:get-current-tab'
        ? { ok: true, tabId: 999999 }
        : { ok: true, lab: true }

      if (typeof callback === 'function') window.setTimeout(() => callback(response), 0)
      return undefined
    },
    onMessage: {
      addListener: (listener) => {
        globalThis.__fastMailLabRuntimeListener = listener
      }
    }
  }

  const mockStorage = {
    local: {
      get: (keys, callback) => {
        const result = readKeys(keys)
        if (typeof callback === 'function') window.setTimeout(() => callback(result), 0)
        return undefined
      },
      set: (items, callback) => {
        Object.entries(items || {}).forEach(([key, value]) => {
          memory[key] = clone(value)
        })
        if (typeof callback === 'function') window.setTimeout(callback, 0)
        return undefined
      },
      remove: (keys, callback) => {
        const list = Array.isArray(keys) ? keys : [keys]
        list.filter(Boolean).forEach((key) => delete memory[key])
        if (typeof callback === 'function') window.setTimeout(callback, 0)
        return undefined
      }
    }
  }

  globalThis.browser = {
    runtime: mockRuntime,
    storage: mockStorage
  }

  const fakeSeiWindow = {
    closed: false,
    close: () => {
      fakeSeiWindow.closed = true
      writeLog('Janela simulada do SEI fechada.')
    }
  }

  let fakeSeiUrl = 'about:blank'
  fakeSeiWindow.location = {}
  Object.defineProperty(fakeSeiWindow.location, 'href', {
    get: () => fakeSeiUrl,
    set: (value) => {
      fakeSeiUrl = String(value || '')
      writeLog(`FAST PROC simulado: abertura seria direcionada para ${fakeSeiUrl}`)
    }
  })

  window.open = (url) => {
    fakeSeiUrl = String(url || 'about:blank')
    writeLog(`Nova janela bloqueada pelo LAB: ${fakeSeiUrl}. Nenhum sistema externo foi aberto.`)
    return fakeSeiWindow
  }

  document.querySelector('#lab-reset')?.addEventListener('click', () => {
    location.reload()
  })

  document.querySelector('#lab-clear-body')?.addEventListener('click', () => {
    if (editor) {
      editor.innerHTML = MOCK_BODY
      editor.dispatchEvent(new Event('input', { bubbles: true }))
      editor.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const subject = document.querySelector('#lab-subject')
    const bcc = document.querySelector('#lab-bcc')
    if (subject) subject.value = 'RE: Solicitação de protocolo'
    if (bcc) bcc.value = ''
    writeLog('E-mail fictício restaurado.')
  })

  window.addEventListener('error', (event) => {
    writeLog(`ERRO JS: ${event.message || 'erro não identificado'}`)
  })

  window.addEventListener('unhandledrejection', (event) => {
    writeLog(`ERRO ASSÍNCRONO: ${event.reason?.message || event.reason || 'erro não identificado'}`)
  })

  writeLog('LAB inicializado com armazenamento e handoff isolados. Nenhum dado real será alterado.')
})()
