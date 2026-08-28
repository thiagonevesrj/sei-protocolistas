'use strict'

const api = typeof browser === 'undefined' ? chrome : browser
const usingBrowserPromises = typeof browser !== 'undefined'
const ROUTES_KEY = 'fastMailAttendanceRoutes'
const REGISTER_ORIGIN_MESSAGE = 'sei-protocolistas:register-fast-mail-origin'
const RETURN_TO_EMAIL_MESSAGE = 'sei-protocolistas:return-fast-mail'
const PROCESS_RESULT_READY_MESSAGE = 'sei-protocolistas:process-result-ready'
const SEND_FEEDBACK_MESSAGE = 'sei-protocolistas:send-feedback-via-webmail'
const OPEN_WORKDAY_SYSTEMS_MESSAGE = 'sei-protocolistas:open-workday-systems'
const OPEN_WEBMAIL_MESSAGE = 'sei-protocolistas:open-webmail'
const GET_CURRENT_TAB_MESSAGE = 'sei-protocolistas:get-current-tab'
const FEEDBACK_KEY = 'centralProtocolistaPendingFeedback'
const FEEDBACK_COMPOSE_URL = 'https://venus2.detran.rj.gov.br/owa/?ae=Item&a=New&t=IPM.Note'
const WEBMAIL_URL = 'https://venus2.detran.rj.gov.br/owa/'
const WEBMAIL_MATCH_PATTERN = 'https://venus2.detran.rj.gov.br/owa/*'
const SEI_LOGIN_URL = 'https://sei.rj.gov.br/sip/login.php?sigla_orgao_sistema=ERJ&sigla_sistema=SEI'
const MAX_ROUTE_AGE = 60 * 60 * 1000

function callApi (target, method, ...args) {
  if (usingBrowserPromises) return target[method](...args)

  return new Promise((resolve, reject) => {
    target[method](...args, (result) => {
      const error = api.runtime?.lastError
      if (error) reject(error)
      else resolve(result)
    })
  })
}

function webmailTabScore (tab) {
  const isCompose = /[?&]ae=(?:Item|PreFormAction)(?:&|$)/i.test(tab.url || '')
  return (isCompose ? 0 : 100) +
    (tab.active ? 10 : 0) +
    Number(tab.lastAccessed || 0) / 1e15
}

async function focusBrowserTab (tab) {
  await callApi(api.tabs, 'update', tab.id, { active: true })

  if (tab.windowId != null && api.windows?.update) {
    try {
      await callApi(api.windows, 'update', tab.windowId, { focused: true })
    } catch (error) {
      console.warn('[SEI Protocolistas] A aba existe, mas a janela não pôde receber foco:', error)
    }
  }
}

async function openOrReuseWebmail (active = true) {
  const tabs = await callApi(api.tabs, 'query', {
    url: WEBMAIL_MATCH_PATTERN
  })
  const existing = (tabs || [])
    .filter((tab) => tab?.id)
    .sort((a, b) => webmailTabScore(b) - webmailTabScore(a))[0]

  if (existing) {
    if (active) await focusBrowserTab(existing)
    return { tab: existing, reused: true }
  }

  const tab = await callApi(api.tabs, 'create', {
    url: WEBMAIL_URL,
    active
  })
  return { tab, reused: false }
}

async function openWebmail () {
  const result = await openOrReuseWebmail(true)
  return { ok: true, tabId: result.tab.id, reused: result.reused }
}

async function readRoutes () {
  const stored = await callApi(api.storage.local, 'get', ROUTES_KEY)
  const routes = stored?.[ROUTES_KEY] || {}
  const now = Date.now()

  return Object.fromEntries(
    Object.entries(routes).filter(([, route]) =>
      route?.createdAt && now - route.createdAt <= MAX_ROUTE_AGE &&
      (!route.expiresAt || now <= route.expiresAt)
    )
  )
}

async function saveRoutes (routes) {
  await callApi(api.storage.local, 'set', { [ROUTES_KEY]: routes })
}

async function registerFastMailOrigin (message, sender) {
  if (!message.attendanceId || !sender.tab?.id) {
    throw new Error('Não foi possível identificar a aba original do e-mail.')
  }

  const routes = await readRoutes()
  routes[message.attendanceId] = {
    attendanceId: message.attendanceId,
    email: message.email || '',
    tabId: sender.tab.id,
    windowId: sender.tab.windowId,
    url: message.url || sender.tab.url || '',
    createdAt: message.createdAt || Date.now(),
    expiresAt: message.expiresAt || Date.now() + MAX_ROUTE_AGE
  }
  await saveRoutes(routes)

  return { ok: true, tabId: sender.tab.id }
}

async function focusTab (route) {
  let tab

  try {
    tab = await callApi(api.tabs, 'get', route.tabId)
  } catch (error) {
    if (!route.url) throw error
    tab = await callApi(api.tabs, 'create', { url: route.url, active: true })
  }

  await callApi(api.tabs, 'update', tab.id, { active: true })

  if (tab.windowId != null && api.windows?.update) {
    try {
      await callApi(api.windows, 'update', tab.windowId, { focused: true })
    } catch (error) {
      console.warn('[SEI Protocolistas] A aba foi aberta, mas a janela não pôde receber foco:', error)
    }
  }

  try {
    await callApi(api.tabs, 'sendMessage', tab.id, {
      type: PROCESS_RESULT_READY_MESSAGE,
      attendanceId: route.attendanceId
    })
  } catch (error) {
    console.warn('[SEI Protocolistas] O e-mail recebeu foco, mas o FAST MAIL ainda está carregando:', error)
  }

  return tab
}

async function returnToFastMail (message) {
  if (!message.attendanceId) throw new Error('Atendimento de origem não identificado.')

  const routes = await readRoutes()
  const route = routes[message.attendanceId]
  if (!route) throw new Error('A referência do e-mail original expirou. Volte à aba do Webmail.')

  const tab = await focusTab(route)
  return { ok: true, tabId: tab.id, reopened: tab.id !== route.tabId }
}

async function openFeedbackCompose (message) {
  if (!message.feedbackId) throw new Error('Relato não identificado.')

  const stored = await callApi(api.storage.local, 'get', FEEDBACK_KEY)
  const feedback = stored?.[FEEDBACK_KEY]
  if (!feedback || feedback.id !== message.feedbackId) {
    throw new Error('O relatório pendente não foi localizado.')
  }
  if (!feedback.expiresAt || Date.now() > feedback.expiresAt) {
    throw new Error('O relatório expirou. Envie novamente pela Central.')
  }

  try {
    const tab = await callApi(api.tabs, 'create', {
      url: 'about:blank',
      active: false
    })
    await callApi(api.storage.local, 'set', {
      [FEEDBACK_KEY]: {
        ...feedback,
        status: 'opening-webmail',
        webmailTabId: tab.id,
        openedAt: Date.now()
      }
    })
    await callApi(api.tabs, 'update', tab.id, { url: FEEDBACK_COMPOSE_URL })
    return { ok: true, tabId: tab.id }
  } catch (error) {
    await callApi(api.storage.local, 'set', {
      [FEEDBACK_KEY]: {
        ...feedback,
        status: 'error',
        error: error.message || String(error)
      }
    })
    throw error
  }
}

async function openWorkdaySystems () {
  const webmailResult = await openOrReuseWebmail(false)
  const webmailTab = webmailResult.tab

  try {
    const seiTab = await callApi(api.tabs, 'create', {
      url: SEI_LOGIN_URL,
      active: true
    })
    return {
      ok: true,
      webmailTabId: webmailTab.id,
      webmailReused: webmailResult.reused,
      seiTabId: seiTab.id
    }
  } catch (error) {
    await focusBrowserTab(webmailTab)
    throw error
  }
}

function currentTab (sender) {
  if (!sender.tab?.id) throw new Error('Não foi possível identificar a aba atual.')
  return { ok: true, tabId: sender.tab.id }
}

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  let task

  if (message?.type === REGISTER_ORIGIN_MESSAGE) {
    task = registerFastMailOrigin(message, sender)
  } else if (message?.type === RETURN_TO_EMAIL_MESSAGE) {
    task = returnToFastMail(message)
  } else if (message?.type === SEND_FEEDBACK_MESSAGE) {
    task = openFeedbackCompose(message)
  } else if (message?.type === OPEN_WORKDAY_SYSTEMS_MESSAGE) {
    task = openWorkdaySystems()
  } else if (message?.type === OPEN_WEBMAIL_MESSAGE) {
    task = openWebmail()
  } else if (message?.type === GET_CURRENT_TAB_MESSAGE) {
    task = Promise.resolve(currentTab(sender))
  } else {
    return undefined
  }

  task.then(sendResponse).catch((error) => {
    console.error('[SEI Protocolistas] Falha na continuidade entre SEI e Webmail:', error)
    sendResponse({ ok: false, error: error.message || String(error) })
  })

  return true
})
