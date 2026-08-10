'use strict'

const api = typeof browser === 'undefined' ? chrome : browser
const usingBrowserPromises = typeof browser !== 'undefined'
const ROUTES_KEY = 'fastMailAttendanceRoutes'
const REGISTER_ORIGIN_MESSAGE = 'sei-protocolistas:register-fast-mail-origin'
const RETURN_TO_EMAIL_MESSAGE = 'sei-protocolistas:return-fast-mail'
const PROCESS_RESULT_READY_MESSAGE = 'sei-protocolistas:process-result-ready'
const SEND_FEEDBACK_MESSAGE = 'sei-protocolistas:send-feedback-via-webmail'
const FEEDBACK_KEY = 'centralProtocolistaPendingFeedback'
const FEEDBACK_COMPOSE_URL = 'https://venus2.detran.rj.gov.br/owa/?ae=PreFormAction&a=New&t=IPM.Note'
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
      url: FEEDBACK_COMPOSE_URL,
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

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  let task

  if (message?.type === REGISTER_ORIGIN_MESSAGE) {
    task = registerFastMailOrigin(message, sender)
  } else if (message?.type === RETURN_TO_EMAIL_MESSAGE) {
    task = returnToFastMail(message)
  } else if (message?.type === SEND_FEEDBACK_MESSAGE) {
    task = openFeedbackCompose(message)
  } else {
    return undefined
  }

  task.then(sendResponse).catch((error) => {
    console.error('[SEI Protocolistas] Falha na continuidade entre SEI e Webmail:', error)
    sendResponse({ ok: false, error: error.message || String(error) })
  })

  return true
})
